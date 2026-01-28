import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const approvalSchema = z.object({
  targetType: z.string(),
  targetId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum([
    'CLIENT_ADMIN',
    'CLIENT_APPROVER',
    'AGENT_ADMIN',
    'AGENT_APPROVER',
    'PLATFORM_ADMIN',
  ]),
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function approvalsRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const parsed = approvalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const approval = await prisma.approval.create({
      data: {
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        actorId: parsed.data.actorId,
        actorRole: parsed.data.actorRole,
        status: parsed.data.status,
        reason: parsed.data.reason,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      },
    });

    return reply.code(201).send(approval);
  });
}
