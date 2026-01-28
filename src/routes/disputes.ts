import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const decisionSchema = z.object({
  decision: z.enum(['full_release', 'partial_release', 'full_refund']),
  amount: z.number().int().positive().optional(),
  decidedBy: z.string().uuid(),
});

export async function disputesRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const { status } = request.query as { status?: string };
    const disputes = await prisma.dispute.findMany({
      where: status ? { status: status === 'open' ? 'OPEN' : 'RESOLVED' } : undefined,
    });
    return { items: disputes };
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) {
      return reply.code(404).send({ error: 'dispute_not_found' });
    }
    return dispute;
  });

  app.post('/:id/decision', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = decisionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) {
      return reply.code(404).send({ error: 'dispute_not_found' });
    }

    const decisionMap = {
      full_release: 'FULL_RELEASE',
      partial_release: 'PARTIAL_RELEASE',
      full_refund: 'FULL_REFUND',
    } as const;

    const updated = await prisma.dispute.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        decision: decisionMap[parsed.data.decision],
        decisionAmount: parsed.data.amount,
        decidedBy: parsed.data.decidedBy,
        decidedAt: new Date(),
      },
    });

    await prisma.contract.update({
      where: { id: updated.contractId },
      data: { disputeStatus: 'resolved' },
    });

    // TODO: apply PSP refund/transfer

    return reply.send(updated);
  });
}
