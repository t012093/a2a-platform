import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { sendRfpToAgent } from '../a2a/client.js';

const createRfpSchema = z.object({
  clientOrgId: z.string().uuid(),
  title: z.string().min(1),
  requirementsJson: z.record(z.any()),
});

const dispatchSchema = z.object({
  agentIds: z.array(z.string().uuid()).min(1),
});

export async function rfpsRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const parsed = createRfpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const rfp = await prisma.rfp.create({
      data: {
        clientOrgId: parsed.data.clientOrgId,
        title: parsed.data.title,
        requirementsJson: parsed.data.requirementsJson,
      },
    });

    return reply.code(201).send(rfp);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rfp = await prisma.rfp.findUnique({ where: { id } });
    if (!rfp) {
      return reply.code(404).send({ error: 'rfp_not_found' });
    }
    return rfp;
  });

  app.post('/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rfp = await prisma.rfp.update({
      where: { id },
      data: { approvedAt: new Date() },
    }).catch(() => null);

    if (!rfp) {
      return reply.code(404).send({ error: 'rfp_not_found' });
    }

    return reply.send(rfp);
  });

  app.post('/:id/dispatch', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = dispatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const rfp = await prisma.rfp.findUnique({ where: { id } });
    if (!rfp) {
      return reply.code(404).send({ error: 'rfp_not_found' });
    }

    const negotiations = await prisma.$transaction(
      parsed.data.agentIds.map((agentId) =>
        prisma.negotiation.create({
          data: {
            rfpId: id,
            agentId,
            a2aTaskId: `task_${randomUUID()}`,
            a2aContextId: `ctx_${randomUUID()}`,
          },
        })
      )
    );

    await prisma.rfp.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    const agents = await prisma.agent.findMany({
      where: { id: { in: parsed.data.agentIds } },
    });

    const rfpPayload = {
      schema: 'deal.rfp',
      schema_version: 'v1',
      rfp_id: id,
      title: rfp.title,
      ...(rfp.requirementsJson as Record<string, unknown>),
    };

    await Promise.all(
      agents.map(async (agent) => {
        try {
          const response = await sendRfpToAgent(agent.agentCardJson, rfpPayload);
          if (response && response.kind === 'task') {
            await prisma.negotiation.updateMany({
              where: { rfpId: id, agentId: agent.id },
              data: {
                a2aTaskId: response.id,
                a2aContextId: response.contextId,
              },
            });
          } else if (response && response.kind === 'message' && response.taskId) {
            await prisma.negotiation.updateMany({
              where: { rfpId: id, agentId: agent.id },
              data: {
                a2aTaskId: response.taskId,
                a2aContextId: response.contextId ?? `ctx_${randomUUID()}`,
              },
            });
          } else {
            app.log.warn({ agentId: agent.id }, 'a2a_send_no_task');
          }
        } catch (error) {
          app.log.error({ err: error, agentId: agent.id }, 'a2a_send_failed');
        }
      })
    );

    return reply.send({ rfpId: id, negotiations });
  });

  app.get('/:id/offers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const offers = await prisma.offer.findMany({ where: { rfpId: id } });
    return reply.send({ items: offers });
  });
}
