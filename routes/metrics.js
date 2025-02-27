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
      operationId: 'getAllSystems',
      security: [{ BearerAuth: [] }],
      description:
        'Returns all the registered systems the authenticated user has access to',
      tags: ['systems'],
      response: {
        200: {
          description: 'All the registered systems for the authenticated user',
          type: 'array',
          items: { $ref: 'system#' },
        },
        500: {
          description: 'Internal Server Error',
          $ref: 'error#',
        },
      },
    },
    preHandler: fastify.auth([fastify.verifyJwt]),
    handler: async function (request, reply) {
      const user = request.user.user;
      const systems = await fastify.db.getSystemsByUser(user.id);
      reply.send(systems);
    },
  });

  fastify.get('/metrics/:systemId', {
    schema: {
      operationId: 'getMetricsBySystem',
      security: [{ BearerAuth: [] }],
      description: 'It returns all the metrics associated to a system',
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
    preHandler: fastify.auth([fastify.verifyJwt]),
    handler: async function (request, reply) {
      const { systemId } = request.params;
      const date = request.params.date || new Date().toISOString();

      const metrics = await fastify.db.getMetricsBySystem(systemId, date);
      reply.send(metrics);
    },
  });

  fastify.get('/summary/:systemId', {
    schema: {
      operationId: 'getMetricsSummaryBySystem',
      security: [{ BearerAuth: [] }],
      description: 'Returns the metrics summary for a system at a given date',
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
          description: 'Metrics summary for the system',
          type: 'object',
          $ref: 'allSummary#',
        },
        500: {
          description: 'Internal Server Error',
          $ref: 'error#',
        },
      },
    },
    preHandler: fastify.auth([fastify.verifyJwt]),
    handler: async function (request, reply) {
      const { systemId } = request.params;
      const date = request.query.date || new Date().toISOString();

      const summary = await fastify.db.getMetricsSummaryBySystem(
        systemId,
        date
      );
      reply.send(summary);
    },
  });
}
