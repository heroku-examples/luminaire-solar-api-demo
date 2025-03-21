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
      operationId: 'getAllSystems',
      security: [{ BearerAuth: [] }],
      description:
        'Retrieves all solar energy systems registered to the authenticated user. This endpoint provides a comprehensive list of all solar installations the user has access to, including their complete location details and system identifiers. This information is essential for monitoring multiple solar installations across different locations.',
      tags: ['systems'],
      response: {
        200: {
          description:
            'Successfully retrieved all solar systems associated with the authenticated user. The response includes complete location details for each system including address, city, state, zip code, and country.',
          type: 'array',
          items: { $ref: 'system#' },
        },
        500: {
          description:
            'Server encountered an unexpected error while retrieving solar system data. This may occur due to database connectivity issues or authentication problems.',
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
      description:
        'Retrieves detailed energy production and consumption metrics for a specific solar system. This endpoint provides time-series data showing how much energy the system has produced and how much energy the property has consumed, allowing for performance analysis and efficiency monitoring.',
      tags: ['metrics'],
      params: {
        type: 'object',
        description: 'Parameters to identify the specific solar system',
        properties: {
          systemId: {
            type: 'string',
            description:
              'Unique identifier (UUID) of the solar system to retrieve metrics for',
          },
        },
      },
      querystring: {
        description:
          'Optional filters to narrow down the metrics by specific date',
        type: 'object',
        properties: {
          date: {
            type: 'string',
            format: 'date',
            description:
              'Filter metrics to this specific date (YYYY-MM-DD format). If not provided, defaults to current date.',
          },
        },
      },
      response: {
        200: {
          description:
            'Successfully retrieved energy metrics for the specified solar system. The response includes time-series data with energy production and consumption values, along with the exact timestamps when measurements were taken.',
          type: 'array',
          items: { $ref: 'metric#' },
        },
        500: {
          description:
            'Server encountered an unexpected error while retrieving metric data. This may occur due to database connectivity issues, invalid system ID, or data integrity problems.',
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
      description:
        'Retrieves aggregated energy summaries for a solar system across multiple time periods (daily, past week, past month). This endpoint provides a comprehensive overview of energy production and consumption patterns, enabling trend analysis and performance evaluation over different timeframes.',
      tags: ['metrics'],
      params: {
        type: 'object',
        description: 'Parameters to identify the specific solar system',
        properties: {
          systemId: {
            type: 'string',
            description:
              'Unique identifier (UUID) of the solar system to retrieve summary data for',
          },
        },
      },
      querystring: {
        description:
          'Optional filters to narrow down the summary to a specific reference date',
        type: 'object',
        properties: {
          date: {
            type: 'string',
            format: 'date',
            description:
              'Reference date (YYYY-MM-DD format) for generating summaries. If not provided, defaults to current date.',
          },
        },
      },
      response: {
        200: {
          description:
            'Successfully retrieved energy summaries for the specified solar system. The response includes aggregated data organized into daily, weekly, and monthly collections, each containing total energy production and consumption values.',
          type: 'object',
          $ref: 'allSummary#',
        },
        500: {
          description:
            'Server encountered an unexpected error while generating summary data. This may occur due to database connectivity issues, insufficient metric data, or calculation errors.',
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
