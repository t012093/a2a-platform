import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const createOfferSchema = z.object({
  rfpId: z.string().uuid(),
  agentId: z.string().uuid(),
  offerJson: z.record(z.any()),
});

const acceptOfferSchema = z.object({
  termsJson: z.record(z.any()).optional(),
  rejectOtherOffers: z.boolean().optional(),
  closeRfp: z.boolean().optional(),
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

  app.post('/:id/accept', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = acceptOfferSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const offer = await prisma.offer.findUnique({ where: { id } });
    if (!offer) {
      return reply.code(404).send({ error: 'offer_not_found' });
    }

    const existingContract = await prisma.contract.findFirst({ where: { offerId: id } });
    if (existingContract) {
      if (offer.status !== 'ACCEPTED') {
        await prisma.offer.update({ where: { id }, data: { status: 'ACCEPTED' } });
      }
      return reply.send({ status: 'existing', contract: existingContract });
    }

    const termsJson = {
      source: 'offer',
      offer: offer.offerJson,
      acceptedAt: new Date().toISOString(),
      ...(parsed.data.termsJson ? { custom: parsed.data.termsJson } : {}),
    };

    const contract = await prisma.contract.create({
      data: {
        rfpId: offer.rfpId,
        offerId: offer.id,
        termsJson,
      },
    });

    await prisma.offer.update({
      where: { id: offer.id },
      data: { status: 'ACCEPTED' },
    });

    const rejectOtherOffers = parsed.data.rejectOtherOffers ?? true;
    if (rejectOtherOffers) {
      await prisma.offer.updateMany({
        where: {
          rfpId: offer.rfpId,
          id: { not: offer.id },
          status: { in: ['PROPOSED', 'REVISED'] },
        },
        data: { status: 'REJECTED' },
      });
    }

    const closeRfp = parsed.data.closeRfp ?? rejectOtherOffers;
    if (closeRfp) {
      await prisma.rfp.update({
        where: { id: offer.rfpId },
        data: { status: 'CLOSED' },
      });
    }

    return reply.code(201).send({ status: 'accepted', contract });
  });
}
