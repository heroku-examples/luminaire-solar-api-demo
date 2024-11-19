import { Readable, Transform } from 'node:stream';

export default async function (fastify, _opts) {
  fastify.addSchema({
    $id: 'chat',
    type: 'object',
    description: 'Question to the AI agent',
    properties: {
      question: { type: 'string' },
    },
    required: ['question'],
  });

  fastify.addSchema({
    $id: 'chatResponse',
    type: 'object',
    description: 'Response from the AI agent',
    properties: {
      role: {
        type: 'string',
        enum: ['user', 'assistant', 'agent', 'error'],
        description: 'The role of the message sender',
      },
      content: {
        type: 'string',
        description: 'The message content chunk',
      },
    },
    required: ['role', 'content'],
  });

  fastify.post(
    '/chat',
    {
      schema: {
        body: {
          description: 'Ask a question to the AI agent',
          $ref: 'chat#',
        },
        response: {
          200: {
            type: 'string',
            description: 'A stream of newline-delimited JSON chat responses.',
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
    },
    async function (request, reply) {
      const { question } = request.body;

      try {
        const stream = await fastify.ai.executeCompletion(question);

        const jsonStream = Readable.from(stream, {
          objectMode: true,
        });

        const heartbeat = setInterval(() => {
          jsonStream.push({
            choices: [
              {
                message: { role: 'agent', content: 'Still working...' },
              },
            ],
          });
        }, 30000);

        const summarizeStream = new Transform({
          objectMode: true,
          transform(chunk, encoding, callback) {
            try {
              const summarizedResponse = JSON.stringify({
                role: 'agent',
                content: summarizeMessage(chunk.choices[0]?.message),
              });
              this.lastChunk = chunk;
              callback(null, summarizedResponse + '\n');
            } catch (err) {
              callback(err);
            }
          },
          flush(callback) {
            try {
              if (this.lastChunk) {
                const lastResponse = JSON.stringify(
                  this.lastChunk.choices[0]?.message || {}
                );
                this.push(lastResponse + '\n');
              }
              callback();
            } catch (err) {
              callback(err);
            } finally {
              clearInterval(heartbeat);
            }
          },
        });

        return reply
          .type('application/x-ndjson')
          .send(jsonStream.pipe(summarizeStream));
      } catch (err) {
        fastify.log.error({ err }, 'Error executing chat completion');
        reply.code(500).send({
          role: 'error',
          content: 'Error executing the chat completion, please try again',
        });
      }
    }
  );

  function summarizeMessage(message) {
    switch (message.role) {
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

          if (
            /^web_browsing_single_page|^web_browsing_multi_page/.test(
              functionName
            )
          ) {
            return `Fetching the page ${args.url} ...`;
          } else if (/^code_exec_ruby/.test(functionName)) {
            return 'Executing Ruby code...';
          } else if (/^code_exec_python/.test(functionName)) {
            return 'Executing Python code...';
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
          } else if (functionName === 'create_pie_chart') {
            return 'The agent is requesting a local tool...';
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
        return 'Unknown role.';
    }
  }
}
