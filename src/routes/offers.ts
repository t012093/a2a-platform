import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const createOfferSchema = z.object({
  rfpId: z.string().uuid(),
  agentId: z.string().uuid(),
  offerJson: z.record(z.any()),
});

export async function offersRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const parsed = createOfferSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const offer = await prisma.offer.create({
      data: {
        rfpId: parsed.data.rfpId,
        agentId: parsed.data.agentId,
        offerJson: parsed.data.offerJson,
      },
    });

    return reply.code(201).send(offer);
  });
}
