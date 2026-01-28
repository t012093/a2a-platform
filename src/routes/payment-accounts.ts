import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { createAccountLink } from '../payments/stripe.js';

export async function paymentAccountsRoutes(app: FastifyInstance) {
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await prisma.paymentAccount.findUnique({ where: { id } });
    if (!account) {
      return reply.code(404).send({ error: 'payment_account_not_found' });
    }
    return account;
  });

  app.post('/:id/link', async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await prisma.paymentAccount.findUnique({ where: { id } });
    if (!account) {
      return reply.code(404).send({ error: 'payment_account_not_found' });
    }

    if (account.provider === 'STRIPE') {
      const refreshUrl = process.env.STRIPE_REFRESH_URL ?? 'https://example.com/reauth';
      const returnUrl = process.env.STRIPE_RETURN_URL ?? 'https://example.com/return';
      const link = await createAccountLink({
        accountId: account.accountId,
        refreshUrl,
        returnUrl,
      });
      return reply.send({ url: link.url });
    }

    return reply.code(400).send({ error: 'onboarding_not_supported' });
  });
}
