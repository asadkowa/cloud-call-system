import { prisma } from '../config/database';

export interface CreateTenantData {
  name: string;
  domain: string;
  planType: 'basic' | 'professional' | 'enterprise';
  maxExtensions?: number;
  maxConcurrentCalls?: number;
}

export interface UpdateTenantData {
  name?: string;
  planType?: 'basic' | 'professional' | 'enterprise';
  maxExtensions?: number;
  maxConcurrentCalls?: number;
  isActive?: boolean;
}

export class TenantService {
  static async getAllTenants(options?: {
    limit?: number;
    offset?: number;
    includeInactive?: boolean;
  }) {
    const { limit, offset, includeInactive = false } = options || {};

    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    return await prisma.tenant.findMany({
      where,
      ...(limit && { take: limit }),
      ...(offset && { skip: offset }),
      include: {
        _count: {
          select: {
            users: true,
            extensions: true,
            calls: true
          }
        },
        subscription: {
          select: {
            id: true,
            status: true,
            planType: true,
            currentPeriodEnd: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getTenantById(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        },
        extensions: true,
        queues: true,
        _count: {
          select: {
            calls: true
          }
        }
      }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return tenant;
  }

  static async getTenantByDomain(domain: string) {
    return await prisma.tenant.findUnique({
      where: { domain }
    });
  }

  static async createTenant(data: CreateTenantData) {
    // Check if domain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { domain: data.domain }
    });

    if (existingTenant) {
      throw new Error('Domain already exists');
    }

    // Set plan limits based on plan type
    const planLimits = this.getPlanLimits(data.planType);

    return await prisma.tenant.create({
      data: {
        name: data.name,
        domain: data.domain,
        planType: data.planType,
        maxExtensions: data.maxExtensions || planLimits.maxExtensions,
        maxConcurrentCalls: data.maxConcurrentCalls || planLimits.maxConcurrentCalls,
        features: JSON.stringify(planLimits.features)
      },
      include: {
        _count: {
          select: {
            users: true,
            extensions: true,
            calls: true
          }
        }
      }
    });
  }

  static async updateTenant(id: string, data: UpdateTenantData) {
    const tenant = await prisma.tenant.findUnique({
      where: { id }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // If changing plan type, update limits
    let updateData = { ...data };
    if (data.planType && data.planType !== tenant.planType) {
      const planLimits = this.getPlanLimits(data.planType);
      updateData = {
        ...updateData,
        maxExtensions: data.maxExtensions || planLimits.maxExtensions,
        maxConcurrentCalls: data.maxConcurrentCalls || planLimits.maxConcurrentCalls,
        features: JSON.stringify(planLimits.features)
      };
    }

    return await prisma.tenant.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true,
            extensions: true,
            calls: true
          }
        }
      }
    });
  }

  static async deleteTenant(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            extensions: true,
            calls: true
          }
        }
      }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Check if tenant has active users or extensions
    if (tenant._count.users > 0) {
      throw new Error('Cannot delete tenant with active users. Remove all users first.');
    }

    if (tenant._count.extensions > 0) {
      throw new Error('Cannot delete tenant with active extensions. Remove all extensions first.');
    }

    // Delete the tenant (cascade will handle related records)
    return await prisma.tenant.delete({
      where: { id }
    });
  }

  static async getTenantStats(tenantId: string) {
    const [
      userCount,
      extensionCount,
      activeCallCount,
      queueCount,
      totalCallsToday
    ] = await Promise.all([
      prisma.user.count({
        where: { tenantId, isActive: true }
      }),
      prisma.extension.count({
        where: { tenantId, status: 'active' }
      }),
      prisma.call.count({
        where: {
          tenantId,
          status: { in: ['ringing', 'answered'] }
        }
      }),
      prisma.queue.count({
        where: { tenantId, isActive: true }
      }),
      prisma.call.count({
        where: {
          tenantId,
          startTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    return {
      userCount,
      extensionCount,
      activeCallCount,
      queueCount,
      totalCallsToday
    };
  }

  private static getPlanLimits(planType: string) {
    const plans = {
      basic: {
        maxExtensions: 10,
        maxConcurrentCalls: 5,
        features: [
          { name: 'call_routing', enabled: true },
          { name: 'voicemail', enabled: true },
          { name: 'call_recording', enabled: false },
          { name: 'ivr', enabled: false },
          { name: 'queue_management', enabled: false }
        ]
      },
      professional: {
        maxExtensions: 50,
        maxConcurrentCalls: 25,
        features: [
          { name: 'call_routing', enabled: true },
          { name: 'voicemail', enabled: true },
          { name: 'call_recording', enabled: true },
          { name: 'ivr', enabled: true },
          { name: 'queue_management', enabled: true },
          { name: 'reports', enabled: true }
        ]
      },
      enterprise: {
        maxExtensions: 500,
        maxConcurrentCalls: 100,
        features: [
          { name: 'call_routing', enabled: true },
          { name: 'voicemail', enabled: true },
          { name: 'call_recording', enabled: true },
          { name: 'ivr', enabled: true },
          { name: 'queue_management', enabled: true },
          { name: 'reports', enabled: true },
          { name: 'api_access', enabled: true },
          { name: 'sso', enabled: true }
        ]
      }
    };

    return plans[planType as keyof typeof plans] || plans.basic;
  }

  // SUPERADMIN METHODS

  static async getPlatformStats() {
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      activeUsers,
      totalExtensions,
      totalCallsToday,
      totalCallsThisMonth
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.extension.count(),
      prisma.call.count({
        where: {
          startTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.call.count({
        where: {
          startTime: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    // Get tenant stats by plan type
    const tenantsByPlan = await prisma.tenant.groupBy({
      by: ['planType'],
      _count: true,
      where: { isActive: true }
    });

    // Get subscription stats
    const subscriptionStats = await prisma.subscription.groupBy({
      by: ['status'],
      _count: true
    });

    // Get system health status
    const systemHealth = await this.getSystemHealth();

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        byPlan: tenantsByPlan.reduce((acc, item) => {
          acc[item.planType] = item._count;
          return acc;
        }, {} as Record<string, number>)
      },
      users: {
        total: totalUsers,
        active: activeUsers
      },
      extensions: {
        total: totalExtensions
      },
      calls: {
        today: totalCallsToday,
        thisMonth: totalCallsThisMonth
      },
      subscriptions: {
        byStatus: subscriptionStats.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>)
      },
      systemHealth
    };
  }

  static async getSystemHealth() {
    const { pbxService } = require('../services/pbx');
    const { sipServer } = require('../services/sipServer');

    let databaseStatus: 'connected' | 'disconnected';
    let pbxStatus: 'running' | 'down';
    let sipServerStatus: 'running' | 'down';
    let webSocketStatus: 'active' | 'inactive';

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'disconnected';
    }

    // Check PBX service status
    try {
      pbxStatus = pbxService.isInitialized() ? 'running' : 'down';
    } catch (error) {
      pbxStatus = 'down';
    }

    // Check SIP server status
    try {
      sipServerStatus = sipServer.isRunning() ? 'running' : 'down';
    } catch (error) {
      sipServerStatus = 'down';
    }

    // Check WebSocket status (simplified check)
    webSocketStatus = 'active'; // WebSocket is typically active if server is running

    return {
      database: databaseStatus,
      pbx: pbxStatus,
      sipServer: sipServerStatus,
      webSocket: webSocketStatus,
      server: 'running' // Server is running if we can execute this code
    };
  }
}