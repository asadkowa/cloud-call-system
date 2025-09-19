import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'superadmin' | 'company_admin' | 'agent' | 'supervisor' | 'user';
  extensionId?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  role?: 'superadmin' | 'company_admin' | 'agent' | 'supervisor' | 'user';
  extensionId?: string;
  isActive?: boolean;
}

export class UserService {
  static async getUsersByTenant(tenantId: string) {
    return await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getUserById(id: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        tenantId
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true,
            type: true,
            status: true,
            config: true
          }
        },
        agentQueues: {
          include: {
            queue: {
              select: {
                id: true,
                name: true,
                extension: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  static async createUser(data: CreateUserData, tenantId: string) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Verify tenant exists and get limits
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Check user limit
    if (tenant._count.users >= tenant.maxExtensions) {
      throw new Error(`User limit reached. Maximum ${tenant.maxExtensions} users allowed.`);
    }

    // Verify extension if provided
    if (data.extensionId) {
      const extension = await prisma.extension.findFirst({
        where: {
          id: data.extensionId,
          tenantId,
          user: null // Extension must be unassigned
        }
      });

      if (!extension) {
        throw new Error('Extension not found or already assigned');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    return await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        tenantId,
        extensionId: data.extensionId
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
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

  static async updateUser(id: string, data: UpdateUserData, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id, tenantId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify extension if being updated
    if (data.extensionId) {
      const extension = await prisma.extension.findFirst({
        where: {
          id: data.extensionId,
          tenantId,
          OR: [
            { user: null },
            { userId: id } // Allow current user's extension
          ]
        }
      });

      if (!extension) {
        throw new Error('Extension not found or already assigned');
      }
    }

    return await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
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

  static async deleteUser(id: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id, tenantId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Soft delete by deactivating
    return await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        extensionId: null // Unassign extension
      }
    });
  }

  static async changePassword(id: string, currentPassword: string, newPassword: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id, tenantId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    return { message: 'Password updated successfully' };
  }

  static async getUserStats(tenantId: string) {
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      usersWithExtensions
    ] = await Promise.all([
      prisma.user.count({
        where: { tenantId }
      }),
      prisma.user.count({
        where: { tenantId, isActive: true }
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: { tenantId, isActive: true },
        _count: true
      }),
      prisma.user.count({
        where: {
          tenantId,
          isActive: true,
          extensionId: { not: null }
        }
      })
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {} as Record<string, number>),
      usersWithExtensions
    };
  }

  // SUPERADMIN METHODS

  static async getAllUsersAcrossTenants(options: {
    tenantId?: string;
    role?: string;
    limit: number;
    offset: number;
  }) {
    const { tenantId, role, limit, offset } = options;

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (role) where.role = role;

    return await prisma.user.findMany({
      where,
      take: limit,
      skip: offset,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
            planType: true
          }
        },
        extension: {
          select: {
            id: true,
            number: true,
            displayName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createSuperAdminUser(data: Omit<CreateUserData, 'role'>) {
    const hashedPassword = await bcrypt.hash(data.password, 12);

    return await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'superadmin',
        tenantId: 'platform', // Special tenant ID for superadmins
        isActive: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
        createdAt: true
      }
    });
  }
}