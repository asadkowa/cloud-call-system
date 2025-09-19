import { prisma } from '../config/database';
import { PaymentService } from './payment';

export interface PaymentRetryOptions {
  maxRetries?: number;
  retryDelayMinutes?: number;
  exponentialBackoff?: boolean;
  retryReasons?: string[];
}

export interface PaymentRetryAttempt {
  id: string;
  paymentId: string;
  attemptNumber: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  errorMessage?: string;
  scheduledAt: Date;
  processedAt?: Date;
  createdAt: Date;
}

export class PaymentRetryService {
  private static readonly DEFAULT_OPTIONS: PaymentRetryOptions = {
    maxRetries: 3,
    retryDelayMinutes: 60, // 1 hour
    exponentialBackoff: true,
    retryReasons: [
      'insufficient_funds',
      'card_declined',
      'processing_error',
      'network_error',
      'rate_limit_exceeded'
    ]
  };

  // Create a retry schedule for a failed payment
  static async schedulePaymentRetry(
    paymentId: string,
    reason: string,
    options: PaymentRetryOptions = {}
  ): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Check if this payment should be retried
    if (!opts.retryReasons?.includes(reason)) {
      console.log(`Payment ${paymentId} not eligible for retry. Reason: ${reason}`);
      return;
    }

    // Get existing retry attempts
    const existingAttempts = await prisma.paymentRetryAttempt.count({
      where: { paymentId }
    });

