import 'dotenv/config';
import path from 'node:path';
import Fastify from 'fastify';
import FastifyJwt from '@fastify/jwt';
import FastifyCors from '@fastify/cors';
import FastifyAuth from '@fastify/auth';
import FastifyPostgres from '@fastify/postgres';
import FastifyFormBody from '@fastify/formbody';
import AutoLoad from '@fastify/autoload';
import Swagger from '@fastify/swagger';
import SwaggerUI from '@fastify/swagger-ui';
import { config } from './config.js';

export async function build(opts = {}) {
  const fastify = Fastify(opts);

  await fastify.register(FastifyFormBody);

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

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(import.meta.dirname, 'plugins'),
  });

  fastify.register(FastifyJwt, {
    secret: {
      private: config.PRIVATE_KEY,
      public: config.PUBLIC_KEY,
    },
    sign: { algorithm: 'RS256' },
  });

  fastify
    .decorate('verifyUserAndPassword', async function (request, _reply) {
      const { username, password } = request.body;
      const isAuthenticated = await fastify.db.authenticate(username, password);
      if (!isAuthenticated) {
        throw new Error('Invalid credentials');
      }
    })
    .decorate('verifyJwt', async function (request, reply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    })
    .register(FastifyAuth)
    .after(() => {
      // This loads all plugins defined in routes
      // define your routes in one of these
      fastify.register(AutoLoad, {
        dir: path.join(import.meta.dirname, 'routes'),
        options: {
          prefix: '/api',
        },
      });

      fastify.get('/', async (_request, reply) => {
        return reply.redirect('/api-docs');
      });
    });

  await fastify.ready();
  fastify.swagger();
  return fastify;
}
