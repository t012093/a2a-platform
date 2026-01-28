import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripe() {
  if (!stripeClient) {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    stripeClient = new Stripe(stripeSecret);
  }
  return stripeClient;
}

export async function createPaymentIntent(params: {
  amount: number;
  currency: string;
  paymentId: string;
}) {
  return getStripe().paymentIntents.create({
    amount: params.amount,
    currency: params.currency,
    automatic_payment_methods: { enabled: true },
    metadata: { payment_id: params.paymentId },
    transfer_group: `payment_${params.paymentId}`,
  });
}

export async function createTransfer(params: {
  amount: number;
  currency: string;
  destinationAccountId: string;
  paymentId: string;
}) {
  return getStripe().transfers.create({
    amount: params.amount,
    currency: params.currency,
    destination: params.destinationAccountId,
    transfer_group: `payment_${params.paymentId}`,
    metadata: { payment_id: params.paymentId },
  });
}

export async function createConnectedAccount(params: {
  country: string;
  type: 'express' | 'standard' | 'custom';
  email?: string;
}) {
  return getStripe().accounts.create({
    type: params.type,
    country: params.country,
    email: params.email,
  });
}

export async function createAccountLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return getStripe().accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: 'account_onboarding',
  });
}

export function constructWebhookEvent(rawBody: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is required');
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
