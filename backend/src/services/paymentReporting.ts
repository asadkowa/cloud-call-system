import { prisma } from '../config/database';

export interface PaymentReportFilters {
  tenantId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string[];
  paymentMethod?: string[];
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentReportSummary {
  totalAmount: number;
  totalCount: number;
  successfulAmount: number;
  successfulCount: number;
  failedAmount: number;
  failedCount: number;
  refundedAmount: number;
  refundedCount: number;
  averageAmount: number;
  paymentMethodBreakdown: Record<string, { count: number; amount: number }>;
  statusBreakdown: Record<string, { count: number; amount: number }>;
  monthlyTrends: Array<{
    month: string;
    amount: number;
    count: number;
    successRate: number;
  }>;
}

export interface PaymentReportData {
  summary: PaymentReportSummary;
  payments: any[];
  totalPages: number;
  currentPage: number;
}

export class PaymentReportingService {
  // Generate comprehensive payment report
  static async generatePaymentReport(
    filters: PaymentReportFilters,
    page = 1,
    limit = 50
  ): Promise<PaymentReportData> {
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = this.buildWhereClause(filters);

    // Get payments with pagination
    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            description: true,
            total: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Get total count
    const totalCount = await prisma.payment.count({
      where: whereClause
    });

    // Generate summary
    const summary = await this.generatePaymentSummary(filters);

    return {
      summary,
      payments,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  // Generate payment summary statistics
  static async generatePaymentSummary(filters: PaymentReportFilters): Promise<PaymentReportSummary> {
    const whereClause = this.buildWhereClause(filters);

    // Get all payments for summary calculations
    const allPayments = await prisma.payment.findMany({
      where: whereClause,
      select: {
        amount: true,
        status: true,
        paymentMethod: true,
        refundedAmount: true,
        createdAt: true
      }
    });

    const totalAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalCount = allPayments.length;

    const successfulPayments = allPayments.filter(p => p.status === 'succeeded');
    const successfulAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
    const successfulCount = successfulPayments.length;

    const failedPayments = allPayments.filter(p => p.status === 'failed');
    const failedAmount = failedPayments.reduce((sum, p) => sum + p.amount, 0);
    const failedCount = failedPayments.length;

    const refundedAmount = allPayments.reduce((sum, p) => sum + (p.refundedAmount || 0), 0);
    const refundedCount = allPayments.filter(p => (p.refundedAmount || 0) > 0).length;

    const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    // Payment method breakdown
    const paymentMethodBreakdown: Record<string, { count: number; amount: number }> = {};
    allPayments.forEach(payment => {
      const method = payment.paymentMethod || 'unknown';
      if (!paymentMethodBreakdown[method]) {
        paymentMethodBreakdown[method] = { count: 0, amount: 0 };
      }
      paymentMethodBreakdown[method].count++;
      paymentMethodBreakdown[method].amount += payment.amount;
    });

    // Status breakdown
    const statusBreakdown: Record<string, { count: number; amount: number }> = {};
    allPayments.forEach(payment => {
      const status = payment.status;
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = { count: 0, amount: 0 };
      }
      statusBreakdown[status].count++;
      statusBreakdown[status].amount += payment.amount;
    });

    // Monthly trends
    const monthlyTrends = await this.generateMonthlyTrends(filters);

    return {
      totalAmount,
      totalCount,
      successfulAmount,
      successfulCount,
      failedAmount,
      failedCount,
      refundedAmount,
      refundedCount,
      averageAmount,
      paymentMethodBreakdown,
      statusBreakdown,
      monthlyTrends
    };
  }

  // Generate monthly payment trends
  static async generateMonthlyTrends(filters: PaymentReportFilters) {
    try {
      // Get payments for the last 12 months
      const now = new Date();
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const whereConditions: any = {
        createdAt: {
          gte: twelveMonthsAgo,
          lte: now
        }
      };

      if (filters.tenantId) {
        whereConditions.tenantId = filters.tenantId;
      }

      if (filters.startDate) {
        whereConditions.createdAt.gte = filters.startDate;
      }

      if (filters.endDate) {
        whereConditions.createdAt.lte = filters.endDate;
      }

      const payments = await prisma.payment.findMany({
        where: whereConditions,
        select: {
          amount: true,
          status: true,
          createdAt: true
        }
      });

      // Group by month
      const monthlyData: Record<string, { amount: number; count: number; successfulCount: number }> = {};

      payments.forEach(payment => {
        const monthKey = payment.createdAt.toISOString().substring(0, 7); // YYYY-MM

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { amount: 0, count: 0, successfulCount: 0 };
        }

        monthlyData[monthKey].amount += payment.amount;
        monthlyData[monthKey].count += 1;

        if (payment.status === 'succeeded') {
          monthlyData[monthKey].successfulCount += 1;
        }
      });

      return Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          amount: data.amount,
          count: data.count,
          successRate: data.count > 0 ? (data.successfulCount / data.count) * 100 : 0
        }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12);
    } catch (error) {
      console.error('Error generating monthly trends:', error);
      return [];
    }
  }

  // Generate revenue analytics
  static async generateRevenueAnalytics(filters: PaymentReportFilters) {
    const whereClause = this.buildWhereClause(filters);

    // Monthly recurring revenue
    const mrrData = await this.calculateMRR(filters);

    // Annual recurring revenue
    const arr = mrrData.currentMRR * 12;

    // Growth metrics
    const growthMetrics = await this.calculateGrowthMetrics(filters);

    // Customer lifetime value
    const clv = await this.calculateCustomerLifetimeValue(filters);

    return {
      mrr: mrrData,
      arr,
      growth: growthMetrics,
      customerLifetimeValue: clv
    };
  }

  // Calculate Monthly Recurring Revenue
  static async calculateMRR(filters: PaymentReportFilters) {
    const currentMonth = new Date();
    currentMonth.setDate(1); // First day of current month

    const lastMonth = new Date(currentMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Get current month successful subscription payments
    const currentMRR = await prisma.payment.aggregate({
      where: {
        ...this.buildWhereClause(filters),
        status: 'succeeded',
        createdAt: {
          gte: currentMonth
        },
        invoice: {
          subscriptionId: {
            not: null
          }
        }
      },
      _sum: {
        amount: true
      }
    });

    // Get last month MRR for comparison
    const lastMonthMRR = await prisma.payment.aggregate({
      where: {
        ...this.buildWhereClause(filters),
        status: 'succeeded',
        createdAt: {
          gte: lastMonth,
          lt: currentMonth
        },
        invoice: {
          subscriptionId: {
            not: null
          }
        }
      },
      _sum: {
        amount: true
      }
    });

    const currentMRRValue = (currentMRR._sum.amount || 0) / 100; // Convert from cents
    const lastMonthMRRValue = (lastMonthMRR._sum.amount || 0) / 100;
    const mrrGrowth = lastMonthMRRValue > 0
      ? ((currentMRRValue - lastMonthMRRValue) / lastMonthMRRValue) * 100
      : 0;

    return {
      currentMRR: currentMRRValue,
      lastMonthMRR: lastMonthMRRValue,
      growth: mrrGrowth
    };
  }

  // Calculate growth metrics
  static async calculateGrowthMetrics(filters: PaymentReportFilters) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Revenue growth (last 30 days vs previous 30 days)
    const last30Days = await prisma.payment.aggregate({
      where: {
        ...this.buildWhereClause(filters),
        status: 'succeeded',
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      _sum: { amount: true }
    });

    const previous30Days = await prisma.payment.aggregate({
      where: {
        ...this.buildWhereClause(filters),
        status: 'succeeded',
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo
        }
      },
      _sum: { amount: true }
    });

    const revenueGrowth = (previous30Days._sum.amount || 0) > 0
      ? (((last30Days._sum.amount || 0) - (previous30Days._sum.amount || 0)) / (previous30Days._sum.amount || 0)) * 100
      : 0;

    return {
      revenueGrowth,
      last30DaysRevenue: (last30Days._sum.amount || 0) / 100,
      previous30DaysRevenue: (previous30Days._sum.amount || 0) / 100
    };
  }

  // Calculate Customer Lifetime Value
  static async calculateCustomerLifetimeValue(filters: PaymentReportFilters) {
    // Average revenue per customer
    const avgRevenuePerCustomer = await prisma.payment.groupBy({
      by: ['tenantId'],
      where: {
        ...this.buildWhereClause(filters),
        status: 'succeeded'
      },
      _sum: {
        amount: true
      }
    });

    const totalCustomers = avgRevenuePerCustomer.length;
    const totalRevenue = avgRevenuePerCustomer.reduce((sum, customer) =>
      sum + (customer._sum.amount || 0), 0
    );

    const avgRevenuePerCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Estimate average customer lifespan (in months)
    // This is a simplified calculation - in practice, you'd want more sophisticated cohort analysis
    const avgCustomerLifespan = 24; // months - could be calculated from actual data

    return {
      averageRevenuePerCustomer: avgRevenuePerCustomerValue / 100,
      averageCustomerLifespan,
      customerLifetimeValue: (avgRevenuePerCustomerValue / 100) * avgCustomerLifespan
    };
  }

  // Build where clause for filtering
  private static buildWhereClause(filters: PaymentReportFilters) {
    const where: any = {};

    if (filters.tenantId) {
      where.tenantId = filters.tenantId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters.status && filters.status.length > 0) {
      where.status = {
        in: filters.status
      };
    }

    if (filters.paymentMethod && filters.paymentMethod.length > 0) {
      where.paymentMethod = {
        in: filters.paymentMethod
      };
    }

    if (filters.minAmount || filters.maxAmount) {
      where.amount = {};
      if (filters.minAmount) {
        where.amount.gte = filters.minAmount * 100; // Convert to cents
      }
      if (filters.maxAmount) {
        where.amount.lte = filters.maxAmount * 100; // Convert to cents
      }
    }

    return where;
  }

  // Export payment data to CSV
  static async exportPaymentsToCSV(filters: PaymentReportFilters): Promise<string> {
    const whereClause = this.buildWhereClause(filters);

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            description: true
          }
        },
        tenant: {
          select: {
            name: true,
            domain: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // CSV headers
    const headers = [
      'Payment ID',
      'Tenant',
      'Invoice Number',
      'Amount',
      'Currency',
      'Status',
      'Payment Method',
      'Description',
      'Created At',
      'Paid At',
      'Refunded Amount'
    ];

    // CSV rows
    const rows = payments.map(payment => [
      payment.id,
      payment.tenant?.name || 'N/A',
      payment.invoice?.invoiceNumber || 'N/A',
      (payment.amount / 100).toFixed(2),
      payment.currency.toUpperCase(),
      payment.status,
      payment.paymentMethod || 'N/A',
      payment.description || 'N/A',
      payment.createdAt.toISOString(),
      payment.paidAt?.toISOString() || 'N/A',
      ((payment.refundedAmount || 0) / 100).toFixed(2)
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }
}