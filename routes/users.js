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
      description:
        'Authenticates a user by validating their credentials and issues a secure JWT token for subsequent API access. This endpoint handles user login, verifies the provided username and password, and returns an authorization token that must be included in future requests to access protected resources.',
      body: {
        type: 'object',
        description: 'User credentials required for authentication',
        properties: {
          username: {
            type: 'string',
            description: 'Unique username of the registered user account',
          },
          password: {
            type: 'string',
            format: 'password',
            description: "User's password for account verification",
          },
        },
        required: ['username', 'password'],
      },
      tags: ['users'],
      response: {
        401: {
          description:
            "Authentication failed due to invalid credentials. This occurs when the provided username doesn't exist or the password is incorrect.",
          $ref: 'error#',
        },
        200: {
          description:
            'Authentication successful. Returns a JWT token that must be included in the Authorization header for subsequent API requests to access protected resources.',
          type: 'object',
          properties: {
            authorization: {
              type: 'string',
              description:
                'JWT token to be used for authenticating subsequent API requests',
            },
          },
        },
      },
    },
    handler: async function (request, reply) {
      const { username } = request.body;
      const user = await fastify.db.getUserByUsername(username);
      const authorization = await reply.jwtSign(
        { user },
        {
          sub: user.username,
          kid: 'luminaire',
          iss: 'luminaire',
          expiresIn: '1d',
        }
      );
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
        description:
          "Registers a new user account in the system with the provided personal information and credentials. This endpoint creates a new user profile, securely stores the password, and establishes the user's identity for future authentication and access to solar system monitoring features.",
        body: {
          $ref: 'user#',
          description:
            'Complete user profile information required for registration including personal details and account credentials',
        },
        tags: ['users'],
        response: {
          200: {
            description:
              'User registration successful. Returns the newly created user profile information (excluding sensitive data like password) to confirm the account creation.',
            $ref: 'user#',
          },
        },
        500: {
          description:
            'Server encountered an unexpected error during user registration. This may occur due to database issues, validation failures, or conflicts with existing user accounts.',
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
