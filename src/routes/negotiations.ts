import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getTaskFromAgent, subscribeTaskFromAgent } from '../a2a/client.js';
import type { Task, TaskStatusUpdateEvent } from '@a2a-js/sdk';

type NegotiationStatus = 'ACTIVE' | 'INPUT_REQUIRED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'TIMEOUT';

const taskQuerySchema = z.object({
  historyLength: z.coerce.number().int().min(0).max(200).optional(),
});

function mapTaskStateToNegotiationStatus(state?: Task['status']['state']): NegotiationStatus {
  switch (state) {
    case 'input-required':
    case 'auth-required':
      return 'INPUT_REQUIRED';
    case 'completed':
      return 'COMPLETED';
    case 'rejected':
      return 'REJECTED';
    case 'canceled':
    case 'failed':
      return 'CANCELLED';
    case 'submitted':
    case 'working':
    case 'unknown':
    default:
      return 'ACTIVE';
  }
}

function isStatusUpdateEvent(event: unknown): event is TaskStatusUpdateEvent {
  return typeof event === 'object' && event !== null && (event as { kind?: string }).kind === 'status-update';
}

function isTaskEvent(event: unknown): event is Task {
  return typeof event === 'object' && event !== null && (event as { kind?: string }).kind === 'task';
}

export async function negotiationsRoutes(app: FastifyInstance) {
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const negotiation = await prisma.negotiation.findUnique({ where: { id } });
    if (!negotiation) {
      return reply.code(404).send({ error: 'negotiation_not_found' });
    }
    return negotiation;
  });

  app.get('/:id/task', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = taskQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      include: { agent: true },
    });
    if (!negotiation) {
      return reply.code(404).send({ error: 'negotiation_not_found' });
    }

    let task: Task;
    try {
      task = await getTaskFromAgent(
        negotiation.agent.agentCardJson,
        negotiation.a2aTaskId,
        parsed.data.historyLength
      );
    } catch (error) {
      app.log.error({ err: error, negotiationId: id }, 'a2a_task_fetch_failed');
      return reply.code(502).send({ error: 'a2a_task_fetch_failed' });
    }

    const nextStatus = mapTaskStateToNegotiationStatus(task.status?.state);
    const updated = await prisma.negotiation.update({
      where: { id },
      data: {
        status: nextStatus,
        a2aContextId: task.contextId ?? negotiation.a2aContextId,
      },
    });

    return reply.send({ negotiation: updated, task });
  });

  app.get('/:id/subscribe', async (request, reply) => {
    const { id } = request.params as { id: string };
    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      include: { agent: true },
    });
    if (!negotiation) {
      return reply.code(404).send({ error: 'negotiation_not_found' });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders?.();
    reply.hijack();

    reply.raw.write('event: ready\ndata: {}\n\n');

    let closed = false;
    request.raw.on('close', () => {
      closed = true;
    });

    try {
      const stream = await subscribeTaskFromAgent(
        negotiation.agent.agentCardJson,
        negotiation.a2aTaskId
      );
      for await (const event of stream) {
        if (closed || reply.raw.writableEnded) {
          break;
        }

        if (isStatusUpdateEvent(event)) {
          const nextStatus = mapTaskStateToNegotiationStatus(event.status?.state);
          await prisma.negotiation.update({
            where: { id },
            data: {
              status: nextStatus,
              a2aContextId: event.contextId ?? negotiation.a2aContextId,
            },
          });
        } else if (isTaskEvent(event)) {
          const nextStatus = mapTaskStateToNegotiationStatus(event.status?.state);
          await prisma.negotiation.update({
            where: { id },
            data: {
              status: nextStatus,
              a2aContextId: event.contextId ?? negotiation.a2aContextId,
            },
          });
        }

        reply.raw.write(`event: a2a\ndata: ${JSON.stringify(event)}\n\n`);

        if (isStatusUpdateEvent(event) && event.final) {
          break;
        }
      }
    } catch (error) {
      app.log.error({ err: error, negotiationId: id }, 'a2a_subscribe_failed');
      if (!reply.raw.writableEnded && !closed) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: 'a2a_subscribe_failed' })}\n\n`);
      }
    } finally {
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    }
  });
}
