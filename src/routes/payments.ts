import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { createPaymentIntent, createTransfer } from '../payments/stripe.js';

const escrowSchema = z.object({
  contractId: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: z.string().min(3),
  provider: z.enum(['STRIPE', 'PAYPAL', 'ADYEN', 'OTHER']).default('STRIPE'),
});

const releaseSchema = z.object({
  decision: z.enum(['full_release', 'partial_release']).default('full_release'),
  amount: z.number().int().positive().optional(),
});


function calcPlatformFee(amount: number) {
  const rate = amount > 3000000 ? 0.08 : 0.1;
  const fee = Math.round(amount * rate);
  return { rate, fee };
}

export async function paymentsRoutes(app: FastifyInstance) {
  app.post('/escrow', async (request, reply) => {
    const parsed = escrowSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const contract = await prisma.contract.findUnique({ where: { id: parsed.data.contractId } });
    if (!contract) {
      return reply.code(404).send({ error: 'contract_not_found' });
    }

    const { rate, fee } = calcPlatformFee(parsed.data.amount);
    const netAmount = parsed.data.amount - fee;

    const payment = await prisma.payment.create({
      data: {
        contractId: parsed.data.contractId,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        provider: parsed.data.provider,
        status: 'ESCROW_PENDING',
        platformFeeRate: rate,
        platformFeeAmount: fee,
        netAmount,
      },
    });

    if (parsed.data.provider === 'STRIPE') {
      const intent = await createPaymentIntent({
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        paymentId: payment.id,
      });

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: { providerPaymentIntentId: intent.id },
      });

      return reply.code(201).send({ payment: updated, clientSecret: intent.client_secret });
    }

    return reply.code(201).send({ payment });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return reply.code(404).send({ error: 'payment_not_found' });
    }
    return payment;
  });

  app.post('/:id/release', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = releaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return reply.code(404).send({ error: 'payment_not_found' });
    }

    let releaseAmount: number;
    if (parsed.data.decision === 'partial_release') {
      if (!parsed.data.amount) {
        return reply.code(400).send({ error: 'amount_required' });
      }
      releaseAmount = parsed.data.amount;
    } else {
      releaseAmount = payment.netAmount ?? payment.amount;
    }

    if (parsed.data.decision === 'partial_release' && !releaseAmount) {
      return reply.code(400).send({ error: 'amount_required' });
    }

    if (payment.provider === 'STRIPE') {
      const paymentWithAccount = await prisma.payment.findUnique({
        where: { id },
        include: {
          contract: {
            include: {
              offer: {
                include: {
                  agent: {
                    include: {
                      paymentAccounts: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const destination = paymentWithAccount?.contract.offer.agent.paymentAccounts.find(
        (acc) => acc.provider === 'STRIPE'
      );

      if (!destination) {
        return reply.code(400).send({ error: 'destination_account_not_found' });
      }

      const transfer = await createTransfer({
        amount: releaseAmount,
        currency: payment.currency,
        destinationAccountId: destination.accountId,
        paymentId: payment.id,
      });

      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: 'RELEASED',
          providerTransferId: transfer.id,
        },
      });

      return reply.send({ payment: updated, releasedAmount: releaseAmount });
    }

    return reply.code(400).send({ error: 'provider_not_supported' });
  });

}
