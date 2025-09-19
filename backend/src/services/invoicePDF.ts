import { prisma } from '../config/database';

export interface InvoicePDFOptions {
  includePaymentDetails?: boolean;
  includeTenantLogo?: boolean;
  theme?: 'default' | 'minimal' | 'corporate';
}

export class InvoicePDFService {
  // Generate HTML for invoice (PDF generation will be handled client-side or with future PDF library)
  static async generateInvoiceHTML(
    invoiceId: string,
    options: InvoicePDFOptions = {}
  ): Promise<string> {
    // Fetch invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
            address: true,
            phone: true,
            email: true
          }
        },
        subscription: {
          include: {
            plan: true
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paidAt: true,
            paymentMethod: true
          }
        },
        items: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Generate HTML content based on theme
    switch (options.theme) {
      case 'minimal':
        return this.generateMinimalHTML(invoice, options);
      case 'corporate':
        return this.generateCorporateHTML(invoice, options);
      default:
        return this.generateDefaultHTML(invoice, options);
    }
  }

  // Legacy method - generates placeholder PDF buffer for compatibility
  static async generateInvoicePDF(
    invoiceId: string,
    options: InvoicePDFOptions = {}
  ): Promise<Buffer> {
    // For now, return a simple text-based "PDF" as a placeholder
    // In production, you would integrate with a proper PDF library like puppeteer or similar
    const html = await this.generateInvoiceHTML(invoiceId, options);

    // Create a simple text representation
    const textContent = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return Buffer.from(textContent, 'utf-8');
  }

  // Generate default HTML theme
  private static generateDefaultHTML(invoice: any, options: InvoicePDFOptions): string {
    const paymentDetails = options.includePaymentDetails && invoice.payment ?
      `<div class="payment-section">
        <h3>Payment Information</h3>
        <p><strong>Payment ID:</strong> ${invoice.payment.id}</p>
        <p><strong>Status:</strong> ${invoice.payment.status.toUpperCase()}</p>
        ${invoice.payment.paidAt ? `<p><strong>Paid:</strong> ${invoice.payment.paidAt.toLocaleDateString()}</p>` : ''}
        ${invoice.payment.paymentMethod ? `<p><strong>Method:</strong> ${invoice.payment.paymentMethod}</p>` : ''}
      </div>` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .invoice-title { font-size: 24px; font-weight: bold; color: #2563eb; }
        .company-info { text-align: right; font-size: 12px; }
        .invoice-details, .bill-to { margin-bottom: 30px; }
        .invoice-details h3, .bill-to h3 { font-size: 14px; margin-bottom: 10px; }
        .invoice-details p, .bill-to p { margin: 5px 0; font-size: 10px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f5f5f5; font-weight: bold; }
        .totals { text-align: right; margin-bottom: 30px; }
        .totals p { margin: 5px 0; }
        .total-line { font-weight: bold; border-top: 1px solid #333; padding-top: 5px; }
        .payment-section { margin-bottom: 30px; }
        .footer { font-size: 8px; color: #666; margin-top: 50px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="invoice-title">INVOICE</div>
        <div class="company-info">
          <div>Cloud Call System</div>
          <div>Enterprise Communications Platform</div>
          <div>support@cloudcallsystem.com</div>
          <div>1-800-CLOUD-CALL</div>
        </div>
      </div>

      <div class="content">
        <div class="invoice-details">
          <h3>Invoice Details</h3>
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Issue Date:</strong> ${invoice.createdAt.toLocaleDateString()}</p>
          <p><strong>Due Date:</strong> ${invoice.dueDate?.toLocaleDateString() || 'Upon Receipt'}</p>
          <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
        </div>

        ${invoice.tenant ? `
        <div class="bill-to">
          <h3>Bill To:</h3>
          <p><strong>${invoice.tenant.name}</strong></p>
          ${invoice.tenant.address ? `<p>${invoice.tenant.address}</p>` : ''}
          ${invoice.tenant.email ? `<p>${invoice.tenant.email}</p>` : ''}
          ${invoice.tenant.phone ? `<p>${invoice.tenant.phone}</p>` : ''}
        </div>` : ''}

        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.generateItemsHTML(invoice)}
          </tbody>
        </table>

        <div class="totals">
          ${invoice.subtotal && invoice.subtotal !== invoice.total ? `<p>Subtotal: $${(invoice.subtotal / 100).toFixed(2)}</p>` : ''}
          ${invoice.tax && invoice.tax > 0 ? `<p>Tax: $${(invoice.tax / 100).toFixed(2)}</p>` : ''}
          <p class="total-line">Total: $${(invoice.total / 100).toFixed(2)}</p>
        </div>

        ${paymentDetails}
      </div>

      <div class="footer">
        <p>Thank you for your business!</p>
        <p>Questions? Contact support@cloudcallsystem.com</p>
        <p>Invoice ${invoice.invoiceNumber} - Generated on ${new Date().toLocaleDateString()}</p>
      </div>
    </body>
    </html>`;
  }

  // Generate minimal HTML theme
  private static generateMinimalHTML(invoice: any, options: InvoicePDFOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        h1 { font-size: 20px; margin-bottom: 20px; }
        .info { margin-bottom: 30px; }
        .items { margin-bottom: 20px; }
        .total { font-size: 14px; font-weight: bold; text-align: right; }
      </style>
    </head>
    <body>
      <h1>Invoice ${invoice.invoiceNumber}</h1>

      <div class="info">
        <p>Date: ${invoice.createdAt.toLocaleDateString()}</p>
        <p>Due: ${invoice.dueDate?.toLocaleDateString() || 'Upon Receipt'}</p>
        ${invoice.tenant ? `<p>To: ${invoice.tenant.name}</p>` : ''}
      </div>

      <div class="items">
        ${this.generateSimpleItemsHTML(invoice)}
      </div>

      <div class="total">
        Total: $${(invoice.total / 100).toFixed(2)}
      </div>
    </body>
    </html>`;
  }

  // Generate corporate HTML theme
  private static generateCorporateHTML(invoice: any, options: InvoicePDFOptions): string {
    const paymentDetails = options.includePaymentDetails && invoice.payment ?
      `<div class="payment-section">
        <h3>Payment Information</h3>
        <p><strong>Payment ID:</strong> ${invoice.payment.id}</p>
        <p><strong>Status:</strong> ${invoice.payment.status.toUpperCase()}</p>
        ${invoice.payment.paidAt ? `<p><strong>Paid:</strong> ${invoice.payment.paidAt.toLocaleDateString()}</p>` : ''}
        ${invoice.payment.paymentMethod ? `<p><strong>Method:</strong> ${invoice.payment.paymentMethod}</p>` : ''}
      </div>` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        body { font-family: 'Times New Roman', serif; margin: 0; color: #333; }
        .header { background-color: #1f2937; color: white; padding: 30px 50px; }
        .invoice-title { font-size: 28px; font-weight: bold; }
        .company-info { float: right; text-align: right; }
        .content { padding: 40px 50px; }
        .section { margin-bottom: 30px; }
        .section h3 { color: #1f2937; border-bottom: 2px solid #1f2937; padding-bottom: 5px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .items-table th { background-color: #1f2937; color: white; padding: 12px; }
        .items-table td { padding: 10px; border-bottom: 1px solid #ddd; }
        .totals { background-color: #f8f9fa; padding: 20px; border-left: 4px solid #1f2937; }
        .footer { background-color: #1f2937; color: white; padding: 20px 50px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="invoice-title">INVOICE</div>
        <div class="company-info">
          <div>Cloud Call System</div>
          <div>Professional Services</div>
        </div>
        <div style="clear: both;"></div>
      </div>

      <div class="content">
        <div class="section">
          <h3>Invoice Details</h3>
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Issue Date:</strong> ${invoice.createdAt.toLocaleDateString()}</p>
          <p><strong>Due Date:</strong> ${invoice.dueDate?.toLocaleDateString() || 'Upon Receipt'}</p>
          <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
        </div>

        ${invoice.tenant ? `
        <div class="section">
          <h3>Bill To</h3>
          <p><strong>${invoice.tenant.name}</strong></p>
          ${invoice.tenant.address ? `<p>${invoice.tenant.address}</p>` : ''}
          ${invoice.tenant.email ? `<p>${invoice.tenant.email}</p>` : ''}
          ${invoice.tenant.phone ? `<p>${invoice.tenant.phone}</p>` : ''}
        </div>` : ''}

        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.generateItemsHTML(invoice)}
          </tbody>
        </table>

        <div class="totals">
          ${invoice.subtotal && invoice.subtotal !== invoice.total ? `<p>Subtotal: $${(invoice.subtotal / 100).toFixed(2)}</p>` : ''}
          ${invoice.tax && invoice.tax > 0 ? `<p>Tax: $${(invoice.tax / 100).toFixed(2)}</p>` : ''}
          <p style="font-size: 18px; font-weight: bold; margin-top: 10px;">Total: $${(invoice.total / 100).toFixed(2)}</p>
        </div>

        ${paymentDetails}
      </div>

      <div class="footer">
        <p>Thank you for your business with Cloud Call System</p>
        <p>Questions? Contact support@cloudcallsystem.com | Invoice ${invoice.invoiceNumber}</p>
      </div>
    </body>
    </html>`;
  }

  // Generate items HTML for tables
  private static generateItemsHTML(invoice: any): string {
    if (invoice.items && invoice.items.length > 0) {
      return invoice.items.map((item: any) => `
        <tr>
          <td>${item.description || 'Service'}</td>
          <td>${item.quantity || 1}</td>
          <td>$${(item.unitAmount / 100).toFixed(2)}</td>
          <td>$${(item.amount / 100).toFixed(2)}</td>
        </tr>`).join('');
    } else {
      // Fallback if no items
      return `
        <tr>
          <td>${invoice.description || 'Service'}</td>
          <td>1</td>
          <td>$${(invoice.total / 100).toFixed(2)}</td>
          <td>$${(invoice.total / 100).toFixed(2)}</td>
        </tr>`;
    }
  }

  // Generate simple items list (for minimal theme)
  private static generateSimpleItemsHTML(invoice: any): string {
    if (invoice.items && invoice.items.length > 0) {
      return invoice.items.map((item: any) =>
        `<p>${item.description || 'Service'} - $${(item.amount / 100).toFixed(2)}</p>`
      ).join('');
    } else {
      return `<p>${invoice.description || 'Service'} - $${(invoice.total / 100).toFixed(2)}</p>`;
    }
  }


  // Generate bulk invoices (for multiple tenants)
  static async generateBulkInvoicePDFs(
    invoiceIds: string[],
    options: InvoicePDFOptions = {}
  ): Promise<{ [invoiceId: string]: Buffer }> {
    const results: { [invoiceId: string]: Buffer } = {};

    for (const invoiceId of invoiceIds) {
      try {
        results[invoiceId] = await this.generateInvoicePDF(invoiceId, options);
      } catch (error) {
        console.error(`Failed to generate PDF for invoice ${invoiceId}:`, error);
        // Continue with other invoices
      }
    }

    return results;
  }

  // Generate bulk invoice HTML files
  static async generateBulkInvoiceHTML(
    invoiceIds: string[],
    options: InvoicePDFOptions = {}
  ): Promise<{ [invoiceId: string]: string }> {
    const results: { [invoiceId: string]: string } = {};

    for (const invoiceId of invoiceIds) {
      try {
        results[invoiceId] = await this.generateInvoiceHTML(invoiceId, options);
      } catch (error) {
        console.error(`Failed to generate HTML for invoice ${invoiceId}:`, error);
        // Continue with other invoices
      }
    }

    return results;
  }

  // Generate invoice data for custom processing
  static async getInvoiceData(invoiceId: string): Promise<any> {
    return await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
            address: true,
            phone: true,
            email: true
          }
        },
        subscription: {
          include: {
            plan: true
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paidAt: true,
            paymentMethod: true
          }
        },
        items: true
      }
    });
  }
}