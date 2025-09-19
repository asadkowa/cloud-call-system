import { prisma } from '../config/database';
import { stripe } from '../config/stripe';

export interface CreateSubscriptionData {
  tenantId: string;
  planType: 'basic' | 'professional' | 'enterprise';
  paymentMethodId?: string;
  trialDays?: number;
}

export interface UpdateSubscriptionData {
  planType?: 'basic' | 'professional' | 'enterprise';
  quantity?: number;
}

export class SubscriptionService {
  private static readonly PLAN_CONFIGS = {
    basic: {
      monthlyPrice: 2900, // $29.00 in cents
      yearlyPrice: 29000, // $290.00 in cents
      stripePriceIdMonthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || 'price_basic_monthly',
      stripePriceIdYearly: process.env.STRIPE_BASIC_YEARLY_PRICE_ID || 'price_basic_yearly',
      features: ['call_routing', 'voicemail'],
      maxExtensions: 10,
      maxConcurrentCalls: 5
    },
    professional: {
      monthlyPrice: 4900, // $49.00 in cents
      yearlyPrice: 49000, // $490.00 in cents
      stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
      stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
      features: ['call_routing', 'voicemail', 'call_recording', 'ivr', 'queue_management', 'reports'],
      maxExtensions: 50,
      maxConcurrentCalls: 25
    },
    enterprise: {
      monthlyPrice: 9900, // $99.00 in cents
      yearlyPrice: 99000, // $990.00 in cents
      stripePriceIdMonthly: process.env.STRIPE_ENT_MONTHLY_PRICE_ID || 'price_ent_monthly',
      stripePriceIdYearly: process.env.STRIPE_ENT_YEARLY_PRICE_ID || 'price_ent_yearly',
      features: ['call_routing', 'voicemail', 'call_recording', 'ivr', 'queue_management', 'reports', 'api_access', 'sso'],
      maxExtensions: 500,
      maxConcurrentCalls: 100
    }
  };

  static async createSubscription(data: CreateSubscriptionData, billing_cycle: 'monthly' | 'yearly' = 'monthly') {
    const tenant = await prisma.tenant.findUnique({
      where: { id: data.tenantId },
      include: { subscription: true }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    if (tenant.subscription) {
      throw new Error('Tenant already has an active subscription');
    }

    const planConfig = this.PLAN_CONFIGS[data.planType];
    if (!planConfig) {
      throw new Error('Invalid plan type');
    }

    let stripeCustomer;
    let stripeSubscription;

    try {
      // Create Stripe customer
      stripeCustomer = await stripe.customers.create({
        metadata: {
          tenantId: data.tenantId,
          tenantName: tenant.name
        }
      });

      // Create Stripe subscription
      const priceId = billing_cycle === 'yearly'
        ? planConfig.stripePriceIdYearly
        : planConfig.stripePriceIdMonthly;

      const subscriptionParams: any = {
        customer: stripeCustomer.id,
        items: [{
          price: priceId,
          quantity: 1
        }],
        metadata: {
          tenantId: data.tenantId,
          planType: data.planType
        },
        expand: ['latest_invoice.payment_intent']
      };

      // Add trial if specified
      if (data.trialDays && data.trialDays > 0) {
        subscriptionParams.trial_period_days = data.trialDays;
      }

      // Add payment method if provided
      if (data.paymentMethodId) {
        subscriptionParams.default_payment_method = data.paymentMethodId;
      }

      stripeSubscription = await stripe.subscriptions.create(subscriptionParams);

      // Create local subscription record
      const subscription = await prisma.subscription.create({
        data: {
          tenantId: data.tenantId,
          stripeCustomerId: stripeCustomer.id,
          stripeSubscriptionId: stripeSubscription.id,
          planType: data.planType,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          priceId: priceId,
          quantity: 1,
          trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null
        },
        include: {
          tenant: true
        }
      });

      return {
        subscription,
        stripeSubscription,
        clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret
      };

    } catch (error: any) {
      // Cleanup on error
      if (stripeSubscription) {
        try {
          await stripe.subscriptions.cancel(stripeSubscription.id);
        } catch (cleanupError) {
          console.error('Error cleaning up Stripe subscription:', cleanupError);
        }
      }

      if (stripeCustomer) {
        try {
          await stripe.customers.del(stripeCustomer.id);
        } catch (cleanupError) {
          console.error('Error cleaning up Stripe customer:', cleanupError);
        }
      }

      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  static async getSubscriptionByTenant(tenantId: string) {
    return await prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        tenant: true,
        usageRecords: {
          where: {
            billingPeriod: this.getCurrentBillingPeriod()
          }
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
  }

  static async updateSubscription(tenantId: string, data: UpdateSubscriptionData) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('No Stripe subscription found');
    }

    let updateData: any = {};

    // Handle plan change
    if (data.planType && data.planType !== subscription.planType) {
      const planConfig = this.PLAN_CONFIGS[data.planType];
      if (!planConfig) {
        throw new Error('Invalid plan type');
      }

      // Update Stripe subscription
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [{
          id: (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
          price: planConfig.stripePriceIdMonthly,
        }],
        proration_behavior: 'create_prorations'
      });

      updateData.planType = data.planType;
      updateData.priceId = planConfig.stripePriceIdMonthly;
    }

    // Handle quantity change
    if (data.quantity && data.quantity !== subscription.quantity) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [{
          id: (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
          quantity: data.quantity,
        }],
        proration_behavior: 'create_prorations'
      });

      updateData.quantity = data.quantity;
    }

    // Update local record
    return await prisma.subscription.update({
      where: { tenantId },
      data: updateData,
      include: {
        tenant: true
      }
    });
  }

  static async cancelSubscription(tenantId: string, immediate = false) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('No Stripe subscription found');
    }

    // Cancel Stripe subscription
    const canceledSubscription = immediate
      ? await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
      : await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        });

    // Update local record
    return await prisma.subscription.update({
      where: { tenantId },
      data: {
        status: immediate ? 'canceled' : 'active',
        cancelAt: immediate ? new Date() : new Date(canceledSubscription.current_period_end * 1000),
        canceledAt: immediate ? new Date() : null
      }
    });
  }

  static async reactivateSubscription(tenantId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('No Stripe subscription found');
    }

    // Reactivate Stripe subscription
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update local record
    return await prisma.subscription.update({
      where: { tenantId },
      data: {
        status: 'active',
        cancelAt: null,
        canceledAt: null
      }
    });
  }

  static async syncSubscriptionFromStripe(stripeSubscriptionId: string) {
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId }
    });

    if (!subscription) {
      throw new Error('Local subscription not found');
    }

    return await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAt: stripeSubscription.cancel_at ? new Date(stripeSubscription.cancel_at * 1000) : null,
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null
      }
    });
  }

  static getPlanConfig(planType: string) {
    return this.PLAN_CONFIGS[planType as keyof typeof this.PLAN_CONFIGS];
  }

  static getAllPlans() {
    return Object.entries(this.PLAN_CONFIGS).map(([key, config]) => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      ...config
    }));
  }

  private static getCurrentBillingPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}