import { paypalClient, PAYPAL_CONFIG } from '../config/paypal';
import { prisma } from '../config/database';
import { OrdersController, SubscriptionsController } from '@paypal/paypal-server-sdk';

export interface PayPalOrderData {
  amount: number; // Amount in cents
  currency?: string;
  description?: string;
  tenantId: string;
  invoiceId?: string;
}

export interface PayPalSubscriptionData {
  planId: string;
  tenantId: string;
  payerInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

export class PayPalService {

  static async createOrder(data: PayPalOrderData) {
    const { amount, currency = 'USD', description, tenantId, invoiceId } = data;

    try {
      // Convert cents to dollars for PayPal
      const amountValue = (amount / 100).toFixed(2);

      const orderRequest = {
        intent: 'CAPTURE',
        purchaseUnits: [{
          amount: {
            currencyCode: currency,
            value: amountValue
          },
          description: description || 'Cloud Call Center Payment',
          customId: invoiceId || `tenant_${tenantId}`,
          softDescriptor: 'CLOUDCALL'
        }],
        applicationContext: {
          brandName: 'Cloud Call Center',
          landingPage: 'NO_PREFERENCE',
          userAction: 'PAY_NOW',
          returnUrl: PAYPAL_CONFIG.returnUrl,
          cancelUrl: PAYPAL_CONFIG.cancelUrl
        }
      };

      const ordersController = new OrdersController(paypalClient);
      const order = await ordersController.ordersCreate({
        body: orderRequest
      });

      // Store PayPal order ID in local payment record
      const payment = await prisma.payment.create({
        data: {
          tenantId,
          invoiceId,
          amount,
          currency: currency.toLowerCase(),
          status: 'pending',
          paymentMethod: 'paypal',
          description,
          stripePaymentIntentId: order.result.id // Using this field to store PayPal order ID
        }
      });

      return {
        orderId: order.result.id,
        approvalUrl: order.result.links?.find(link => link.rel === 'approve')?.href,
        payment,
        order: order.result
      };

    } catch (error: any) {
      console.error('PayPal create order error:', error);
      throw new Error(`Failed to create PayPal order: ${error.message}`);
    }
  }

  static async captureOrder(orderId: string, tenantId: string) {
    try {
      const ordersController = new OrdersController(paypalClient);
      const capture = await ordersController.ordersCapture({
        id: orderId
      });

      // Update local payment record
      const payment = await prisma.payment.findFirst({
        where: {
          stripePaymentIntentId: orderId, // PayPal order ID stored here
          tenantId
        }
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: capture.result.status === 'COMPLETED' ? 'succeeded' : 'pending',
            paidAt: capture.result.status === 'COMPLETED' ? new Date() : null
          }
        });

        // Update invoice status if payment succeeded
        if (capture.result.status === 'COMPLETED' && payment.invoiceId) {
          await prisma.invoice.update({
            where: { id: payment.invoiceId },
            data: {
              status: 'paid',
              paidAt: new Date(),
              amountPaid: payment.amount,
              amountDue: 0
            }
          });
        }
      }

