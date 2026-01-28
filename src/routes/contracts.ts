import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const createContractSchema = z.object({
  rfpId: z.string().uuid(),
  offerId: z.string().uuid(),
  termsJson: z.record(z.any()),
});

const approveSchema = z.object({
  actorId: z.string().uuid(),
  actorRole: z.enum([
    'CLIENT_ADMIN',
    'CLIENT_APPROVER',
    'AGENT_ADMIN',
    'AGENT_APPROVER',
    'PLATFORM_ADMIN',
  ]),
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

export async function contractsRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const parsed = createContractSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const contract = await prisma.contract.create({
      data: {
        rfpId: parsed.data.rfpId,
        offerId: parsed.data.offerId,
        termsJson: parsed.data.termsJson,
      },
    });

    return reply.code(201).send(contract);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      return reply.code(404).send({ error: 'contract_not_found' });
    }
    return contract;
  });

  app.post('/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = approveSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      return reply.code(404).send({ error: 'contract_not_found' });
    }

    await prisma.approval.create({
      data: {
        targetType: 'contract',
        targetId: id,
        actorId: parsed.data.actorId,
        actorRole: parsed.data.actorRole,
        status: parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED',
        reason: parsed.data.reason,
      },
    });

    if (parsed.data.action === 'reject') {
      await prisma.contract.update({
        where: { id },
        data: { status: 'TERMINATED' },
      });
      return reply.send({ status: 'terminated' });
    }

    const approvals = await prisma.approval.findMany({
      where: {
        targetType: 'contract',
        targetId: id,
        status: 'APPROVED',
      },
    });

    const hasClientApproval = approvals.some((a) =>
      ['CLIENT_ADMIN', 'CLIENT_APPROVER'].includes(a.actorRole)
    );
    const hasAgentApproval = approvals.some((a) =>
      ['AGENT_ADMIN', 'AGENT_APPROVER'].includes(a.actorRole)
    );

    if (hasClientApproval && hasAgentApproval) {
      const updated = await prisma.contract.update({
        where: { id },
        data: { status: 'ACTIVE', signedAt: new Date() },
      });
      return reply.send(updated);
    }

    return reply.send({ status: 'pending' });
  });
}
