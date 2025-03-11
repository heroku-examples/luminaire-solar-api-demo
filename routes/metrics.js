import {
  systemSchema,
  systemComponentSchema,
  activityHistorySchema,
  metricSchema,
  summarySchema,
  allSummarySchema,
  forecastSchema,
  systemWeatherSchema,
  errorSchema,
} from '../schemas/index.js';

export default async function (fastify, _opts) {
  fastify.addSchema({
    $id: 'system',
    ...systemSchema,
  });

  fastify.addSchema({
    $id: 'systemComponent',
    ...systemComponentSchema,
  });

  fastify.addSchema({
    $id: 'activityHistory',
    ...activityHistorySchema,
  });

  fastify.addSchema({
    $id: 'systemWeather',
    ...systemWeatherSchema,
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
    $id: 'forecast',
    ...forecastSchema,
  });

  fastify.addSchema({
    $id: 'error',
    ...errorSchema,
  });

  fastify.route({
    method: 'GET',
    url: '/systems',
    schema: {
      security: [{ BearerAuth: [] }],
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
    preHandler: fastify.auth([fastify.verifyJwt]),
    handler: async function (request, reply) {
      const user = request.user.user;
      const systems = await fastify.db.getSystemsByUser(user.id);
      reply.send(systems);
    },
  });

  fastify.get('/metrics/:systemId', {
    schema: {
      security: [{ BearerAuth: [] }],
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
    preHandler: fastify.auth([fastify.verifyJwt]),
    handler: async function (request, reply) {
      const { date } = request.query;
      const { systemId } = request.params;

      const metrics = await fastify.db.getMetricsBySystem(systemId, date);
      reply.send(metrics);
    },
  });

  fastify.get('/summary/:systemId', {
    schema: {
      security: [{ BearerAuth: [] }],
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

  fastify.get('/system/:systemId', {
    schema: {
      security: [{ BearerAuth: [] }],
      description: 'Get summary for a system',
      tags: ['metrics'],
      params: {
        type: 'object',
        description: 'The system ID',
        properties: {
          systemId: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Details of the system',
          type: 'object',
          $ref: 'system#',
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

      const { system, components } =
        await fastify.db.getSystemDetails(systemId);
      reply.send({
        ...system,
        components,
      });
    },
  });

  fastify.get('/system/:systemId/activityHistory', {
    schema: {
      security: [{ BearerAuth: [] }],
      description: 'Get the actvity history for a system',
      tags: ['metrics'],
      params: {
        type: 'object',
        description: 'The system ID',
        properties: {
          systemId: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'The activity history for a system',
          type: 'object',
          $ref: 'activityHistory#',
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

      const pastMonth = await fastify.db.getActivityHistoryBySystem(systemId);
      reply.send({ pastMonth: pastMonth });
    },
  });

  fastify.get('/system/:systemId/weather', {
    schema: {
      security: [{ BearerAuth: [] }],
      description: 'Get the current weather in the area of the system.',
      tags: ['metrics'],
      params: {
        type: 'object',
        description: 'The system ID',
        properties: {
          systemId: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'The weather data',
          type: 'object',
          $ref: 'systemWeather#',
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

      const weather = await fastify.db.getWeatherBySystem(systemId);
      reply.send(weather);
    },
  });

  fastify.get('/forecast/:systemId', {
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
      response: {
        200: {
          description: 'Weekly forecast for the system',
          type: 'array',
          items: { $ref: 'forecast#' },
        },
        500: {
          description: 'Internal Server Error',
          $ref: 'error#',
        },
      },
    },
    handler: async function (request, reply) {
      const { systemId } = request.params;
      const date = request.query.date || new Date().toISOString();

      const forecast = await fastify.db.getEnergyForecast(systemId, date);
      reply.send(forecast);
    },
  });
}