    if (existingAttempts >= opts.maxRetries!) {
      console.log(`Payment ${paymentId} has exceeded max retry attempts (${opts.maxRetries})`);

      // Mark payment as permanently failed
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'failed',
          failureReason: `Max retry attempts exceeded. Last reason: ${reason}`
        }
      });
      return;
    }

    // Calculate next retry time
    const nextAttemptNumber = existingAttempts + 1;
    const delayMinutes = opts.exponentialBackoff
      ? opts.retryDelayMinutes! * Math.pow(2, existingAttempts)
      : opts.retryDelayMinutes!;

    const scheduledAt = new Date();
    scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes);

    // Create retry attempt record
    await prisma.paymentRetryAttempt.create({
      data: {
        paymentId,
        attemptNumber: nextAttemptNumber,
        status: 'pending',
        errorMessage: reason,
        scheduledAt,
        createdAt: new Date()
      }
    });

    console.log(`Payment retry scheduled for ${paymentId}, attempt ${nextAttemptNumber} at ${scheduledAt}`);
  }

  // Process pending payment retries
  static async processRetries(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  }> {
    const now = new Date();

    // Get pending retries that are ready to be processed
    const pendingRetries = await prisma.paymentRetryAttempt.findMany({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: now
        }
      },
      include: {
        payment: {
          include: {
            invoice: true,
            tenant: true
          }
        }
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    });

    console.log(`Processing ${pendingRetries.length} payment retries...`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const retry of pendingRetries) {
      try {
        results.processed++;

        // Mark as processing
        await prisma.paymentRetryAttempt.update({
          where: { id: retry.id },
          data: {
            status: 'processing',
            processedAt: new Date()
          }
        });

        console.log(`Retrying payment ${retry.paymentId}, attempt ${retry.attemptNumber}`);

        // Attempt to process the payment again
        const payment = retry.payment;
        const retryResult = await this.retryPaymentProcessing(payment);

        if (retryResult.success) {
          // Mark retry as succeeded
          await prisma.paymentRetryAttempt.update({
            where: { id: retry.id },
            data: { status: 'succeeded' }
          });

          // Update original payment
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'succeeded',
              paidAt: new Date(),
              failureReason: null
            }
          });

          results.succeeded++;
          console.log(`✅ Payment retry succeeded for ${retry.paymentId}`);

        } else {
          // Mark retry as failed
          await prisma.paymentRetryAttempt.update({
            where: { id: retry.id },
            data: {
              status: 'failed',
              errorMessage: retryResult.error
            }
          });

          // Schedule next retry if applicable
          await this.schedulePaymentRetry(payment.id, retryResult.error || 'retry_failed');

          results.failed++;
          console.log(`❌ Payment retry failed for ${retry.paymentId}: ${retryResult.error}`);
        }

      } catch (error: any) {
        console.error(`Error processing retry ${retry.id}:`, error);
        results.errors.push(`Retry ${retry.id}: ${error.message}`);

        // Mark retry as failed
        await prisma.paymentRetryAttempt.update({
          where: { id: retry.id },
          data: {
            status: 'failed',
            errorMessage: error.message
          }
        });
      }
    }

    return results;
  }

  // Retry payment processing with updated logic
  private static async retryPaymentProcessing(payment: any): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get fresh payment methods for the tenant
      const paymentMethods = await PaymentService.getPaymentMethods(payment.tenantId);

      if (paymentMethods.length === 0) {
        return {
          success: false,
          error: 'no_payment_method'
        };
      }

      // Try each payment method until one succeeds
      for (const paymentMethod of paymentMethods) {
        try {
          const retryPayment = await PaymentService.processPayment({
            amount: payment.amount,
            currency: payment.currency,
            description: `Retry: ${payment.description}`,
            paymentMethod: {
              type: 'card',
              stripePaymentMethodId: paymentMethod.id
            },
            tenantId: payment.tenantId,
            invoiceId: payment.invoiceId
          });

          if (retryPayment.status === 'succeeded') {
            return { success: true };
          }

        } catch (methodError: any) {
          console.log(`Payment method ${paymentMethod.id} failed, trying next...`);
          continue;
        }
      }

      return {
        success: false,
        error: 'all_payment_methods_failed'
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get retry statistics for a payment
  static async getPaymentRetryStatus(paymentId: string): Promise<{
    totalAttempts: number;
    lastAttempt?: PaymentRetryAttempt;
    nextScheduled?: Date;
    canRetry: boolean;
  }> {
    const attempts = await prisma.paymentRetryAttempt.findMany({
      where: { paymentId },
      orderBy: { attemptNumber: 'desc' }
    });

    const totalAttempts = attempts.length;
    const lastAttempt = attempts[0] || null;

    // Find next scheduled retry
    const nextScheduled = await prisma.paymentRetryAttempt.findFirst({
      where: {
        paymentId,
        status: 'pending'
      },
      orderBy: { scheduledAt: 'asc' }
    });

    return {
      totalAttempts,
      lastAttempt,
      nextScheduled: nextScheduled?.scheduledAt,
      canRetry: totalAttempts < this.DEFAULT_OPTIONS.maxRetries!
    };
  }

  // Cancel pending retries for a payment
  static async cancelRetries(paymentId: string): Promise<number> {
    const result = await prisma.paymentRetryAttempt.updateMany({
      where: {
        paymentId,
        status: 'pending'
      },
      data: {
        status: 'failed',
        errorMessage: 'cancelled',
        processedAt: new Date()
      }
    });

    console.log(`Cancelled ${result.count} pending retries for payment ${paymentId}`);
    return result.count;
  }

  // Manual retry trigger (admin only)
  static async triggerManualRetry(paymentId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
        tenant: true
      }
    });

    if (!payment) {
      return {
        success: false,
        message: 'Payment not found'
      };
    }

    if (payment.status === 'succeeded') {
      return {
        success: false,
        message: 'Payment already succeeded'
      };
    }

    // Check retry eligibility
    const retryStatus = await this.getPaymentRetryStatus(paymentId);
    if (!retryStatus.canRetry) {
      return {
        success: false,
        message: 'Payment has exceeded maximum retry attempts'
      };
    }

    // Cancel existing pending retries
    await this.cancelRetries(paymentId);

    // Schedule immediate retry
    await prisma.paymentRetryAttempt.create({
      data: {
        paymentId,
        attemptNumber: retryStatus.totalAttempts + 1,
        status: 'pending',
        errorMessage: 'manual_retry',
        scheduledAt: new Date(), // Immediate
        createdAt: new Date()
      }
    });

    return {
      success: true,
      message: 'Manual retry scheduled successfully'
    };
  }

  // Get retry statistics for reporting
  static async getRetryStatistics(days = 30): Promise<{
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    pendingRetries: number;
    successRate: number;
    averageAttemptsToSuccess: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const retries = await prisma.paymentRetryAttempt.findMany({
      where: {
        createdAt: {
          gte: since
        }
      }
    });

    const totalRetries = retries.length;
    const successfulRetries = retries.filter(r => r.status === 'succeeded').length;
    const failedRetries = retries.filter(r => r.status === 'failed').length;
    const pendingRetries = retries.filter(r => r.status === 'pending').length;

    const successRate = totalRetries > 0 ? (successfulRetries / totalRetries) * 100 : 0;

    // Calculate average attempts to success
    const successfulPayments = await prisma.paymentRetryAttempt.groupBy({
      by: ['paymentId'],
      where: {
        createdAt: { gte: since },
        status: 'succeeded'
      },
      _max: {
        attemptNumber: true
      }
    });

    const averageAttemptsToSuccess = successfulPayments.length > 0
      ? successfulPayments.reduce((sum, p) => sum + (p._max.attemptNumber || 0), 0) / successfulPayments.length
      : 0;

    return {
      totalRetries,
      successfulRetries,
      failedRetries,
      pendingRetries,
      successRate,
      averageAttemptsToSuccess
    };
  }

  // Start automated retry processing
  static startAutomatedRetryProcessing() {
    console.log('🔄 Payment retry service initialized (manual trigger mode)');

    // TODO: Implement actual cron scheduling when node-cron is available
    console.log('ℹ️  Use /api/payment-retry/process for manual retry processing');

    // TODO: Enable cron scheduling when node-cron is properly installed
    // Process retries every 15 minutes automatically
  }
}

// Auto-start retry processing if not in development
if (process.env.NODE_ENV !== 'development') {
  PaymentRetryService.startAutomatedRetryProcessing();
}