import { prisma } from '../config/database';
import { PaymentService } from './payment';
import { InvoiceService } from './invoice';

export interface BillingCycleOptions {
  tenantId?: string;
  dryRun?: boolean;
  processOverages?: boolean;
}

export interface BillingCycleSummary {
  processedSubscriptions: number;
  generatedInvoices: number;
  collectedPayments: number;
  failedPayments: number;
  totalAmount: number;
  errors: string[];
}

export class BillingCycleService {
  private static isRunning = false;

  // Process billing cycle for subscriptions ending today
  static async processBillingCycle(options: BillingCycleOptions = {}): Promise<BillingCycleSummary> {
    if (this.isRunning && !options.dryRun) {
      throw new Error('Billing cycle is already running');
    }

    this.isRunning = true;
    console.log('🔄 Starting billing cycle processing...', options);

    const summary: BillingCycleSummary = {
      processedSubscriptions: 0,
      generatedInvoices: 0,
      collectedPayments: 0,
      failedPayments: 0,
      totalAmount: 0,
      errors: []
    };

    try {
      // Get subscriptions that need billing
      const subscriptions = await this.getSubscriptionsForBilling(options.tenantId);
      console.log(`📋 Found ${subscriptions.length} subscriptions to process`);

      for (const subscription of subscriptions) {
        try {
          console.log(`💳 Processing subscription ${subscription.id} for tenant ${subscription.tenantId}`);

          const result = await this.processSubscriptionBilling(subscription, options);

          summary.processedSubscriptions++;
          if (result.invoice) {
            summary.generatedInvoices++;
            summary.totalAmount += result.invoice.total;
          }
          if (result.payment?.status === 'succeeded') {
            summary.collectedPayments++;
          } else if (result.payment?.status === 'failed') {
            summary.failedPayments++;
          }

        } catch (error: any) {
          console.error(`❌ Error processing subscription ${subscription.id}:`, error);
          summary.errors.push(`Subscription ${subscription.id}: ${error.message}`);
        }
      }

      // Process usage overages if enabled
      if (options.processOverages) {
        await this.processUsageOverages(options, summary);
      }

      console.log('✅ Billing cycle completed', summary);

    } catch (error: any) {
      console.error('❌ Billing cycle failed:', error);
      summary.errors.push(`General error: ${error.message}`);
    } finally {
      this.isRunning = false;
    }

    return summary;
  }

