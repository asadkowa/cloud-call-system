import { prisma } from '../config/database';
import { UsageService } from './usage';

export interface CreateCallData {
  fromNumber: string;
  toNumber: string;
  direction: 'inbound' | 'outbound';
  extensionId?: string;
  queueId?: string;
  agentId?: string;
}

export interface UpdateCallData {
  status?: 'ringing' | 'answered' | 'busy' | 'failed' | 'completed' | 'transferred';
  endTime?: Date;
  duration?: number;
  recordingUrl?: string;
  agentId?: string;
}

export class CallService {
  static async getCallsByTenant(tenantId: string, limit = 50, offset = 0) {
    return await prisma.call.findMany({
      where: { tenantId },
      include: {
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true
          }
        },
        queue: {
          select: {
            id: true,
            name: true,
            extension: true
          }
        },
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { startTime: 'desc' },
      take: limit,
      skip: offset
    });
  }

  static async getActiveCallsByTenant(tenantId: string) {
    return await prisma.call.findMany({
      where: {
        tenantId,
        status: { in: ['ringing', 'answered'] }
      },
      include: {
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true
          }
        },
        queue: {
          select: {
            id: true,
            name: true,
            extension: true
          }
        },
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });
  }

  static async getCallById(id: string, tenantId: string) {
    const call = await prisma.call.findFirst({
      where: { id, tenantId },
      include: {
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true
          }
        },
        queue: {
          select: {
            id: true,
            name: true,
            extension: true
          }
        },
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!call) {
      throw new Error('Call not found');
    }

    return call;
  }

  static async createCall(data: CreateCallData, tenantId: string) {
    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Verify extension exists if provided
    if (data.extensionId) {
      const extension = await prisma.extension.findFirst({
        where: {
          id: data.extensionId,
          tenantId
        }
      });

      if (!extension) {
        throw new Error('Extension not found');
      }
    }

    // Verify queue exists if provided
    if (data.queueId) {
      const queue = await prisma.queue.findFirst({
        where: {
          id: data.queueId,
          tenantId
        }
      });

      if (!queue) {
        throw new Error('Queue not found');
      }
    }

    // Verify agent exists if provided
    if (data.agentId) {
      const agent = await prisma.user.findFirst({
        where: {
          id: data.agentId,
          tenantId,
          role: { in: ['agent', 'supervisor', 'admin'] }
        }
      });

      if (!agent) {
        throw new Error('Agent not found');
      }
    }

    return await prisma.call.create({
      data: {
        tenantId,
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        direction: data.direction,
        status: 'ringing',
        extensionId: data.extensionId,
        queueId: data.queueId,
        agentId: data.agentId
      },
      include: {
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true
          }
        },
        queue: {
          select: {
            id: true,
            name: true,
            extension: true
          }
        },
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });
  }

  static async updateCall(id: string, data: UpdateCallData, tenantId: string) {
    const call = await prisma.call.findFirst({
      where: { id, tenantId }
    });

    if (!call) {
      throw new Error('Call not found');
    }

    // Calculate duration if call is ending
    let updateData = { ...data };
    if (data.status === 'completed' || data.status === 'failed') {
      if (!data.endTime) {
        updateData.endTime = new Date();
      }

      if (!data.duration && call.startTime) {
        const endTime = updateData.endTime || new Date();
        updateData.duration = Math.floor((endTime.getTime() - call.startTime.getTime()) / 1000);
      }
    }

    const updatedCall = await prisma.call.update({
      where: { id },
      data: updateData,
      include: {
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true
          }
        },
        queue: {
          select: {
            id: true,
            name: true,
            extension: true
          }
        },
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Record usage for completed calls
    if (data.status === 'completed' && updateData.duration && updateData.duration > 0) {
      try {
        await UsageService.recordCallUsage(tenantId, id, updateData.duration);
      } catch (error) {
        console.error('Failed to record call usage:', error);
      }
    }

    return updatedCall;
  }

  static async transferCall(id: string, targetExtensionId: string, tenantId: string) {
    const call = await prisma.call.findFirst({
      where: { id, tenantId }
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.status !== 'answered') {
      throw new Error('Can only transfer answered calls');
    }

    // Verify target extension exists
    const targetExtension = await prisma.extension.findFirst({
      where: {
        id: targetExtensionId,
        tenantId,
        status: 'active'
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!targetExtension) {
      throw new Error('Target extension not found or inactive');
    }

    // Update call with transfer information
    return await prisma.call.update({
      where: { id },
      data: {
        status: 'transferred',
        extensionId: targetExtensionId,
        agentId: targetExtension.user?.id || null
      },
      include: {
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true
          }
        },
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });
  }

  static async getCallsByAgent(agentId: string, tenantId: string, limit = 20) {
    return await prisma.call.findMany({
      where: {
        agentId,
        tenantId
      },
      include: {
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true
          }
        },
        queue: {
          select: {
            id: true,
            name: true,
            extension: true
          }
        }
      },
      orderBy: { startTime: 'desc' },
      take: limit
    });
  }

  static async getCallsByExtension(extensionId: string, tenantId: string, limit = 20) {
    return await prisma.call.findMany({
      where: {
        extensionId,
        tenantId
      },
      include: {
        queue: {
          select: {
            id: true,
            name: true,
            extension: true
          }
        },
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { startTime: 'desc' },
      take: limit
    });
  }

  static async getCallStats(tenantId: string, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const whereClause: any = { tenantId };
    if (Object.keys(dateFilter).length > 0) {
      whereClause.startTime = dateFilter;
    }

    const [
      totalCalls,
      activeCalls,
      callsByStatus,
      callsByDirection,
      averageDuration,
      totalDuration
    ] = await Promise.all([
      prisma.call.count({ where: whereClause }),
      prisma.call.count({
        where: {
          tenantId,
          status: { in: ['ringing', 'answered'] }
        }
      }),
      prisma.call.groupBy({
        by: ['status'],
        where: whereClause,
        _count: true
      }),
      prisma.call.groupBy({
        by: ['direction'],
        where: whereClause,
        _count: true
      }),
      prisma.call.aggregate({
        where: {
          ...whereClause,
          duration: { not: null }
        },
        _avg: { duration: true }
      }),
      prisma.call.aggregate({
        where: {
          ...whereClause,
          duration: { not: null }
        },
        _sum: { duration: true }
      })
    ]);

    return {
      totalCalls,
      activeCalls,
      callsByStatus: callsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      callsByDirection: callsByDirection.reduce((acc, item) => {
        acc[item.direction] = item._count;
        return acc;
      }, {} as Record<string, number>),
      averageDuration: Math.round(averageDuration._avg.duration || 0),
      totalDuration: totalDuration._sum.duration || 0
    };
  }

  static async getTodayStats(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.getCallStats(tenantId, today, tomorrow);
  }
}