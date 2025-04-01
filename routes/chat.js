import { Readable, Transform } from 'node:stream';
import { randomUUID } from 'node:crypto';
import {
  chatSchema,
  chatResponseSchema,
  chatHistorySchema,
  chatHistoryResponseSchema,
  clearChatHistorySchema,
  clearChatHistoryResponseSchema,
} from '../schemas/index.js';

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

        const extractMessage = (chunk) => {
          return chunk.choices[0]?.delta || chunk.choices[0]?.message;
        };

        const summarizeStream = new Transform({
          objectMode: true,
          transform(chunk, encoding, callback) {
            try {
              // If it's a new conversation, send an initial welcome message before the stream
              if (isNewConversation) {
                const currentDate = new Date();
                const formattedTime = currentDate.toLocaleString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZoneName: 'short',
                });

                const welcomeMessage = `Luminaire Agent session started at ${formattedTime}`;

                const initialMessage =
                  JSON.stringify({
                    role: 'agent',
                    content: welcomeMessage,
                    sessionId,
                  }) + '\n';
                this.push(initialMessage);
                isNewConversation = false;
              }

              const message = extractMessage(chunk);
              if (
                (message.role === 'assistant' && !message.tool_calls) ||
                message.role === ''
              ) {
                // Store assistant responses in chat memory
                if (message.content) {
                  fastify.chatMemory
                    .storeMessage({
                      sessionId,
                      role: 'assistant',
                      content: message.content,
                    })
                    .catch((err) => {
                      fastify.log.error(
                        { err },
                        'Error storing assistant message in chat memory'
                      );
                    });
                  this.push(message.content);
                }
                return callback();
              }

              const summarizedResponse =
                JSON.stringify({
                  role: 'agent',
                  content: summarizeMessage(message),
                  sessionId,
                }) + '\n';

              this.lastChunk = chunk;
              callback(null, summarizedResponse);
            } catch (err) {
              fastify.log.error({ err, chunk }, 'Error in transform stream');
              this.push(
                JSON.stringify({
                  role: 'error',
                  content: err.message,
                  sessionId,
                }) + '\n'
              );
              callback(err);
            }
          },
          flush(callback) {
            this.push('\n');
            callback();
          },
        });

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

  function summarizeMessage(message) {
    switch (message?.role) {
      case 'user':
        return 'Prompt sent.';

      case 'agent':
        return message.content;

      case 'assistant':
        // eslint-disable-next-line no-case-declarations
        const toolCall = message.tool_calls?.[0];

        if (toolCall) {
          const args = JSON.parse(toolCall.function?.arguments || '{}');
          const functionName = toolCall.function?.name;

          fastify.log.info(toolCall, 'agent tool call');

          if (
            /^web_browsing_single_page|^web_browsing_multi_page/.test(
              functionName
            )
          ) {
            return `Fetching the page ${args.url} ...`;
          } else if (/^code_exec_ruby/.test(functionName)) {
            return 'Executing Ruby code...';
          } else if (/^code_exec_python/.test(functionName)) {
            return `Executing Python code... ${message.content}`;
          } else if (/^code_exec_node/.test(functionName)) {
            return 'Executing Node.js code...';
          } else if (/^code_exec_go/.test(functionName)) {
            return 'Compiling and executing Go code...';
          } else if (/^database_get_schema/.test(functionName)) {
            return 'Fetching the schema for the database...';
          } else if (/^database_run_query/.test(functionName)) {
            return 'Querying the database...';
          } else if (/^dyno_run_command/.test(functionName)) {
            return 'Running the command on the Heroku dyno...';
          } else if (/^search_web/.test(functionName)) {
            return `Searching the web for ${args.search_query} ...`;
          } else if (/^pdf_read/.test(functionName)) {
            return `Reading the PDF at ${args.url} ...`;
          }
        } else {
          return 'The agent has the information it needs.';
        }
        break;

      default:
        return message.content;
    }
  }
}
