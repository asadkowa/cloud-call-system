import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { PayPalService } from './paypal-simple';

export interface PaymentMethodData {
  type: 'card' | 'bank_transfer' | 'paypal' | 'manual';
  stripePaymentMethodId?: string;
  billingDetails?: {
    name?: string;
    email?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
}

export interface ProcessPaymentData {
  amount: number; // Amount in cents
  currency?: string;
  description?: string;
  paymentMethod: PaymentMethodData;
  tenantId: string;
  invoiceId?: string;
}

export class PaymentService {

  static async processPayment(data: ProcessPaymentData) {
    const { amount, currency = 'usd', description, paymentMethod, tenantId, invoiceId } = data;

    // For PayPal, let the PayPal service create the payment record
    if (paymentMethod.type === 'paypal') {
      try {
        const paypalOrder = await PayPalService.createOrder({
          amount,
          currency: currency.toUpperCase(),
          description: description || 'Cloud Call Center Payment',
          tenantId,
          invoiceId
        });

        return {
          ...paypalOrder.payment,
          approvalUrl: paypalOrder.approvalUrl
        };
      } catch (error: any) {
        throw new Error(`PayPal payment failed: ${error.message}`);
      }
    }

    // Create local payment record for other payment methods
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        invoiceId,
        amount,
        currency,
        status: 'pending',
        paymentMethod: paymentMethod.type,
        description
      }
    });

    try {
      let paymentResult;

      switch (paymentMethod.type) {
        case 'card':
          paymentResult = await this.processCardPayment(payment, paymentMethod, amount, currency);
          break;
        case 'bank_transfer':
          paymentResult = await this.processBankTransfer(payment, paymentMethod, amount, currency);
          break;
        case 'manual':
          paymentResult = await this.processManualPayment(payment);
          break;
        default:
          throw new Error('Unsupported payment method');
      }

      // Update payment record with result
      const updateData: any = {
        status: paymentResult.status,
        paidAt: paymentResult.status === 'succeeded' ? new Date() : null,
        failedAt: paymentResult.status === 'failed' ? new Date() : null
      };

      // Only update stripePaymentIntentId if it's not already set and it's different
      if (paymentResult.stripePaymentIntentId &&
          paymentResult.stripePaymentIntentId !== payment.stripePaymentIntentId) {
        updateData.stripePaymentIntentId = paymentResult.stripePaymentIntentId;
      }

      return await prisma.payment.update({
        where: { id: payment.id },
        data: updateData,
        include: {
          invoice: true
        }
      });

    } catch (error: any) {
      // Update payment as failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          failedAt: new Date()
        }
      });

      throw new Error(`Payment failed: ${error.message}`);
    }
  }

  private static async processCardPayment(payment: any, paymentMethod: PaymentMethodData, amount: number, currency: string) {
    if (!paymentMethod.stripePaymentMethodId) {
      throw new Error('Stripe payment method ID required for card payments');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethod.stripePaymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        paymentId: payment.id,
        tenantId: payment.tenantId,
        invoiceId: payment.invoiceId || ''
      }
    });

    return {
      status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
      stripePaymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret
    };
  }

  private static async processBankTransfer(payment: any, paymentMethod: PaymentMethodData, amount: number, currency: string) {
    // For bank transfers, we'll create a payment intent with bank transfer methods
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['us_bank_account'],
      metadata: {
        paymentId: payment.id,
        tenantId: payment.tenantId,
        invoiceId: payment.invoiceId || ''
      }
    });

    return {
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret
    };
  }

  private static async processPayPalPayment(payment: any, paymentMethod: PaymentMethodData, amount: number, currency: string) {
    try {
      const paypalOrder = await PayPalService.createOrder({
        amount,
        currency: currency.toUpperCase(),
        description: payment.description || 'Cloud Call Center Payment',
        tenantId: payment.tenantId,
        invoiceId: payment.invoiceId
      });

      // Return the PayPal-created payment directly
      return {
        status: paypalOrder.payment.status,
        stripePaymentIntentId: paypalOrder.payment.stripePaymentIntentId,
        approvalUrl: paypalOrder.approvalUrl,
        paypalOrder: paypalOrder.order,
        paymentRecord: paypalOrder.payment
      };

    } catch (error: any) {
      console.error('PayPal payment processing error:', error);
      throw new Error(`PayPal payment failed: ${error.message}`);
    }
  }

  private static async processManualPayment(payment: any) {
    // Manual payments are marked as succeeded immediately
    // This is typically used for offline payments like checks or wire transfers
    return {
      status: 'succeeded',
      stripePaymentIntentId: null
    };
  }

  static async getPaymentsByTenant(tenantId: string, limit = 50, offset = 0) {
    return await prisma.payment.findMany({
      where: { tenantId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            description: true,
            total: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  static async getPaymentById(id: string, tenantId: string) {
    const payment = await prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        invoice: {
          include: {
            invoiceItems: true
          }
        }
      }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    return payment;
  }

  static async refundPayment(paymentId: string, amount?: number, reason?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'succeeded') {
      throw new Error('Can only refund successful payments');
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      throw new Error('Refund amount cannot exceed payment amount');
    }

    if (payment.stripePaymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          amount: refundAmount,
          reason: reason as any || 'requested_by_customer',
          metadata: {
            paymentId: payment.id,
            tenantId: payment.tenantId
          }
        });

        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            refundedAmount: payment.refundedAmount + refundAmount
          }
        });

        return {
          refund,
          refundAmount,
          remainingAmount: payment.amount - (payment.refundedAmount + refundAmount)
        };

      } catch (error: any) {
        throw new Error(`Refund failed: ${error.message}`);
      }
    } else {
      // Manual refund
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          refundedAmount: payment.refundedAmount + refundAmount
        }
      });

      return {
        refund: null,
        refundAmount,
        remainingAmount: payment.amount - (payment.refundedAmount + refundAmount)
      };
    }
  }

  static async syncPaymentFromStripe(stripePaymentIntentId: string) {
    const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId }
    });

    if (!payment) {
      throw new Error('Local payment not found');
    }

    return await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentIntent.status === 'succeeded' ? 'succeeded' :
               paymentIntent.status === 'canceled' ? 'canceled' : 'pending',
        paidAt: paymentIntent.status === 'succeeded' ? new Date() : null,
        failedAt: paymentIntent.status === 'canceled' ? new Date() : null
      }
    });
  }

  static async createStripeSetupIntent(tenantId: string) {
    // Get or create Stripe customer
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    let customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const customer = await stripe.customers.create({
        metadata: {
          tenantId,
          tenantName: tenant.name
        }
      });

      customerId = customer.id;

      // Update subscription with customer ID if it exists
      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { stripeCustomerId: customerId }
        });
      }
    }

    // Create setup intent for saving payment methods
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session'
    });

    return {
      clientSecret: setupIntent.client_secret,
      customerId
    };
  }

  static async getPaymentMethods(tenantId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!subscription?.stripeCustomerId) {
      return [];
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: subscription.stripeCustomerId,
      type: 'card'
    });

    return paymentMethods.data;
  }

  static async deletePaymentMethod(paymentMethodId: string) {
    return await stripe.paymentMethods.detach(paymentMethodId);
  }

  // PayPal-specific methods
  static async capturePayPalOrder(orderId: string, tenantId: string) {
    try {
      const result = await PayPalService.captureOrder(orderId, tenantId);
      return result;
    } catch (error: any) {
      throw new Error(`Failed to capture PayPal order: ${error.message}`);
    }
  }

  static async createPayPalSubscription(planId: string, tenantId: string, payerInfo?: any) {
    try {
      const result = await PayPalService.createSubscription({
        planId,
        tenantId,
        payerInfo
      });
      return result;
    } catch (error: any) {
      throw new Error(`Failed to create PayPal subscription: ${error.message}`);
    }
  }

  static async cancelPayPalSubscription(subscriptionId: string, reason?: string) {
    try {
      const result = await PayPalService.cancelSubscription(subscriptionId, reason);
      return result;
    } catch (error: any) {
      throw new Error(`Failed to cancel PayPal subscription: ${error.message}`);
    }
  }

  static async handlePayPalWebhook(webhookBody: any, headers: any) {
    try {
      const result = await PayPalService.handleWebhook(webhookBody, headers);
      return result;
    } catch (error: any) {
      throw new Error(`Failed to process PayPal webhook: ${error.message}`);
    }
  }
}