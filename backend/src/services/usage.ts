import { prisma } from '../config/database';
import { stripe } from '../config/stripe';

export interface CreateUsageRecordData {
  tenantId: string;
  recordType: 'call_minutes' | 'seat_count' | 'sms_count';
  quantity: number;
  description?: string;
  recordDate?: Date;
}

export class UsageService {

  static async recordUsage(data: CreateUsageRecordData) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: data.tenantId }
    });

    if (!subscription) {
      throw new Error('No active subscription found for tenant');
    }

    const billingPeriod = this.getCurrentBillingPeriod();

    // Create local usage record
    const usageRecord = await prisma.usageRecord.create({
      data: {
        subscriptionId: subscription.id,
        tenantId: data.tenantId,
        recordType: data.recordType,
        quantity: data.quantity,
        description: data.description,
        recordDate: data.recordDate || new Date(),
        billingPeriod,
        processed: false
      }
    });

    // Report to Stripe for metered billing
    if (subscription.stripeSubscriptionId && data.recordType === 'call_minutes') {
      try {
        const stripeUsageRecord = await stripe.subscriptionItems.createUsageRecord(
          subscription.stripeSubscriptionId,
          {
            quantity: Math.ceil(data.quantity), // Stripe requires integer
            timestamp: Math.floor((data.recordDate || new Date()).getTime() / 1000),
            action: 'increment'
          }
        );

        await prisma.usageRecord.update({
          where: { id: usageRecord.id },
          data: {
            stripeUsageRecordId: stripeUsageRecord.id,
            processed: true
          }
        });
      } catch (error) {
        console.error('Failed to report usage to Stripe:', error);
      }
    }

    return usageRecord;
  }

  static async recordCallUsage(tenantId: string, callId: string, durationSeconds: number) {
    const minutes = Math.ceil(durationSeconds / 60);

    return this.recordUsage({
      tenantId,
      recordType: 'call_minutes',
      quantity: minutes,
      description: `Call ${callId} - ${durationSeconds}s (${minutes} min)`
    });
  }

  static async recordSeatUsage(tenantId: string) {
    const activeUsers = await prisma.user.count({
      where: {
        tenantId,
        isActive: true
      }
    });

    return this.recordUsage({
      tenantId,
      recordType: 'seat_count',
      quantity: activeUsers,
      description: `Active seats count: ${activeUsers}`
    });
  }

  static async getUsageForPeriod(tenantId: string, billingPeriod?: string) {
    const period = billingPeriod || this.getCurrentBillingPeriod();

    return await prisma.usageRecord.findMany({
      where: {
        tenantId,
        billingPeriod: period
      },
      orderBy: { recordDate: 'desc' }
    });
  }

  static async getUsageSummary(tenantId: string, billingPeriod?: string) {
    const period = billingPeriod || this.getCurrentBillingPeriod();

    const usage = await prisma.usageRecord.groupBy({
      by: ['recordType'],
      where: {
        tenantId,
        billingPeriod: period
      },
      _sum: {
        quantity: true
      }
    });

    return usage.reduce((acc, item) => {
      acc[item.recordType] = item._sum.quantity || 0;
      return acc;
    }, {} as Record<string, number>);
  }

  static async calculateOverageCharges(tenantId: string, billingPeriod?: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { tenant: true }
    });

    if (!subscription) {
      throw new Error('No subscription found');
    }

    const usage = await this.getUsageSummary(tenantId, billingPeriod);
    const planConfig = await import('./subscription').then(m =>
      m.SubscriptionService.getPlanConfig(subscription.planType)
    );

    if (!planConfig) {
      throw new Error('Invalid plan configuration');
    }

    const overages = {
      calls: 0,
      seats: 0,
      totalOverageAmount: 0
    };

    // Calculate call minute overages (if plan has limits)
    const callMinutes = usage.call_minutes || 0;
    const planCallLimit = planConfig.maxConcurrentCalls * 60 * 24 * 30; // Rough monthly limit
    if (callMinutes > planCallLimit) {
      overages.calls = callMinutes - planCallLimit;
      overages.totalOverageAmount += overages.calls * 0.05; // $0.05 per minute overage
    }

    // Calculate seat overages
    const maxSeats = usage.seat_count || 0;
    if (maxSeats > planConfig.maxExtensions) {
      overages.seats = maxSeats - planConfig.maxExtensions;
      overages.totalOverageAmount += overages.seats * 10; // $10 per additional seat
    }

    return overages;
  }

  static async processPendingUsage(tenantId: string) {
    const pendingRecords = await prisma.usageRecord.findMany({
      where: {
        tenantId,
        processed: false,
        recordType: 'call_minutes'
      }
    });

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!subscription?.stripeSubscriptionId) {
      return;
    }

    for (const record of pendingRecords) {
      try {
        await stripe.subscriptionItems.createUsageRecord(
          subscription.stripeSubscriptionId,
          {
            quantity: Math.ceil(record.quantity),
            timestamp: Math.floor(record.recordDate.getTime() / 1000),
            action: 'increment'
          }
        );

        await prisma.usageRecord.update({
          where: { id: record.id },
          data: { processed: true }
        });
      } catch (error) {
        console.error(`Failed to process usage record ${record.id}:`, error);
      }
    }
  }

  private static getCurrentBillingPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}