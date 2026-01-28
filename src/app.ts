import Fastify from 'fastify';
import { agentsRoutes } from './routes/agents.js';
import { rfpsRoutes } from './routes/rfps.js';
import { offersRoutes } from './routes/offers.js';
import { contractsRoutes } from './routes/contracts.js';
import { paymentsRoutes } from './routes/payments.js';
import { approvalsRoutes } from './routes/approvals.js';
import { notificationSettingsRoutes } from './routes/notification-settings.js';
import { disputesRoutes } from './routes/disputes.js';
import { paymentAccountsRoutes } from './routes/payment-accounts.js';
import { webhooksRoutes } from './routes/webhooks.js';
import rawBody from 'fastify-raw-body';
import fastifyJwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.js';
import { negotiationsRoutes } from './routes/negotiations.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });

  const jwtSecret = process.env.JWT_SECRET ?? 'dev_secret_change_me';
  app.register(fastifyJwt, { secret: jwtSecret });

  app.decorate('authenticate', async (request: any, reply: any) => {
    if (process.env.AUTH_DISABLED === 'true') {
      return;
    }
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/healthz', async () => ({ ok: true }));

  app.addHook('onRequest', async (request, reply) => {
    const openPaths = ['/healthz'];
    if (openPaths.includes(request.url) || request.url.startsWith('/auth') || request.url.startsWith('/webhooks')) {
      return;
    }
    if (process.env.AUTH_DISABLED === 'true') {
      return;
    }
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.register(agentsRoutes, { prefix: '/agents' });
  app.register(rfpsRoutes, { prefix: '/rfps' });
  app.register(offersRoutes, { prefix: '/offers' });
  app.register(contractsRoutes, { prefix: '/contracts' });
  app.register(paymentsRoutes, { prefix: '/payments' });
  app.register(approvalsRoutes, { prefix: '/approvals' });
  app.register(notificationSettingsRoutes, { prefix: '/' });
  app.register(disputesRoutes, { prefix: '/disputes' });
  app.register(paymentAccountsRoutes, { prefix: '/payment-accounts' });
  app.register(negotiationsRoutes, { prefix: '/negotiations' });
  app.register(webhooksRoutes, { prefix: '/webhooks' });
  app.register(authRoutes, { prefix: '' });

  return app;
}
