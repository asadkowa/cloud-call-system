import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { UsageService } from './usage';
import { SubscriptionService } from './subscription';

export interface CreateInvoiceData {
  tenantId: string;
  subscriptionId?: string;
  description?: string;
  dueDate?: Date;
  items: InvoiceItemData[];
}

export interface InvoiceItemData {
  description: string;
  quantity: number;
  unitAmount: number; // Amount in cents
  priceId?: string;
}

export class InvoiceService {

  static async generateInvoiceForSubscription(tenantId: string, billingPeriod?: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { tenant: true }
    });

    if (!subscription) {
      throw new Error('No subscription found for tenant');
    }

    const period = billingPeriod || this.getCurrentBillingPeriod();
    const planConfig = SubscriptionService.getPlanConfig(subscription.planType);

    if (!planConfig) {
      throw new Error('Invalid plan configuration');
    }

    // Check if invoice already exists for this period
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        tenantId,
        subscriptionId: subscription.id,
        description: { contains: period }
      }
    });

    if (existingInvoice) {
      throw new Error(`Invoice already exists for billing period ${period}`);
    }

    // Get usage data
    const usageSummary = await UsageService.getUsageSummary(tenantId, period);
    const overages = await UsageService.calculateOverageCharges(tenantId, period);

    // Calculate base subscription cost
    const baseAmount = subscription.priceId?.includes('yearly')
      ? planConfig.yearlyPrice
      : planConfig.monthlyPrice;

    const items: InvoiceItemData[] = [
      {
        description: `${planConfig.name} Plan - ${period}`,
        quantity: subscription.quantity,
        unitAmount: baseAmount,
        priceId: subscription.priceId || undefined
      }
    ];

    // Add overage charges
    if (overages.calls > 0) {
      items.push({
        description: `Call minute overages - ${overages.calls} minutes`,
        quantity: overages.calls,
        unitAmount: 5 // $0.05 per minute in cents
      });
    }

    if (overages.seats > 0) {
      items.push({
        description: `Additional seats - ${overages.seats} seats`,
        quantity: overages.seats,
        unitAmount: 1000 // $10 per seat in cents
      });
    }

    return this.createInvoice({
      tenantId,
      subscriptionId: subscription.id,
      description: `Invoice for ${subscription.tenant.name} - ${period}`,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      items
    });
  }

  static async createInvoice(data: CreateInvoiceData) {
    const { tenantId, subscriptionId, description, dueDate, items } = data;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitAmount), 0);
    const tax = Math.round(subtotal * 0.08); // 8% tax rate
    const total = subtotal + tax;

    // Create invoice with items
    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId,
        description,
        subtotal,
        tax,
        total,
        amountDue: total,
        dueDate,
        invoiceItems: {
          create: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitAmount: item.unitAmount,
            amount: item.quantity * item.unitAmount,
            priceId: item.priceId
          }))
        }
      },
      include: {
        invoiceItems: true,
        subscription: true,
        tenant: true
      }
    });

    // Create Stripe invoice if subscription has Stripe integration
    if (subscriptionId) {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId }
      });

      if (subscription?.stripeCustomerId) {
        try {
          const stripeInvoice = await this.createStripeInvoice(invoice, subscription.stripeCustomerId);

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              stripeInvoiceId: stripeInvoice.id,
              invoiceNumber: stripeInvoice.number
            }
          });
        } catch (error) {
          console.error('Failed to create Stripe invoice:', error);
        }
      }
    }

    return invoice;
  }

  private static async createStripeInvoice(invoice: any, stripeCustomerId: string) {
    // Create Stripe invoice
    const stripeInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      description: invoice.description,
      due_date: Math.floor((invoice.dueDate?.getTime() || Date.now()) / 1000),
      metadata: {
        invoiceId: invoice.id,
        tenantId: invoice.tenantId
      }
    });

    // Add invoice items
    for (const item of invoice.invoiceItems) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.unitAmount,
        currency: 'usd'
      });
    }

    // Finalize the invoice
    return await stripe.invoices.finalizeInvoice(stripeInvoice.id);
  }

  static async getInvoicesByTenant(tenantId: string, limit = 50, offset = 0) {
    return await prisma.invoice.findMany({
      where: { tenantId },
      include: {
        invoiceItems: true,
        subscription: {
          select: {
            planType: true,
            priceId: true
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            paidAt: true,
            paymentMethod: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  static async getInvoiceById(id: string, tenantId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        invoiceItems: true,
        subscription: {
          include: {
            tenant: true
          }
        },
        payments: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return invoice;
  }

  static async updateInvoiceStatus(id: string, status: string, tenantId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const updateData: any = { status };

    // Set appropriate timestamps based on status
    if (status === 'paid') {
      updateData.paidAt = new Date();
      updateData.amountPaid = invoice.total;
      updateData.amountDue = 0;
    } else if (status === 'void') {
      updateData.voidedAt = new Date();
      updateData.amountDue = 0;
    }

    return await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        invoiceItems: true,
        subscription: true,
        payments: true
      }
    });
  }

  static async recordPayment(invoiceId: string, amount: number, paymentMethodId?: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'paid') {
      throw new Error('Invoice is already paid');
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        tenantId: invoice.tenantId,
        amount,
        status: 'pending',
        paymentMethod: paymentMethodId ? 'card' : 'manual'
      }
    });

    // Process Stripe payment if payment method provided
    if (paymentMethodId && invoice.stripeInvoiceId) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: 'usd',
          payment_method: paymentMethodId,
          confirm: true,
          metadata: {
            invoiceId,
            paymentId: payment.id
          }
        });

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            stripePaymentIntentId: paymentIntent.id,
            status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
            paidAt: paymentIntent.status === 'succeeded' ? new Date() : null
          }
        });

        // Update invoice if payment succeeded
        if (paymentIntent.status === 'succeeded') {
          await this.updateInvoiceStatus(invoiceId, 'paid', invoice.tenantId);
        }

      } catch (error) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            failedAt: new Date()
          }
        });
        throw error;
      }
    } else {
      // Manual payment - mark as succeeded
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'succeeded',
          paidAt: new Date()
        }
      });

      await this.updateInvoiceStatus(invoiceId, 'paid', invoice.tenantId);
    }

    return payment;
  }

  static async generateMonthlyInvoices() {
    console.log('Generating monthly invoices...');

    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active'
      },
      include: {
        tenant: true
      }
    });

    const results = [];

    for (const subscription of activeSubscriptions) {
      try {
        const invoice = await this.generateInvoiceForSubscription(subscription.tenantId);
        results.push({ tenantId: subscription.tenantId, success: true, invoiceId: invoice.id });
        console.log(`Generated invoice for tenant ${subscription.tenant.name}`);
      } catch (error: any) {
        console.error(`Failed to generate invoice for tenant ${subscription.tenant.name}:`, error.message);
        results.push({ tenantId: subscription.tenantId, success: false, error: error.message });
      }
    }

    console.log(`Monthly invoice generation completed. ${results.filter(r => r.success).length}/${results.length} invoices generated.`);
    return results;
  }

  static async syncInvoiceFromStripe(stripeInvoiceId: string) {
    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);

    const invoice = await prisma.invoice.findUnique({
      where: { stripeInvoiceId }
    });

    if (!invoice) {
      throw new Error('Local invoice not found');
    }

    return await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: stripeInvoice.status || 'draft',
        paidAt: stripeInvoice.paid ? new Date(stripeInvoice.status_transitions?.paid_at! * 1000) : null,
        amountPaid: stripeInvoice.amount_paid || 0,
        amountDue: stripeInvoice.amount_due || 0
      }
    });
  }

  private static getCurrentBillingPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}