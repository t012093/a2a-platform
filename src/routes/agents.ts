import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { createConnectedAccount } from '../payments/stripe.js';

const createAgentSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1),
  providerOrg: z.string().min(1),
  agentCardJson: z.record(z.any()),
  skills: z.record(z.any()),
  defaultInputModes: z.array(z.string()).min(1),
  defaultOutputModes: z.array(z.string()).min(1),
});

const createPaymentAccountSchema = z.object({
  provider: z.enum(['STRIPE', 'PAYPAL', 'ADYEN', 'OTHER']),
  accountId: z.string().min(1).optional(),
  detailsJson: z.record(z.any()).optional(),
});

export async function agentsRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const parsed = createAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const agent = await prisma.agent.create({
      data: {
        ...parsed.data,
      },
    });

    return reply.code(201).send(agent);
  });

  app.get('/', async (request) => {
    const { orgId } = request.query as { orgId?: string };
    const agents = await prisma.agent.findMany({
      where: orgId ? { orgId } : undefined,
    });
    return { items: agents };
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return reply.code(404).send({ error: 'agent_not_found' });
    }
    return agent;
  });

  app.post('/:id/payment-accounts', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createPaymentAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return reply.code(404).send({ error: 'agent_not_found' });
    }

    const { provider, detailsJson } = parsed.data;
    let resolvedAccountId = parsed.data.accountId;
    let status = 'pending';

    if (!resolvedAccountId && provider === 'STRIPE') {
      const country = (detailsJson?.country as string | undefined) ?? process.env.STRIPE_ACCOUNT_COUNTRY ?? 'JP';
      const type = (detailsJson?.type as 'express' | 'standard' | 'custom' | undefined) ?? 'express';
      const email = detailsJson?.email as string | undefined;
      const account = await createConnectedAccount({ country, type, email });
      resolvedAccountId = account.id;
      status = account.charges_enabled ? 'active' : 'pending';
    }

    if (!resolvedAccountId) {
      return reply.code(400).send({ error: 'account_id_required' });
    }

    const paymentAccount = await prisma.paymentAccount.create({
      data: {
        agentId: id,
        provider,
        accountId: resolvedAccountId,
        status,
        detailsJson: detailsJson ?? {},
      },
    });

    return reply.code(201).send(paymentAccount);
  });
}
