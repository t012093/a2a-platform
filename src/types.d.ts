import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }

  interface FastifyInstance {
    authenticate: any;
  }
}
