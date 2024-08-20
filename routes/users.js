import { userSchema, errorSchema } from '../schemas/index.js';

export default async function (fastify, _opts) {
  fastify.addSchema({
    $id: 'user',
    ...userSchema,
  });

  fastify.addSchema({
    $id: 'error',
    ...errorSchema,
  });

  fastify.route({
    method: 'POST',
    url: '/user/authenticate',
    preHandler: fastify.auth([fastify.verifyUserAndPassword]),
    schema: {
      description: 'Authenticate an user',
      body: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          password: { type: 'string', format: 'password' },
        },
        required: ['username', 'password'],
      },
      tags: ['users'],
      response: {
        401: {
          description: 'Unauthorized',
          $ref: 'error#',
        },
        200: {
          description: 'Authentication response',
          type: 'object',
          properties: {
            authenticated: { type: 'boolean' },
            sessionId: { type: 'string' },
            user: { $ref: 'user#' },
          },
        },
      },
    },
    handler: async function (request, reply) {
      const { username } = request.body;
      const user = await fastify.db.getUserByUsername(username);
      request.session.user = user;
      reply.send({
        user,
        authenticated: true,
        sessionId: request.session.sessionId,
      });
    },
  });

  fastify.route({
    method: 'GET',
    url: '/user/logout',
    preHandler: fastify.auth([fastify.verifySession]),
    schema: {
      security: [{ cookieAuth: [] }],
      description: 'Logout an user',
      tags: ['users'],
      response: {
        401: {
          description: 'Unauthorized',
          $ref: 'error#',
        },
        500: {
          description: 'Internal Server Error',
          $ref: 'error#',
        },
        200: {
          description: 'Logout response',
          type: 'object',
          properties: {
            authenticated: { type: 'boolean' },
          },
        },
      },
    },
    handler: async function (request, reply) {
      request.session.user = null;
      request.session.destroy((err) => {
        if (err) {
          reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: err.message,
          });
        }
        reply.send({ authenticated: false });
      });
    },
  });

  fastify.post(
    '/user/register',
    {
      schema: {
        description: 'Register an user',
        body: {
          $ref: 'user#',
        },
        tags: ['users'],
        response: {
          200: {
            description: 'User registration response',
            $ref: 'user#',
          },
        },
        500: {
          description: 'Internal Server Error',
          $ref: 'error#',
        },
      },
    },
    async function (request, reply) {
      const { name, last_name, email, username, password } = request.body;
      const user = fastify.db.createUser({
        name,
        last_name,
        email,
        username,
        password,
      });
      return reply.send(user);
    }
  );

  fastify.route({
    method: 'GET',
    url: '/user/profile',
    preHandler: fastify.auth([fastify.verifySession]),
    schema: {
      security: [{ cookieAuth: [] }],
      description: 'Get user profile',
      tags: ['users'],
      response: {
        401: {
          description: 'Unauthorized',
          $ref: 'error#',
        },
        200: {
          type: 'object',
          description: 'User profile',
          $ref: 'user#',
        },
      },
    },
    handler: async function (request, reply) {
      reply.send(request.session.user);
    },
  });
}
