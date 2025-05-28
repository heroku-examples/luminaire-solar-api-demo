import 'dotenv/config';
import Fastify from 'fastify';
import FastifyJwt from '@fastify/jwt';
import FastifyCors from '@fastify/cors';
import FastifyAuth from '@fastify/auth';
import FastifyPostgres from '@fastify/postgres';
import FastifyFormBody from '@fastify/formbody';
import FastifyRedis from '@fastify/redis';
import Swagger from '@fastify/swagger';
import SwaggerUI from '@fastify/swagger-ui';
import { config } from './config.js';
import chatMemory from './plugins/chat-memory.js';
import miaPlugin from './plugins/mia.js';
import dbPlugin from './plugins/db.js';
import chatRoutes from './routes/chat.js';
import usersRoutes from './routes/users.js';
import productsRoutes from './routes/products.js';
import metricsRoutes from './routes/metrics.js';
import webhooksRoutes from './routes/webhooks.js';
import salesforceRoutes from './routes/salesforce.js';
import salesforcePlugin from './plugins/salesforce.js';

export async function build(opts = {}) {
  // Create Fastify instance with merged options
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
    ...opts,
  });

  // Register plugins
  fastify.register(FastifyFormBody);

  fastify.register(FastifyCors, (_instance) => {
    return (req, callback) => {
      const corsOptions = {
        // This is NOT recommended for production as it enables reflection exploits
        origin: true,
      };

      // do not include CORS headers for requests from localhost
      if (/^localhost$/m.test(req.headers.origin)) {
        corsOptions.origin = false;
      }

      // callback expects two parameters: error and options
      callback(null, corsOptions);
    };
  });

  fastify.register(FastifyJwt, {
    secret: {
      private: config.PRIVATE_KEY,
      public: config.PUBLIC_KEY,
    },
    sign: { algorithm: 'RS256' },
  });

  // Decorators for authentication
  fastify.decorate('verifyUserAndPassword', async function (request, reply) {
    try {
      const { username, password } = request.body;
      const isAuthenticated = await fastify.db.authenticate(username, password);
      if (!isAuthenticated) {
        throw new Error('Invalid credentials');
      }
    } catch (err) {
      reply
        .code(401)
        .send({ error: 'Authentication failed', message: err.message });
    }
  });

  fastify.decorate('verifyJwt', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply
        .code(401)
        .send({ error: 'JWT verification failed', message: err.message });
    }
  });

  fastify.register(FastifyAuth);

  fastify.register(Swagger, {
    openapi: {
      info: {
        title: 'Luminaire Solar API',
        description: 'Provides access to the Luminaire Solar API',
        version: '1.0',
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            description:
              'RSA256 JWT signed by secret key, with user in payload',
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    refResolver: {
      buildLocalReference: (json, _baseUri, _fragment, _i) => {
        return json.$id || `def-{i}`;
      },
    },
    transform: ({ schema, url, _route, _swaggerObject }) => {
      const transformedSchema = Object.assign({}, schema);
      if (!url.startsWith('/api')) {
        transformedSchema.hide = true;
      }

      return { schema: transformedSchema, url };
    },
  });

  fastify.register(SwaggerUI, {
    routePrefix: '/api-docs',
  });

  fastify.register(FastifyPostgres, {
    connectionString: config.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  if (config.AI_ENGINE === 'mia') {
    if (config.ENABLE_MEMORY) {
      fastify.register(FastifyRedis, {
        url: config.REDIS_URL,
        closeClient: true,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 10000,
        tls: {
          rejectUnauthorized: false,
        },
      });
      fastify.register(chatMemory);
    }

    fastify.register(miaPlugin);
    // Register Chat Completion Routes
    fastify.register(chatRoutes, { prefix: '/api' });
  } else if (config.AI_ENGINE === 'agentforce') {
    // Register Agentforce plugin and routes
  }

  fastify.register(dbPlugin);
  fastify.register(salesforcePlugin);

  fastify.register(usersRoutes, { prefix: '/api' });
  fastify.register(productsRoutes, { prefix: '/api' });
  fastify.register(metricsRoutes, { prefix: '/api' });
  fastify.register(webhooksRoutes, { prefix: '/api' });
  fastify.register(salesforceRoutes, { prefix: '/api' });

  fastify.get('/', async (_request, reply) => {
    return reply.redirect('/api-docs');
  });

  // Basic healthcheck endpoint (no AppLink required)
  fastify.get('/api/healthcheck', async (_request, reply) => {
    return reply.send({ status: 'OK', message: 'Service is healthy' });
  });

  // In Fastify 5, we should call ready() before returning the instance
  // to ensure all plugins are properly loaded
  await fastify.ready();
  fastify.swagger();
  return fastify;
}
