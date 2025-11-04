import { SeedService } from '../services/seed/index.js';
import { errorSchema } from '../schemas/index.js';

export default async function (fastify, _opts) {
  const seedService = new SeedService(fastify.pg, fastify.log);

  fastify.addSchema({
    $id: 'error',
    ...errorSchema,
  });

  // POST /admin/reset-demo - Reset and reseed all demo data
  fastify.post(
    '/admin/reset-demo',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'resetDemoData',
        description:
          'Resets the database by clearing all data and reseeding with fresh demo data. This includes users, systems, metrics, products, tool settings, and whitelists. **Warning: This is a destructive operation that cannot be undone.**',
        tags: ['admin'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            description:
              'Successfully reset and reseeded all demo data. Returns a summary of the created data.',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  username: { type: 'string' },
                  email: { type: 'string' },
                },
              },
              counts: {
                type: 'object',
                properties: {
                  systems: { type: 'number' },
                  metrics: { type: 'number' },
                  products: { type: 'number' },
                  whitelisted_urls: { type: 'number' },
                  whitelisted_pdfs: { type: 'number' },
                },
              },
              duration_ms: { type: 'number' },
            },
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description:
              'Server error while resetting demo data. The database may be in an inconsistent state.',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      const startTime = Date.now();

      try {
        fastify.log.info(
          'Demo data reset requested by user:',
          request.user.user.username
        );

        const result = await seedService.resetDemoData();
        const duration = Date.now() - startTime;

        return reply.send({
          ...result,
          message: 'Demo data has been reset successfully',
          duration_ms: duration,
        });
      } catch (error) {
        fastify.log.error('Error resetting demo data:', error);
        return reply.code(500).send({
          error: 'Failed to reset demo data',
          message: error.message,
        });
      }
    }
  );

  // POST /admin/clear-data - Clear all data without reseeding
  fastify.post(
    '/admin/clear-data',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'clearAllData',
        description:
          'Clears all data from the database without reseeding. **Warning: This is a destructive operation that cannot be undone. Use with extreme caution.**',
        tags: ['admin'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            description: 'Successfully cleared all data from the database.',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              duration_ms: { type: 'number' },
            },
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description:
              'Server error while clearing data. The database may be in an inconsistent state.',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      const startTime = Date.now();

      try {
        fastify.log.warn(
          'Data clear requested by user:',
          request.user.user.username
        );

        await seedService.clearAllData();
        const duration = Date.now() - startTime;

        return reply.send({
          success: true,
          message: 'All data has been cleared successfully',
          duration_ms: duration,
        });
      } catch (error) {
        fastify.log.error('Error clearing data:', error);
        return reply.code(500).send({
          error: 'Failed to clear data',
          message: error.message,
        });
      }
    }
  );

  // GET /admin/data-stats - Get database statistics
  fastify.get(
    '/admin/data-stats',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'getDataStats',
        description:
          'Retrieves statistics about the current data in the database, including counts of users, systems, metrics, products, and tool settings.',
        tags: ['admin'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            description:
              'Successfully retrieved database statistics with counts for all major tables.',
            type: 'object',
            properties: {
              users: { type: 'number' },
              systems: { type: 'number' },
              metrics: { type: 'number' },
              products: { type: 'number' },
              tool_settings: { type: 'number' },
              whitelisted_urls: { type: 'number' },
              whitelisted_pdfs: { type: 'number' },
              system_components: { type: 'number' },
            },
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description: 'Server error while retrieving statistics',
            $ref: 'error#',
          },
        },
      },
    },
    async function (_request, reply) {
      try {
        const client = await fastify.pg.connect();

        try {
          const stats = {};

          // Get counts for all tables
          const tables = [
            'users',
            'systems',
            'metrics',
            'products',
            'tool_settings',
            'whitelist_urls',
            'whitelist_pdfs',
            'system_components',
          ];

          for (const table of tables) {
            const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
            stats[table] = parseInt(result.rows[0].count, 10);
          }

          return reply.send(stats);
        } finally {
          client.release();
        }
      } catch (error) {
        fastify.log.error('Error getting data stats:', error);
        return reply.code(500).send({
          error: 'Failed to retrieve data statistics',
          message: error.message,
        });
      }
    }
  );
}
