import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { generateRefreshToken, getAccessTtl, getRefreshExpiry, hashPassword, hashToken, verifyPassword } from '../auth.js';

const registerSchema = z.object({
  orgName: z.string().min(1),
  orgType: z.enum(['CLIENT', 'AGENT']),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return reply.code(409).send({ error: 'email_in_use' });
    }

    const org = await prisma.organization.create({
      data: {
        name: parsed.data.orgName,
        orgType: parsed.data.orgType,
      },
    });

    const passwordHash = await hashPassword(parsed.data.password);
    const role = parsed.data.orgType === 'CLIENT' ? 'CLIENT_ADMIN' : 'AGENT_ADMIN';

    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        email: parsed.data.email,
        role,
        passwordHash,
      },
    });

    return reply.code(201).send({ userId: user.id, orgId: org.id });
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const accessToken = await reply.jwtSign(
      { sub: user.id, role: user.role, orgId: user.orgId },
      { expiresIn: getAccessTtl() }
    );

    const refreshToken = generateRefreshToken();
    const refreshHash = hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt: getRefreshExpiry(),
      },
    });

    return reply.send({ accessToken, refreshToken });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const tokenHash = hashToken(parsed.data.refreshToken);
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      return reply.code(401).send({ error: 'invalid_refresh' });
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = await reply.jwtSign(
      { sub: stored.user.id, role: stored.user.role, orgId: stored.user.orgId },
      { expiresIn: getAccessTtl() }
    );

    const newRefresh = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: stored.user.id,
        tokenHash: hashToken(newRefresh),
        expiresAt: getRefreshExpiry(),
      },
    });

    return reply.send({ accessToken, refreshToken: newRefresh });
  });

  app.post('/auth/logout', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const tokenHash = hashToken(parsed.data.refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    return reply.send({ ok: true });
  });

  app.get('/auth/me', { preHandler: app.authenticate }, async (request) => {
    const userId = request.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { user: null };
    }
    return { user: { id: user.id, email: user.email, role: user.role, orgId: user.orgId } };
  });
}
