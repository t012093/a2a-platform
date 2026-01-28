import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { Prisma } from '@prisma/client';
import { constructWebhookEvent } from '../payments/stripe.js';

const webhookParamsSchema = z.object({
  provider: z.string(),
});

export async function webhooksRoutes(app: FastifyInstance) {
  app.post('/:provider', { config: { rawBody: true } }, async (request, reply) => {
    const params = webhookParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_provider' });
    }

    const provider = params.data.provider;

    if (provider === 'stripe') {
      const signature = request.headers['stripe-signature'];
      if (!signature || Array.isArray(signature)) {
        return reply.code(400).send({ error: 'missing_signature' });
      }
      const rawBody = typeof request.rawBody === 'string' ? request.rawBody : request.rawBody?.toString();
      if (!rawBody) {
        return reply.code(400).send({ error: 'missing_raw_body' });
      }

      const event = constructWebhookEvent(rawBody, signature);
      const eventType = event.type;
      const dataObject = event.data.object as Record<string, any>;
      const paymentId = dataObject?.metadata?.payment_id as string | undefined;

      if (paymentId) {
        await prisma.paymentEvent.create({
          data: {
            paymentId,
            eventType: `stripe.${eventType}`,
            payloadJson: dataObject as Prisma.InputJsonValue,
          },
        });

        if (eventType === 'payment_intent.succeeded') {
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: 'ESCROWED',
              providerPaymentIntentId: dataObject.id,
            },
          });
        }

        if (eventType === 'payment_intent.payment_failed') {
          await prisma.payment.update({
            where: { id: paymentId },
            data: { status: 'ESCROW_PENDING' },
          });
        }

        if (eventType.startsWith('transfer.')) {
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: 'RELEASED',
              providerTransferId: dataObject.id,
            },
          });
        }
      }

      return reply.send({ received: true });
    }

    const payload = request.body as Record<string, unknown>;
    const paymentId = (payload.paymentId as string | undefined) ?? null;

    if (paymentId) {
      await prisma.paymentEvent.create({
        data: {
          paymentId,
          eventType: `${provider}.event`,
          payloadJson: payload as Prisma.InputJsonValue,
        },
      });
    }

    return reply.send({ received: true });
  });
}
