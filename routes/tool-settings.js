import { ToolSettingsService } from '../services/tool-settings/index.js';
import { errorSchema } from '../schemas/index.js';

export default async function (fastify, _opts) {
  const toolSettingsService = new ToolSettingsService(fastify.pg);

  fastify.addSchema({
    $id: 'error',
    ...errorSchema,
  });

  // Schema definitions
  const toolSettingsResponseSchema = {
    type: 'object',
    properties: {
      tools: {
        type: 'object',
        properties: {
          postgres_query: { type: 'boolean' },
          postgres_schema: { type: 'boolean' },
          html_to_markdown: { type: 'boolean' },
          pdf_to_markdown: { type: 'boolean' },
          code_exec_python: { type: 'boolean' },
        },
      },
      cache: {
        type: 'object',
        properties: {
          schema_cache: { type: 'boolean' },
        },
      },
      whitelists: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                url: { type: 'string' },
                description: { type: ['string', 'null'] },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
          pdfs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                pdf_url: { type: 'string' },
                description: { type: ['string', 'null'] },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      updated_at: { type: 'string', format: 'date-time' },
    },
  };

  // GET /tool-settings - Get current user's tool settings
  fastify.get(
    '/tool-settings',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'getToolSettings',
        description:
          'Retrieves the AI tool configuration settings for the authenticated user, including enabled/disabled tools, whitelisted URLs and PDFs, and cache settings.',
        tags: ['tool-settings'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            description: 'Successfully retrieved tool settings',
            ...toolSettingsResponseSchema,
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description: 'Server error while retrieving settings',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      try {
        const userId = request.user.user.id;
        const settings = await toolSettingsService.getSettings(userId);
        return reply.send(settings);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to retrieve tool settings',
          message: error.message,
        });
      }
    }
  );

  // PUT /tool-settings - Update tool settings
  fastify.put(
    '/tool-settings',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'updateToolSettings',
        description:
          'Updates the AI tool configuration settings for the authenticated user. Allows enabling/disabling specific tools and cache settings.',
        tags: ['tool-settings'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          description: 'Tool settings to update',
          properties: {
            postgres_query: {
              type: 'boolean',
              description: 'Enable/disable PostgreSQL query execution',
            },
            postgres_schema: {
              type: 'boolean',
              description: 'Enable/disable PostgreSQL schema introspection',
            },
            html_to_markdown: {
              type: 'boolean',
              description: 'Enable/disable web browsing (HTML to Markdown)',
            },
            pdf_to_markdown: {
              type: 'boolean',
              description: 'Enable/disable PDF browsing (PDF to Markdown)',
            },
            code_exec_python: {
              type: 'boolean',
              description: 'Enable/disable Python code execution',
            },
            schema_cache: {
              type: 'boolean',
              description: 'Enable/disable database schema caching',
            },
          },
        },
        response: {
          200: {
            description: 'Successfully updated tool settings',
            ...toolSettingsResponseSchema,
          },
          400: {
            description: 'Invalid request - No valid fields provided',
            $ref: 'error#',
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description: 'Server error while updating settings',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      try {
        const userId = request.user.user.id;
        const settings = await toolSettingsService.updateSettings(
          userId,
          request.body
        );
        return reply.send(settings);
      } catch (error) {
        fastify.log.error(error);
        if (error.message === 'No valid fields to update') {
          return reply.code(400).send({
            error: 'Bad Request',
            message: error.message,
          });
        }
        return reply.code(500).send({
          error: 'Failed to update tool settings',
          message: error.message,
        });
      }
    }
  );

  // POST /tool-settings/whitelists/urls - Add URL to whitelist
  fastify.post(
    '/tool-settings/whitelists/urls',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'addWhitelistUrl',
        description:
          'Adds a URL to the whitelist for the html_to_markdown tool. Only whitelisted URLs can be accessed by the AI assistant.',
        tags: ['tool-settings'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'The URL to whitelist',
            },
            description: {
              type: 'string',
              description: 'Optional description for the whitelisted URL',
            },
          },
        },
        response: {
          200: {
            description: 'Successfully added URL to whitelist',
            type: 'object',
            properties: {
              id: { type: 'integer' },
              url: { type: 'string' },
              description: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            description: 'Invalid request - Missing or invalid URL',
            $ref: 'error#',
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description: 'Server error while adding URL to whitelist',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      try {
        const userId = request.user.user.id;
        const { url, description } = request.body;
        const whitelistEntry = await toolSettingsService.addWhitelistUrl(
          userId,
          url,
          description
        );
        return reply.send(whitelistEntry);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to add URL to whitelist',
          message: error.message,
        });
      }
    }
  );

  // DELETE /tool-settings/whitelists/urls/:id - Remove URL from whitelist
  fastify.delete(
    '/tool-settings/whitelists/urls/:id',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'removeWhitelistUrl',
        description:
          'Removes a URL from the whitelist. The URL will no longer be accessible by the html_to_markdown tool.',
        tags: ['tool-settings'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'integer',
              description: 'The ID of the whitelisted URL to remove',
            },
          },
        },
        response: {
          200: {
            description: 'Successfully removed URL from whitelist',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          404: {
            description: 'URL not found in whitelist',
            $ref: 'error#',
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description: 'Server error while removing URL from whitelist',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      try {
        const userId = request.user.user.id;
        const { id } = request.params;
        const success = await toolSettingsService.removeWhitelistUrl(
          userId,
          id
        );
        if (!success) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'URL not found in whitelist',
          });
        }
        return reply.send({
          success: true,
          message: 'URL removed from whitelist',
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to remove URL from whitelist',
          message: error.message,
        });
      }
    }
  );

  // POST /tool-settings/whitelists/pdfs - Add PDF to whitelist
  fastify.post(
    '/tool-settings/whitelists/pdfs',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'addWhitelistPdf',
        description:
          'Adds a PDF URL to the whitelist for the pdf_to_markdown tool. Only whitelisted PDFs can be accessed by the AI assistant.',
        tags: ['tool-settings'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['pdf_url'],
          properties: {
            pdf_url: {
              type: 'string',
              format: 'uri',
              description: 'The PDF URL to whitelist',
            },
            description: {
              type: 'string',
              description: 'Optional description for the whitelisted PDF',
            },
          },
        },
        response: {
          200: {
            description: 'Successfully added PDF to whitelist',
            type: 'object',
            properties: {
              id: { type: 'integer' },
              pdf_url: { type: 'string' },
              description: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            description: 'Invalid request - Missing or invalid PDF URL',
            $ref: 'error#',
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description: 'Server error while adding PDF to whitelist',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      try {
        const userId = request.user.user.id;
        const { pdf_url, description } = request.body;
        const whitelistEntry = await toolSettingsService.addWhitelistPdf(
          userId,
          pdf_url,
          description
        );
        return reply.send(whitelistEntry);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to add PDF to whitelist',
          message: error.message,
        });
      }
    }
  );

  // DELETE /tool-settings/whitelists/pdfs/:id - Remove PDF from whitelist
  fastify.delete(
    '/tool-settings/whitelists/pdfs/:id',
    {
      preHandler: fastify.auth([fastify.verifyJwt]),
      schema: {
        operationId: 'removeWhitelistPdf',
        description:
          'Removes a PDF from the whitelist. The PDF will no longer be accessible by the pdf_to_markdown tool.',
        tags: ['tool-settings'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'integer',
              description: 'The ID of the whitelisted PDF to remove',
            },
          },
        },
        response: {
          200: {
            description: 'Successfully removed PDF from whitelist',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          404: {
            description: 'PDF not found in whitelist',
            $ref: 'error#',
          },
          401: {
            description:
              'Unauthorized - Invalid or missing authentication token',
            $ref: 'error#',
          },
          500: {
            description: 'Server error while removing PDF from whitelist',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      try {
        const userId = request.user.user.id;
        const { id } = request.params;
        const success = await toolSettingsService.removeWhitelistPdf(
          userId,
          id
        );
        if (!success) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'PDF not found in whitelist',
          });
        }
        return reply.send({
          success: true,
          message: 'PDF removed from whitelist',
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to remove PDF from whitelist',
          message: error.message,
        });
      }
    }
  );
}
