import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import {
  chatSchema,
  chatResponseSchema,
  chatHistorySchema,
  chatHistoryResponseSchema,
  clearChatHistorySchema,
  clearChatHistoryResponseSchema,
} from '../schemas/index.js';
import { MiaTransformStream } from '../lib/mia-utils.js';

export default async function (fastify, _opts) {
  fastify.addSchema({
    $id: 'chat',
    ...chatSchema,
  });

  fastify.addSchema({
    $id: 'chatResponse',
    ...chatResponseSchema,
  });

  fastify.addSchema({
    $id: 'chatHistory',
    ...chatHistorySchema,
  });

  fastify.addSchema({
    $id: 'chatHistoryResponse',
    ...chatHistoryResponseSchema,
  });

  fastify.addSchema({
    $id: 'clearChatHistory',
    ...clearChatHistorySchema,
  });

  fastify.addSchema({
    $id: 'clearChatHistoryResponse',
    ...clearChatHistoryResponseSchema,
  });

  fastify.post('/chat', {
    schema: {
      operationId: 'completionChat',
      security: [{ BearerAuth: [] }],
      body: {
        description:
          'Send a question to the AI assistant and receive a streaming response. This endpoint enables real-time conversation with the AI, with optional session tracking for maintaining context across multiple interactions.',
        $ref: 'chat#',
      },
      response: {
        200: {
          type: 'string',
          description:
            "A streaming response containing newline-delimited JSON objects, each representing a chunk of the AI's response. Clients should process this stream incrementally, appending each chunk to build the complete response.",
          examples: [
            '{"role":"assistant","content":"message content"}\n{"role":"assistant","content":"next chunk"}\n',
          ],
          content: {
            'application/x-ndjson': {
              schema: { $ref: 'chatResponse#' },
            },
          },
        },
      },
      tags: ['chat'],
    },
    preHandler: fastify.auth([fastify.verifyJwt]),
    handler: async function (request, reply) {
      const { question, sessionId = randomUUID(), systemId } = request.body;
      let isNewConversation = !request.body.sessionId;

      try {
        // Get the completion stream with memory
        const stream = await fastify.ai.executeCompletion(question, {
          sessionId,
          systemId,
        });

        const jsonStream = Readable.from(stream, {
          objectMode: true,
        });

        const summarizeStream = new MiaTransformStream(
          { objectMode: true },
          fastify.chatMemory,
          sessionId,
          isNewConversation
        );

        jsonStream.on('error', (err) => {
          fastify.log.error({ err }, 'Error reading chat stream');
          summarizeStream.destroy(err);
          return reply.raw.write(
            JSON.stringify({
              role: 'error',
              content: err.message,
              sessionId,
            })
          );
        });

        // Set up the response
        return reply
          .type('application/x-ndjson')
          .send(jsonStream.pipe(summarizeStream));
      } catch (err) {
        fastify.log.error({ err }, 'Error executing chat completion');
        reply.raw.write(
          JSON.stringify({
            role: 'error',
            content: 'Error executing the chat completion, please try again',
            sessionId,
          })
        );
      }
    },
  });

  // Get chat history for a session
  fastify.get('/chat/history', {
    schema: {
      operationId: 'getChatHistory',
      security: [{ BearerAuth: [] }],
      querystring: {
        description:
          'Retrieve the conversation history for a specific chat session. This endpoint returns past messages exchanged between the user and the AI assistant, providing context for ongoing conversations and allowing users to review previous interactions.',
        $ref: 'chatHistory#',
      },
      response: {
        200: {
          description:
            'Successfully retrieved the conversation history. The response contains an array of messages in chronological order, each with complete details including sender role, content, and timestamp.',
          $ref: 'chatHistoryResponse#',
        },
      },
      tags: ['chat'],
    },
    preHandler: fastify.auth([fastify.verifyJwt]),
    handler: async function (request, reply) {
      const { sessionId, limit = 10 } = request.query;

      if (!fastify.chatMemory) {
        return reply.code(500).send({
          error: 'Chat memory is not enabled',
        });
      }

      try {
        const history = await fastify.ai.getChatHistory(sessionId, limit);
        return reply.send(history);
      } catch (err) {
        fastify.log.error({ err }, 'Error retrieving chat history');
        return reply.code(500).send({
          error: 'Error retrieving chat history',
          message: err.message,
        });
      }
    },
  });

  // Clear chat history for a session
  fastify.delete('/chat/history', {
    schema: {
      operationId: 'clearChatHistory',
      security: [{ BearerAuth: [] }],
      body: {
        description: 'Clear chat history for a session',
        $ref: 'clearChatHistory#',
      },
      response: {
        200: {
          description: 'Chat history cleared',
          $ref: 'clearChatHistoryResponse#',
        },
      },
      tags: ['chat'],
    },
    preHandler: fastify.auth([fastify.verifyJwt]),
    handler: async function (request, reply) {
      const { sessionId } = request.body;

      if (!fastify.chatMemory) {
        return reply.code(500).send({
          error: 'Chat memory is not enabled',
        });
      }

      try {
        const deleted = await fastify.ai.clearChatHistory(sessionId);
        return reply.send({
          deleted,
          sessionId,
        });
      } catch (err) {
        fastify.log.error({ err }, 'Error clearing chat history');
        return reply.code(500).send({
          error: 'Error clearing chat history',
          message: err.message,
        });
      }
    },
  });
}
