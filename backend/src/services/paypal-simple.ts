import { prisma } from '../config/database';

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
      // For now, create a mock PayPal order
      // In production, this would integrate with the actual PayPal SDK
      const mockOrderId = `PAYPAL_ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
          stripePaymentIntentId: mockOrderId // Using this field to store PayPal order ID
        }
      });

      return {
        orderId: mockOrderId,
        approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${mockOrderId}`,
        payment,
        order: { id: mockOrderId, status: 'CREATED' }
      };

    } catch (error: any) {
      console.error('PayPal create order error:', error);
      throw new Error(`Failed to create PayPal order: ${error.message}`);
    }
  }

  static async captureOrder(orderId: string, tenantId: string) {
    try {
      // Mock capture - in production this would call PayPal API
      console.log(`Capturing PayPal order ${orderId} for tenant ${tenantId}`);

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
            status: 'succeeded',
            paidAt: new Date()
          }
        });

        // Update invoice status if payment succeeded
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

      return {
        capture: { id: orderId, status: 'COMPLETED' },
        payment,
        success: true
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
      // Mock subscription creation
      const mockSubscriptionId = `PAYPAL_SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create or update local subscription record
      const existingSubscription = await prisma.subscription.findUnique({
        where: { tenantId }
      });

      const subscriptionData = {
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        stripeSubscriptionId: mockSubscriptionId // Store PayPal subscription ID here
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
        subscriptionId: mockSubscriptionId,
        approvalUrl: `https://www.sandbox.paypal.com/agreements/approve?token=${mockSubscriptionId}`,
        subscription: localSubscription,
        paypalSubscription: { id: mockSubscriptionId, status: 'APPROVAL_PENDING' }
      };

    } catch (error: any) {
      console.error('PayPal create subscription error:', error);
      throw new Error(`Failed to create PayPal subscription: ${error.message}`);
    }
  }

  static async cancelSubscription(subscriptionId: string, reason?: string) {
    try {
      console.log(`Canceling PayPal subscription ${subscriptionId}. Reason: ${reason}`);

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
      // Mock get subscription
      return {
        id: subscriptionId,
        status: 'ACTIVE',
        billing_info: {
          next_billing_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

    } catch (error: any) {
      console.error('PayPal get subscription error:', error);
      throw new Error(`Failed to get PayPal subscription: ${error.message}`);
    }
  }

  static async handleWebhook(webhookBody: any, headers: any) {
    try {
      // Mock webhook handling
      console.log('PayPal webhook received:', webhookBody.event_type);

      const eventType = webhookBody.event_type;
      const resource = webhookBody.resource;

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentCompleted(resource);
          break;
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
          await this.handleSubscriptionActivated(resource);
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
    console.log('PayPal payment completed:', resource.id);
    // Implementation would update payment status in database
  }

  private static async handleSubscriptionActivated(resource: any) {
    console.log('PayPal subscription activated:', resource.id);
    // Implementation would update subscription status in database
  }
}