  // Get subscriptions that need billing (ending today or past due)
  private static async getSubscriptionsForBilling(tenantId?: string) {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const where: any = {
      status: 'active',
      currentPeriodEnd: {
        lte: today
      }
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    return await prisma.subscription.findMany({
      where,
      include: {
        tenant: true,
        plan: true,
        usageRecords: {
          where: {
            processed: false
          }
        }
      }
    });
  }

  // Process billing for a single subscription
  private static async processSubscriptionBilling(subscription: any, options: BillingCycleOptions) {
    const { tenant, plan } = subscription;

    // Calculate next billing period
    const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
    const nextPeriodStart = new Date(currentPeriodEnd);
    nextPeriodStart.setDate(nextPeriodStart.getDate() + 1);

    const nextPeriodEnd = new Date(nextPeriodStart);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

    // Calculate subscription cost
    const subscriptionAmount = plan?.monthlyPrice || 2900; // Default to $29

    // Calculate usage overages
    const usageAmount = await this.calculateUsageOverages(subscription);

    const totalAmount = subscriptionAmount + usageAmount;

    // Create invoice
    let invoice = null;
    if (!options.dryRun && totalAmount > 0) {
      invoice = await InvoiceService.createInvoice({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        amount: totalAmount,
        description: `${plan?.name || 'Subscription'} - ${nextPeriodStart.toISOString().split('T')[0]} to ${nextPeriodEnd.toISOString().split('T')[0]}`,
        dueDate: nextPeriodStart,
        items: [
          {
            description: `${plan?.name || 'Subscription'} (${nextPeriodStart.toLocaleDateString()} - ${nextPeriodEnd.toLocaleDateString()})`,
            quantity: subscription.quantity,
            unitAmount: subscriptionAmount,
            amount: subscriptionAmount * subscription.quantity
          },
          ...(usageAmount > 0 ? [{
            description: 'Usage Overages',
            quantity: 1,
            unitAmount: usageAmount,
            amount: usageAmount
          }] : [])
        ]
      });
    }

    // Attempt payment if invoice was created
    let payment = null;
    if (invoice && !options.dryRun) {
      try {
        // Try to charge the default payment method
        payment = await this.attemptPayment(subscription, invoice);

        if (payment?.status === 'succeeded') {
          // Update subscription for next period
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              currentPeriodStart: nextPeriodStart,
              currentPeriodEnd: nextPeriodEnd,
              updatedAt: new Date()
            }
          });

          // Mark usage records as processed
          await prisma.usageRecord.updateMany({
            where: {
              subscriptionId: subscription.id,
              processed: false
            },
            data: {
              processed: true
            }
          });
        }
      } catch (error: any) {
        console.error(`Failed to process payment for subscription ${subscription.id}:`, error);

        // Update subscription status if payment failed
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'past_due',
            updatedAt: new Date()
          }
        });
      }
    }

    return { invoice, payment, subscription, usageAmount };
  }

  // Calculate usage overages for a subscription
  private static async calculateUsageOverages(subscription: any): Promise<number> {
    const { plan } = subscription;
    if (!plan) return 0;

    const currentPeriod = new Date(subscription.currentPeriodStart).toISOString().split('T')[0].substring(0, 7); // YYYY-MM

    // Get usage records for current billing period
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        subscriptionId: subscription.id,
        billingPeriod: currentPeriod,
        processed: false
      }
    });

    let overageAmount = 0;

    // Calculate call minutes overage
    const callMinutes = usageRecords
      .filter(r => r.recordType === 'call_minutes')
      .reduce((sum, r) => sum + r.quantity, 0);

    const maxCallMinutes = plan.maxConcurrentCalls * 1000; // 1000 minutes per concurrent call
    if (callMinutes > maxCallMinutes) {
      const overageMinutes = callMinutes - maxCallMinutes;
      overageAmount += overageMinutes * 5; // $0.05 per minute overage
    }

    // Calculate seat overage
    const seatCount = usageRecords
      .filter(r => r.recordType === 'seat_count')
      .reduce((max, r) => Math.max(max, r.quantity), 0);

    if (seatCount > plan.maxUsers) {
      const overageSeats = seatCount - plan.maxUsers;
      overageAmount += overageSeats * 1000; // $10 per seat overage
    }

    return Math.round(overageAmount);
  }

  // Attempt payment for a subscription
  private static async attemptPayment(subscription: any, invoice: any) {
    // Get the tenant's saved payment methods
    const paymentMethods = await PaymentService.getPaymentMethods(subscription.tenantId);

    if (paymentMethods.length === 0) {
      throw new Error('No payment method available for automatic billing');
    }

    // Use the first (default) payment method
    const paymentMethod = paymentMethods[0];

    return await PaymentService.processPayment({
      amount: invoice.total,
      currency: invoice.currency,
      description: invoice.description,
      paymentMethod: {
        type: 'card',
        stripePaymentMethodId: paymentMethod.id
      },
      tenantId: subscription.tenantId,
      invoiceId: invoice.id
    });
  }

  // Process usage overages for all tenants
  private static async processUsageOverages(options: BillingCycleOptions, summary: BillingCycleSummary) {
    console.log('📊 Processing usage overages...');

    const currentMonth = new Date().toISOString().split('T')[0].substring(0, 7); // YYYY-MM

    // Get tenants with unprocessed usage that might have overages
    const tenantsWithUsage = await prisma.usageRecord.findMany({
      where: {
        billingPeriod: currentMonth,
        processed: false,
        ...(options.tenantId && { tenantId: options.tenantId })
      },
      include: {
        subscription: {
          include: {
            plan: true
          }
        }
      },
      distinct: ['tenantId']
    });

    for (const usageRecord of tenantsWithUsage) {
      try {
        if (usageRecord.subscription) {
          await this.processSubscriptionBilling(usageRecord.subscription, options);
        }
      } catch (error: any) {
        console.error(`Error processing overage for tenant ${usageRecord.tenantId}:`, error);
        summary.errors.push(`Overage processing for tenant ${usageRecord.tenantId}: ${error.message}`);
      }
    }
  }

  // Schedule automated billing cycle
  static startAutomatedBilling() {
    console.log('🕐 Automated billing scheduler (manual trigger for now)...');

    // TODO: Implement actual cron scheduling
    console.log('ℹ️  Use /api/billing-cycle/trigger for manual billing cycles');

    /*
    // TODO: Enable when node-cron is properly installed
    // Run daily at 2 AM
    // cron.schedule('0 2 * * *', async () => {
    //   console.log('⏰ Running scheduled billing cycle...');
    //   try {
    //     const summary = await this.processBillingCycle({
    //       processOverages: true
    //     });
    //     console.log('✅ Scheduled billing cycle completed:', summary);
    //   } catch (error) {
    //     console.error('❌ Scheduled billing cycle failed:', error);
    //   }
    // });

    // Run usage overage processing weekly on Sundays at 1 AM
    // cron.schedule('0 1 * * 0', async () => {
    //   console.log('📊 Running weekly usage overage processing...');
    //   try {
    //     const summary = await this.processBillingCycle({
    //       processOverages: true,
    //       dryRun: false
    //     });
    //     console.log('✅ Weekly overage processing completed:', summary);
    //   } catch (error) {
    //     console.error('❌ Weekly overage processing failed:', error);
    //   }
    // });
    */
  }

  // Manual billing cycle trigger (admin only)
  static async triggerManualBilling(tenantId?: string, dryRun = true): Promise<BillingCycleSummary> {
    console.log(`🎛️ Manual billing cycle triggered for ${tenantId || 'all tenants'} (dry run: ${dryRun})`);

    return await this.processBillingCycle({
      tenantId,
      dryRun,
      processOverages: true
    });
  }

  // Get billing cycle status
  static getBillingStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: new Date().toISOString() // Could store this in database
    };
  }
}

// Auto-start billing cycle if not in development
if (process.env.NODE_ENV !== 'development') {
  BillingCycleService.startAutomatedBilling();
}