      return {
        capture: capture.result,
        payment,
        success: capture.result.status === 'COMPLETED'
      };

    } catch (error: any) {
      console.error('PayPal capture order error:', error);

      // Update payment as failed
      const payment = await prisma.payment.findFirst({
        where: {
          stripePaymentIntentId: orderId,
          tenantId
        }
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            failedAt: new Date()
          }
        });
      }

      throw new Error(`Failed to capture PayPal order: ${error.message}`);
    }
  }

  static async createSubscription(data: PayPalSubscriptionData) {
    const { planId, tenantId, payerInfo } = data;

    try {
      const subscriptionRequest = {
        planId: planId,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Start tomorrow
        quantity: '1',
        shippingAmount: {
          currencyCode: 'USD',
          value: '0.00'
        },
        subscriber: payerInfo ? {
          name: {
            givenName: payerInfo.firstName || '',
            surname: payerInfo.lastName || ''
          },
          emailAddress: payerInfo.email || ''
        } : undefined,
        applicationContext: {
          brandName: 'Cloud Call Center',
          locale: 'en-US',
          shippingPreference: 'NO_SHIPPING',
          userAction: 'SUBSCRIBE_NOW',
          paymentMethod: {
            payerSelected: 'PAYPAL',
            payeePreferred: 'IMMEDIATE_PAYMENT_REQUIRED'
          },
          returnUrl: PAYPAL_CONFIG.returnUrl,
          cancelUrl: PAYPAL_CONFIG.cancelUrl
        }
      };

      const subscriptionsController = new SubscriptionsController(paypalClient);
      const subscription = await subscriptionsController.subscriptionsCreate({
        body: subscriptionRequest
      });

      // Create or update local subscription record
      const existingSubscription = await prisma.subscription.findUnique({
        where: { tenantId }
      });

      const subscriptionData = {
        status: subscription.result.status || 'pending',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        stripeSubscriptionId: subscription.result.id // Store PayPal subscription ID here
      };

      let localSubscription;
      if (existingSubscription) {
        localSubscription = await prisma.subscription.update({
          where: { tenantId },
          data: subscriptionData
        });
      } else {
        localSubscription = await prisma.subscription.create({
          data: {
            tenantId,
            planType: 'basic', // Default plan, should be determined by planId
            ...subscriptionData
          }
        });
      }

      return {
        subscriptionId: subscription.result.id,
        approvalUrl: subscription.result.links?.find(link => link.rel === 'approve')?.href,
        subscription: localSubscription,
        paypalSubscription: subscription.result
      };

    } catch (error: any) {
      console.error('PayPal create subscription error:', error);
      throw new Error(`Failed to create PayPal subscription: ${error.message}`);
    }
  }

  static async cancelSubscription(subscriptionId: string, reason?: string) {
    try {
      const cancelRequest = {
        reason: reason || 'User requested cancellation'
      };

      await paypalClient.subscriptions.cancel({
        id: subscriptionId,
        body: cancelRequest
      });

      // Update local subscription
      const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId }
      });

      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'canceled',
            canceledAt: new Date()
          }
        });
      }

      return { success: true, message: 'Subscription canceled successfully' };

    } catch (error: any) {
      console.error('PayPal cancel subscription error:', error);
      throw new Error(`Failed to cancel PayPal subscription: ${error.message}`);
    }
  }

  static async getSubscription(subscriptionId: string) {
    try {
      const subscription = await paypalClient.subscriptions.get({
        id: subscriptionId
      });

      return subscription.result;

    } catch (error: any) {
      console.error('PayPal get subscription error:', error);
      throw new Error(`Failed to get PayPal subscription: ${error.message}`);
    }
  }

  static async createBillingPlan(planData: {
    name: string;
    description: string;
    amount: number; // Amount in cents
    currency?: string;
    interval: 'MONTH' | 'YEAR';
    intervalCount?: number;
  }) {
    const { name, description, amount, currency = 'USD', interval, intervalCount = 1 } = planData;

    try {
      const planRequest = {
        product_id: 'CLOUD_CALL_CENTER', // You would create this product first
        name,
        description,
        status: 'ACTIVE',
        billing_cycles: [{
          frequency: {
            interval_unit: interval,
            interval_count: intervalCount
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite cycles
          pricing_scheme: {
            fixed_price: {
              value: (amount / 100).toFixed(2),
              currency_code: currency
            }
          }
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: '0.00',
            currency_code: currency
          },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        }
      };

      const plan = await paypalClient.billingPlans.create({
        body: planRequest
      });

      return plan.result;

    } catch (error: any) {
      console.error('PayPal create billing plan error:', error);
      throw new Error(`Failed to create PayPal billing plan: ${error.message}`);
    }
  }

  static async handleWebhook(webhookBody: any, headers: any) {
    try {
      // Verify webhook signature (implement based on PayPal's webhook verification)
      // This is a simplified version - in production, you should verify the webhook signature

      const eventType = webhookBody.event_type;
      const resource = webhookBody.resource;

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentCompleted(resource);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await this.handlePaymentFailed(resource);
          break;
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
          await this.handleSubscriptionActivated(resource);
          break;
        case 'BILLING.SUBSCRIPTION.CANCELLED':
          await this.handleSubscriptionCancelled(resource);
          break;
        case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
          await this.handleSubscriptionPaymentFailed(resource);
          break;
        default:
          console.log(`Unhandled PayPal webhook event: ${eventType}`);
      }

      return { success: true, message: 'Webhook processed successfully' };

    } catch (error: any) {
      console.error('PayPal webhook processing error:', error);
      throw new Error(`Failed to process PayPal webhook: ${error.message}`);
    }
  }

  private static async handlePaymentCompleted(resource: any) {
    const orderId = resource.supplementary_data?.related_ids?.order_id;
    if (orderId) {
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: orderId }
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'succeeded',
            paidAt: new Date()
          }
        });

        // Update associated invoice
        if (payment.invoiceId) {
          await prisma.invoice.update({
            where: { id: payment.invoiceId },
            data: {
              status: 'paid',
              paidAt: new Date(),
              amountPaid: payment.amount,
              amountDue: 0
            }
          });
        }
      }
    }
  }

  private static async handlePaymentFailed(resource: any) {
    const orderId = resource.supplementary_data?.related_ids?.order_id;
    if (orderId) {
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: orderId }
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            failedAt: new Date()
          }
        });
      }
    }
  }

  private static async handleSubscriptionActivated(resource: any) {
    const subscriptionId = resource.id;
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId }
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          currentPeriodStart: new Date(resource.start_time || new Date()),
          currentPeriodEnd: new Date(resource.billing_info?.next_billing_time || Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }
  }

  private static async handleSubscriptionCancelled(resource: any) {
    const subscriptionId = resource.id;
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId }
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'canceled',
          canceledAt: new Date()
        }
      });
    }
  }

  private static async handleSubscriptionPaymentFailed(resource: any) {
    const subscriptionId = resource.id;
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId }
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'past_due'
        }
      });
    }
  }
}