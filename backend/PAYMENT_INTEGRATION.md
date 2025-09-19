# Payment Integration Guide

## Overview
This Cloud Call Center system supports multiple payment methods including Stripe (cards, bank transfers), PayPal, and manual payments. The system provides comprehensive billing capabilities with subscription management, usage metering, and automated invoicing.

## Supported Payment Methods

### 1. Stripe Integration
- **Credit/Debit Cards**: Full Stripe card processing with 3D Secure support
- **ACH Bank Transfers**: US bank account payments
- **Setup Intents**: Save payment methods for future use
- **Subscriptions**: Automated recurring billing
- **Webhooks**: Real-time payment status updates

### 2. PayPal Integration
- **PayPal Orders**: One-time payments through PayPal
- **PayPal Subscriptions**: Recurring billing via PayPal
- **Webhooks**: Real-time payment and subscription updates
- **Sandbox/Production**: Support for both testing and live environments

### 3. Manual Payments
- **Offline Payments**: Handle checks, wire transfers, cash payments
- **Admin Control**: Manual payment recording and verification

## API Endpoints

### Payment Processing
```
POST /api/payments
- Process payments with any supported method
- Body: { amount, currency, paymentMethod, description, invoiceId }

GET /api/payments
- List payments for tenant with pagination

GET /api/payments/:id
- Get specific payment details

POST /api/payments/:id/refund
- Refund a payment (admin only)
```

### PayPal Specific
```
POST /api/payments/paypal/capture/:orderId
- Capture a PayPal order after approval

POST /api/payments/paypal/subscription
- Create PayPal subscription
- Body: { planId, payerInfo }

POST /api/payments/paypal/subscription/:id/cancel
- Cancel PayPal subscription

POST /api/payments/paypal/webhook
- Handle PayPal webhook events
```

### Stripe Specific
```
POST /api/payments/setup-intent
- Create setup intent for saving payment methods

GET /api/payments/methods/list
- List saved payment methods

DELETE /api/payments/methods/:paymentMethodId
- Delete saved payment method
```

## Configuration

### Environment Variables
```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=your-paypal-webhook-id
PAYPAL_RETURN_URL=http://localhost:3000/payment/success
PAYPAL_CANCEL_URL=http://localhost:3000/payment/cancel
```

## Usage Examples

### 1. Process Stripe Card Payment
```javascript
const payment = await fetch('/api/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 2900, // $29.00 in cents
    currency: 'usd',
    paymentMethod: {
      type: 'card',
      stripePaymentMethodId: 'pm_1234567890'
    },
    description: 'Monthly subscription'
  })
});
```

### 2. Process PayPal Payment
```javascript
const payment = await fetch('/api/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 2900, // $29.00 in cents
    currency: 'usd',
    paymentMethod: {
      type: 'paypal'
    },
    description: 'Monthly subscription'
  })
});

// Response includes approvalUrl for PayPal redirect
if (payment.approvalUrl) {
  window.location.href = payment.approvalUrl;
}
```

### 3. Process Manual Payment
```javascript
const payment = await fetch('/api/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 2900,
    currency: 'usd',
    paymentMethod: {
      type: 'manual'
    },
    description: 'Check payment #12345'
  })
});
```

## Subscription Management

### Create Subscription with Stripe
```javascript
const subscription = await fetch('/api/subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planType: 'professional',
    billingCycle: 'monthly',
    paymentMethodId: 'pm_1234567890',
    trialDays: 14
  })
});
```

### Create Subscription with PayPal
```javascript
const subscription = await fetch('/api/payments/paypal/subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planId: 'P-5ML4271244454362WXNWU5NQ', // PayPal plan ID
    payerInfo: {
      email: 'customer@example.com',
      firstName: 'John',
      lastName: 'Doe'
    }
  })
});
```

## Usage Metering & Billing

### Automatic Usage Recording
The system automatically records usage for:
- **Call Minutes**: Tracked when calls are completed
- **Seat Count**: Number of active users
- **Overage Charges**: Calculated monthly based on plan limits

### Manual Usage Recording
```javascript
const usage = await fetch('/api/subscription/usage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recordType: 'call_minutes',
    quantity: 120, // 2 hours
    description: 'Conference call usage'
  })
});
```

## Webhook Handling

### Stripe Webhooks
Configure webhook endpoint: `https://your-domain.com/api/payments/stripe/webhook`

Handled events:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.payment_succeeded`
- `customer.subscription.updated`

### PayPal Webhooks
Configure webhook endpoint: `https://your-domain.com/api/payments/paypal/webhook`

Handled events:
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`

## Security Considerations

1. **API Keys**: Store all API keys in environment variables
2. **Webhook Verification**: Verify webhook signatures from payment providers
3. **PCI Compliance**: Never store card data directly
4. **Access Control**: Payment operations require proper authentication
5. **Amount Validation**: Always validate payment amounts server-side

## Testing

### Stripe Test Cards
```
Visa: 4242424242424242
Visa (3D Secure): 4000002500003155
Declined: 4000000000000002
```

### PayPal Sandbox
Use PayPal sandbox accounts for testing:
- Environment: `sandbox`
- Test buyer accounts available in PayPal Developer Dashboard

### Manual Testing
- Use `type: 'manual'` for testing offline payment flows
- Admin users can record manual payments

## Monitoring & Logging

- All payment attempts are logged with detailed error information
- Failed payments trigger appropriate error responses
- Webhook events are processed and logged
- Payment status changes are tracked in the database

## Error Handling

Common error scenarios:
- **Insufficient Funds**: Card declined, insufficient PayPal balance
- **Authentication**: 3D Secure required, PayPal login issues
- **Technical**: Network timeouts, API rate limits
- **Validation**: Invalid amounts, missing payment methods

All errors include descriptive messages and appropriate HTTP status codes.