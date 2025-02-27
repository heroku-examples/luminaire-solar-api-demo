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
      operationId: 'authenticate',
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
            authorization: { type: 'string' },
          },
        },
      },
    },
    handler: async function (request, reply) {
      const { username } = request.body;
      const user = await fastify.db.getUserByUsername(username);
      const authorization = await reply.jwtSign({ user });
      reply.send({
        authorization,
      });
    },
  });

  fastify.post(
    '/user/register',
    {
      schema: {
        operationId: 'register',
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
      const user = await fastify.db.createUser({
        name,
        last_name,
        email,
        username,
        password,
      });
      return reply.send(user);
    }
  );
}
