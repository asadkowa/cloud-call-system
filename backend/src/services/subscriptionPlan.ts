import { prisma } from '../config/database';

export interface CreatePlanData {
  name: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  maxExtensions: number;
  maxConcurrentCalls: number;
  maxUsers: number;
  isActive?: boolean;
  isCustom?: boolean;
}

export interface UpdatePlanData {
  name?: string;
  description?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  features?: string[];
  maxExtensions?: number;
  maxConcurrentCalls?: number;
  maxUsers?: number;
  isActive?: boolean;
}

export class SubscriptionPlanService {
  // Get all plans (admin view)
  static async getAllPlans(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    return await prisma.subscriptionPlan.findMany({
      where,
      orderBy: [
        { isCustom: 'asc' },
        { monthlyPrice: 'asc' }
      ],
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {
                status: 'active'
              }
            }
          }
        }
      }
    });
  }

  // Get active plans for public use
  static async getActivePlans() {
    return await prisma.subscriptionPlan.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        monthlyPrice: 'asc'
      }
    });
  }

  // Get plan by ID
  static async getPlanById(id: string) {
    return await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {
                status: 'active'
              }
            }
          }
        }
      }
    });
  }

  // Create new plan (admin only)
  static async createPlan(data: CreatePlanData) {
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { name: data.name }
    });

    if (existingPlan) {
      throw new Error(`Plan with name "${data.name}" already exists`);
    }

    return await prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        description: data.description,
        monthlyPrice: data.monthlyPrice,
        yearlyPrice: data.yearlyPrice,
        features: JSON.stringify(data.features),
        maxExtensions: data.maxExtensions,
        maxConcurrentCalls: data.maxConcurrentCalls,
        maxUsers: data.maxUsers,
        isActive: data.isActive ?? true,
        isCustom: data.isCustom ?? true
      }
    });
  }

  // Update plan (admin only)
  static async updatePlan(id: string, data: UpdatePlanData) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Check if name already exists (excluding current plan)
    if (data.name && data.name !== plan.name) {
      const existingPlan = await prisma.subscriptionPlan.findUnique({
        where: { name: data.name }
      });

      if (existingPlan) {
        throw new Error(`Plan with name "${data.name}" already exists`);
      }
    }

    const updateData: any = { ...data };
    if (data.features) {
      updateData.features = JSON.stringify(data.features);
    }

    return await prisma.subscriptionPlan.update({
      where: { id },
      data: updateData
    });
  }

  // Delete plan (admin only)
  static async deletePlan(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {
                status: 'active'
              }
            }
          }
        }
      }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    if (plan._count.subscriptions > 0) {
      throw new Error(`Cannot delete plan "${plan.name}" as it has ${plan._count.subscriptions} active subscriptions. Deactivate the plan instead.`);
    }

    return await prisma.subscriptionPlan.delete({
      where: { id }
    });
  }

  // Activate/Deactivate plan
  static async togglePlanStatus(id: string, isActive: boolean) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    return await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive }
    });
  }

  // Assign plan to tenant/user
  static async assignPlanToTenant(tenantId: string, planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    if (!plan.isActive) {
      throw new Error('Cannot assign inactive plan');
    }

    // Check if tenant already has a subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    if (existingSubscription) {
      // Update existing subscription
      return await prisma.subscription.update({
        where: { tenantId },
        data: {
          planId,
          planType: plan.name.toLowerCase(),
          currentPeriodStart,
          currentPeriodEnd,
          status: 'active'
        },
        include: {
          plan: true,
          tenant: true
        }
      });
    } else {
      // Create new subscription
      return await prisma.subscription.create({
        data: {
          tenantId,
          planId,
          planType: plan.name.toLowerCase(),
          currentPeriodStart,
          currentPeriodEnd,
          status: 'active'
        },
        include: {
          plan: true,
          tenant: true
        }
      });
    }
  }

  // Get subscription with plan details
  static async getSubscriptionWithPlan(tenantId: string) {
    return await prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: true,
        tenant: true
      }
    });
  }

  // Seed default plans
  static async seedDefaultPlans() {
    const defaultPlans = [
      {
        name: 'Basic',
        description: 'Perfect for small teams getting started',
        monthlyPrice: 2900,
        yearlyPrice: 29000,
        features: ['call_routing', 'voicemail'],
        maxExtensions: 10,
        maxConcurrentCalls: 5,
        maxUsers: 5,
        isCustom: false
      },
      {
        name: 'Professional',
        description: 'For growing businesses with advanced needs',
        monthlyPrice: 4900,
        yearlyPrice: 49000,
        features: ['call_routing', 'voicemail', 'call_recording', 'ivr', 'queue_management', 'reports'],
        maxExtensions: 50,
        maxConcurrentCalls: 25,
        maxUsers: 25,
        isCustom: false
      },
      {
        name: 'Enterprise',
        description: 'Full-featured solution for large organizations',
        monthlyPrice: 9900,
        yearlyPrice: 99000,
        features: ['call_routing', 'voicemail', 'call_recording', 'ivr', 'queue_management', 'reports', 'api_access', 'sso'],
        maxExtensions: 500,
        maxConcurrentCalls: 100,
        maxUsers: 100,
        isCustom: false
      }
    ];

    for (const planData of defaultPlans) {
      const existingPlan = await prisma.subscriptionPlan.findUnique({
        where: { name: planData.name }
      });

      if (!existingPlan) {
        await prisma.subscriptionPlan.create({
          data: {
            ...planData,
            features: JSON.stringify(planData.features)
          }
        });
      }
    }
  }

  // Parse features from JSON
  static parseFeatures(featuresJson: string): string[] {
    try {
      return JSON.parse(featuresJson);
    } catch {
      return [];
    }
  }

  // Format plan for API response
  static formatPlan(plan: any) {
    return {
      ...plan,
      features: this.parseFeatures(plan.features)
    };
  }
}