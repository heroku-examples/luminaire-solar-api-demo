import {
  systemSchema,
  metricSchema,
  summarySchema,
  allSummarySchema,
  errorSchema,
} from '../schemas/index.js';

export default async function (fastify, _opts) {
  fastify.addSchema({
    $id: 'system',
    ...systemSchema,
  });

  fastify.addSchema({
    $id: 'metric',
    ...metricSchema,
  });

  fastify.addSchema({
    $id: 'summary',
    ...summarySchema,
  });

  fastify.addSchema({
    $id: 'allSummary',
    ...allSummarySchema,
  });

  fastify.addSchema({
    $id: 'error',
    ...errorSchema,
  });

  fastify.route({
    method: 'GET',
    url: '/systems',
    schema: {
      security: [{ cookieAuth: [] }],
      description: 'Get all systems',
      tags: ['systems'],
      response: {
        200: {
          description: 'All registered systems',
          type: 'array',
          items: { $ref: 'system#' },
        },
        500: {
          description: 'Internal Server Error',
          $ref: 'error#',
        },
      },
    },
    preHandler: fastify.auth([fastify.verifySession]),
    handler: async function (request, reply) {
      const user = request.session.user;
      const systems = await fastify.db.getSystemsByUser(user.id);
      reply.send(systems);
    },
  });

  fastify.get(
    '/metrics/:systemId',
    {
      schema: {
        description: 'Get metrics for a system',
        tags: ['metrics'],
        params: {
          type: 'object',
          description: 'The system ID',
          properties: {
            systemId: { type: 'string' },
          },
        },
        querystring: {
          description: 'Filter metrics by date',
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
          },
          required: ['date'],
        },
        response: {
          200: {
            description: 'Metrics for the system',
            type: 'array',
            items: { $ref: 'metric#' },
          },
          500: {
            description: 'Internal Server Error',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      const { date } = request.query;
      const { systemId } = request.params;

      const metrics = await fastify.db.getMetricsBySystem(systemId, date);
      reply.send(metrics);
    }
  );

  fastify.get(
    '/summary/:systemId',
    {
      schema: {
        description: 'Get summary for a system',
        tags: ['metrics'],
        params: {
          type: 'object',
          description: 'The system ID',
          properties: {
            systemId: { type: 'string' },
          },
        },
        querystring: {
          description: 'Filter metrics by date',
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
          },
        },
        response: {
          200: {
            description: 'Summary for the system',
            type: 'object',
            $ref: 'allSummary#',
          },
          500: {
            description: 'Internal Server Error',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      const { systemId } = request.params;
      const date = request.query.date || new Date().toISOString();

      const summary = await fastify.db.getMetricsSummaryBySystem(
        systemId,
        date
      );
      reply.send(summary);
    }
  );
}
