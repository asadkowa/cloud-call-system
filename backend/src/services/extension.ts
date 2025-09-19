import { prisma } from '../config/database';

export interface CreateExtensionData {
  number: string;
  displayName: string;
  type: 'user' | 'queue' | 'conference' | 'ivr';
  config?: ExtensionConfig;
}

export interface UpdateExtensionData {
  displayName?: string;
  type?: 'user' | 'queue' | 'conference' | 'ivr';
  status?: 'active' | 'inactive' | 'busy' | 'unavailable';
  config?: ExtensionConfig;
}

export interface ExtensionConfig {
  voicemail?: boolean;
  callForwarding?: string;
  callWaiting?: boolean;
  doNotDisturb?: boolean;
  recordCalls?: boolean;
  ringTimeout?: number;
  followMeNumbers?: string[];
}

export class ExtensionService {
  static async getExtensionsByTenant(tenantId: string) {
    return await prisma.extension.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        },
        calls: {
          where: {
            status: { in: ['ringing', 'answered'] }
          },
          select: {
            id: true,
            fromNumber: true,
            toNumber: true,
            direction: true,
            status: true,
            startTime: true
          }
        }
      },
      orderBy: { number: 'asc' }
    });
  }

  static async getExtensionById(id: string, tenantId: string) {
    const extension = await prisma.extension.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        },
        calls: {
          orderBy: { startTime: 'desc' },
          take: 10,
          select: {
            id: true,
            fromNumber: true,
            toNumber: true,
            direction: true,
            status: true,
            startTime: true,
            endTime: true,
            duration: true,
            recordingUrl: true
          }
        }
      }
    });

    if (!extension) {
      throw new Error('Extension not found');
    }

    return extension;
  }

  static async getExtensionByNumber(number: string, tenantId: string) {
    return await prisma.extension.findFirst({
      where: { number, tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        }
      }
    });
  }

  static async createExtension(data: CreateExtensionData, tenantId: string) {
    // Check if extension number already exists
    const existingExtension = await prisma.extension.findFirst({
      where: {
        number: data.number,
        tenantId
      }
    });

    if (existingExtension) {
      throw new Error('Extension number already exists');
    }

    // Verify tenant exists and get limits
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: { extensions: true }
        }
      }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Check extension limit
    if (tenant._count.extensions >= tenant.maxExtensions) {
      throw new Error(`Extension limit reached. Maximum ${tenant.maxExtensions} extensions allowed.`);
    }

    // Set default config
    const defaultConfig = {
      voicemail: true,
      callWaiting: true,
      doNotDisturb: false,
      recordCalls: false,
      ringTimeout: 30,
      followMeNumbers: []
    };

    const config = { ...defaultConfig, ...data.config };

    return await prisma.extension.create({
      data: {
        tenantId,
        number: data.number,
        displayName: data.displayName,
        type: data.type,
        config: JSON.stringify(config)
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        }
      }
    });
  }

  static async updateExtension(id: string, data: UpdateExtensionData, tenantId: string) {
    const extension = await prisma.extension.findFirst({
      where: { id, tenantId }
    });

    if (!extension) {
      throw new Error('Extension not found');
    }

    let updateData: any = { ...data };

    // Handle config updates
    if (data.config) {
      const currentConfig = extension.config ? JSON.parse(extension.config as string) : {};
      const newConfig = { ...currentConfig, ...data.config };
      updateData.config = JSON.stringify(newConfig);
    }

    return await prisma.extension.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        }
      }
    });
  }

  static async deleteExtension(id: string, tenantId: string) {
    const extension = await prisma.extension.findFirst({
      where: { id, tenantId },
      include: {
        user: true
      }
    });

    if (!extension) {
      throw new Error('Extension not found');
    }

    // Check if extension is in use
    if (extension.user) {
      throw new Error('Cannot delete extension that is assigned to a user');
    }

    // Check for active calls
    const activeCalls = await prisma.call.count({
      where: {
        extensionId: id,
        status: { in: ['ringing', 'answered'] }
      }
    });

    if (activeCalls > 0) {
      throw new Error('Cannot delete extension with active calls');
    }

    return await prisma.extension.delete({
      where: { id }
    });
  }

  static async assignUserToExtension(extensionId: string, userId: string, tenantId: string) {
    // Verify extension exists and is unassigned
    const extension = await prisma.extension.findFirst({
      where: {
        id: extensionId,
        tenantId,
        user: null
      }
    });

    if (!extension) {
      throw new Error('Extension not found or already assigned');
    }

    // Verify user exists and has no extension
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        extensionId: null
      }
    });

    if (!user) {
      throw new Error('User not found or already has an extension');
    }

    // Assign extension to user
    return await prisma.user.update({
      where: { id: userId },
      data: { extensionId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true,
            status: true
          }
        }
      }
    });
  }

  static async unassignUserFromExtension(extensionId: string, tenantId: string) {
    const extension = await prisma.extension.findFirst({
      where: { id: extensionId, tenantId },
      include: { user: true }
    });

    if (!extension) {
      throw new Error('Extension not found');
    }

    if (!extension.user) {
      throw new Error('Extension is not assigned to any user');
    }

    // Unassign user from extension
    return await prisma.user.update({
      where: { id: extension.user.id },
      data: { extensionId: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });
  }

  static async getAvailableExtensions(tenantId: string) {
    return await prisma.extension.findMany({
      where: {
        tenantId,
        user: null,
        type: 'user',
        status: 'active'
      },
      select: {
        id: true,
        number: true,
        displayName: true,
        type: true,
        status: true
      },
      orderBy: { number: 'asc' }
    });
  }

  static async getExtensionStats(tenantId: string) {
    const [
      totalExtensions,
      activeExtensions,
      extensionsByType,
      assignedExtensions,
      extensionsWithActiveCalls
    ] = await Promise.all([
      prisma.extension.count({
        where: { tenantId }
      }),
      prisma.extension.count({
        where: { tenantId, status: 'active' }
      }),
      prisma.extension.groupBy({
        by: ['type'],
        where: { tenantId },
        _count: true
      }),
      prisma.extension.count({
        where: {
          tenantId,
          user: { isNot: null }
        }
      }),
      prisma.extension.count({
        where: {
          tenantId,
          calls: {
            some: {
              status: { in: ['ringing', 'answered'] }
            }
          }
        }
      })
    ]);

    return {
      totalExtensions,
      activeExtensions,
      inactiveExtensions: totalExtensions - activeExtensions,
      extensionsByType: extensionsByType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>),
      assignedExtensions,
      unassignedExtensions: totalExtensions - assignedExtensions,
      extensionsWithActiveCalls
    };
  }
}