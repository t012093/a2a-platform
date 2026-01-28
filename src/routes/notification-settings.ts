import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const settingsSchema = z.object({
  timezone: z.string().min(1),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  sendOnWeekend: z.boolean(),
  channels: z.array(z.enum(['email', 'in_app'])),
});

export async function notificationSettingsRoutes(app: FastifyInstance) {
  app.get('/orgs/:id/notification-settings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const settings = await prisma.notificationSetting.findUnique({ where: { orgId: id } });
    if (!settings) {
      return reply.code(404).send({ error: 'settings_not_found' });
    }
    return settings;
  });

  app.put('/orgs/:id/notification-settings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const settings = await prisma.notificationSetting.upsert({
      where: { orgId: id },
      update: parsed.data,
      create: { orgId: id, ...parsed.data },
    });

    return reply.send(settings);
  });

  app.get('/users/:id/notification-settings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const settings = await prisma.userNotificationSetting.findUnique({ where: { userId: id } });
    if (!settings) {
      return reply.code(404).send({ error: 'settings_not_found' });
    }
    return settings;
  });

  app.put('/users/:id/notification-settings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const settings = await prisma.userNotificationSetting.upsert({
      where: { userId: id },
      update: parsed.data,
      create: { userId: id, ...parsed.data },
    });

    return reply.send(settings);
  });
}
