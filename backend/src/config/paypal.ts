import { Client, Environment } from '@paypal/paypal-server-sdk';

// PayPal environment configuration
const environment = process.env.PAYPAL_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox;

// Initialize PayPal client
const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID || 'your-paypal-client-id',
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || 'your-paypal-client-secret'
  },
  environment: environment
});

export { paypalClient };

export const PAYPAL_CONFIG = {
  environment,
  clientId: process.env.PAYPAL_CLIENT_ID || 'your-paypal-client-id',
  webhookId: process.env.PAYPAL_WEBHOOK_ID || 'your-webhook-id',
  returnUrl: process.env.PAYPAL_RETURN_URL || 'http://localhost:3000/payment/success',
  cancelUrl: process.env.PAYPAL_CANCEL_URL || 'http://localhost:3000/payment/cancel'
};