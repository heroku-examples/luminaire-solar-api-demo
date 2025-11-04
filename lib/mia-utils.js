import { Transform } from 'node:stream';
import { getLogger } from '../lib/logger.js';

const logger = getLogger();

// summarizeMessage function will be moved here
export function summarizeMessage(message) {
  try {
    switch (message?.role) {
      case 'user':
        return { role: message.role, content: 'Prompt sent.' };

      case 'agent':
        return { role: message.role, content: message.content };

      case 'assistant':
        // eslint-disable-next-line no-case-declarations
        const toolCall = message.tool_calls?.[0];

        if (toolCall) {
          try {
            const args = JSON.parse(toolCall.function?.arguments || '{}');
            const functionName = toolCall.function?.name;

            logger.info(toolCall, 'agent tool call');

            if (/^html_to_markdown/.test(functionName)) {
              return {
                role: 'tool',
                tool: 'html_to_markdown',
                content: `Fetching the page ${args.url} ...`,
              };
            } else if (/^code_exec_ruby/.test(functionName)) {
              return {
                role: 'tool',
                tool: 'code_exec_ruby',
                content: 'Executing Ruby code...',
              };
            } else if (
              /^code_exec_python|^mcp\/code_exec_python/.test(functionName)
            ) {
              return {
                role: 'tool',
                tool: 'code_exec_python',
                content: `Executing Python code...`,
              };
            } else if (/^code_exec_node/.test(functionName)) {
              return {
                role: 'tool',
                tool: 'code_exec_node',
                content: 'Executing Node.js code...',
              };
            } else if (/^code_exec_go/.test(functionName)) {
              return {
                role: 'tool',
                tool: 'code_exec_go',
                content: 'Compiling and executing Go code...',
              };
            } else if (/^postgres_get_schema/.test(functionName)) {
              return {
                role: 'tool',
                tool: 'postgres_get_schema',
                content: 'Fetching the schema for the database...',
              };
            } else if (/^postgres_run_query/.test(functionName)) {
              return {
                role: 'tool',
                tool: 'postgres_run_query',
                content: 'Querying the database...',
              };
            } else if (/^dyno_run_command/.test(functionName)) {
              return {
                role: 'tool',
                tool: 'dyno_run_command',
                content: 'Running the command on the Heroku dyno...',
              };
            } else if (/^pdf_to_markdown/.test(functionName)) {
              return {
                role: 'tool',
                tool: 'pdf_to_markdown',
                content: `Reading the PDF at ${args.url} ...`,
              };
            }
          } catch (parseErr) {
            logger.error(
              { err: parseErr, toolCall },
              'Error parsing tool call arguments'
            );
            return {
              role: 'tool',
              tool: 'unknown',
              content: 'Processing tool response...',
            };
          }
        } else {
          return {
            role: 'assistant',
            content: 'The agent has the information it needs.',
          };
        }
        break;

      case 'error':
        return {
          role: message.role,
          content: `Error: ${message.content || 'Unknown error'}`,
        };

      default:
        return { role: message.role, content: message.content };
    }
  } catch (err) {
    logger.error(
      {
        err,
        message:
          typeof message === 'object'
            ? JSON.stringify(message).substring(0, 200)
            : String(message),
      },
      'Error in summarizeMessage'
    );
    return 'Processing response...';
  }
}

export class MiaTransformStream extends Transform {
  constructor(options, chatMemory, sessionId, initialIsNewConversation) {
    super(options);
    this.chatMemory = chatMemory;
    this.sessionId = sessionId;
    this.isNewConversation = initialIsNewConversation;
    this.incompleteMessageBuffer = '';
    this.isBuffering = false;
    this.logger = logger;
  }

  _extractMessage(chunk) {
    try {
      // Convert Uint8Array to string
      const responseChunk = Buffer.from(chunk).toString('utf-8');

      // Skip empty chunks
      if (!responseChunk || responseChunk.trim() === '') {
        return null;
      }

      // Check for heartbeat events first and skip them
      if (
        responseChunk.includes('event:heartbeat') ||
        responseChunk.includes('data:heartbeat') ||
        responseChunk.trim() === 'event:ping' ||
        responseChunk.trim() === ':heartbeat'
      ) {
        this.logger.debug('Heartbeat received, skipping');
        return null;
      }

      // Extract the event type if present (do this early for better logging)
      let eventType = 'message'; // Default event type
      const eventMatch = responseChunk.match(/event:([^\n]*)/);
      if (eventMatch && eventMatch[1]) {
        eventType = eventMatch[1].trim();
      }

      // If we're buffering, add this chunk and check if we have a complete message
      if (this.isBuffering) {
        this.incompleteMessageBuffer += responseChunk;
        this.logger.info(
          {
            eventType,
            bufferLength: this.incompleteMessageBuffer.length,
          },
          'Added to buffer'
        );

        // Try to parse the complete buffer
        try {
          // Look for a complete message pattern in the accumulated buffer
          const bufferDataMatch = this.incompleteMessageBuffer.match(
            /data:(.*?)(?=event:|$)/s
          );
          if (bufferDataMatch && bufferDataMatch[1]) {
            const bufferDataString = bufferDataMatch[1].trim();

            // Skip empty data or [DONE] markers
            if (!bufferDataString || bufferDataString === '[DONE]') {
              this.incompleteMessageBuffer = '';
              this.isBuffering = false;
              return { role: '', content: '' };
            }

            // Safely parse the JSON
            try {
              const jsonData = JSON.parse(bufferDataString);
              // Reset buffer after successful parse
              this.incompleteMessageBuffer = '';
              this.isBuffering = false;
              this.logger.info('Successfully parsed buffered message');
              const result =
                jsonData.choices[0]?.delta || jsonData.choices[0]?.message;
              // Validate the result can be safely stringified
              JSON.stringify(result);
              return result;
            } catch (_jsonErr) {
              // Incomplete message, continue buffering silently
            }
          }
        } catch (bufferErr) {
          // Still incomplete, continue buffering silently
          this.logger.info(
            { error: bufferErr.message },
            'Buffer still incomplete'
          );
          // Return null to signal we need to skip this chunk but not emit anything
          return null;
        }
      }

      // If the chunk contains SSE format data, parse it
      if (responseChunk.includes('data:')) {
        // Skip specific event types
        if (['heartbeat', 'ping', 'keep-alive'].includes(eventType)) {
          this.logger.debug(
            { eventType },
            'Non-message event received, skipping'
          );
          return null;
        }

        // Handle done events
        if (eventType === 'done') {
          // Flush any buffered content before ending
          if (this.incompleteMessageBuffer && this.isBuffering) {
            this.logger.info(
              { buffer: this.incompleteMessageBuffer },
              'Flushing incomplete buffer on done event'
            );
            this.isBuffering = false;
            this.incompleteMessageBuffer = '';
          }
          return { role: '', content: '' };
        }

        // Check for error events
        if (eventType === 'error') {
          const errorMatch = responseChunk.match(/data:(.*)/);
          if (errorMatch && errorMatch[1]) {
            try {
              const errorData = JSON.parse(errorMatch[1].trim());
              // Return the error with a special error role that we can detect downstream
              return {
                role: 'error',
                content: errorData.message || 'An error occurred',
                error: errorData,
              };
            } catch (jsonErr) {
              this.logger.error(
                {
                  err: jsonErr,
                  chunk: errorMatch[1].trim().substring(0, 200),
                },
                'Error parsing error event data'
              );
              return {
                role: 'error',
                content: 'Error parsing server response',
              };
            }
          }
        }

        // Handle regular message events
        const dataMatch = responseChunk.match(/data:(.*)/);
        if (dataMatch && dataMatch[1]) {
          const dataString = dataMatch[1].trim();
          // Skip [DONE] messages
          if (dataString === '[DONE]') {
            // Flush any buffered content before ending
            if (this.incompleteMessageBuffer && this.isBuffering) {
              this.logger.info(
                { buffer: this.incompleteMessageBuffer },
                'Flushing incomplete buffer on [DONE]'
              );
              this.isBuffering = false;
              this.incompleteMessageBuffer = '';
            }
            return { role: '', content: '' };
          }

          try {
            const jsonData = JSON.parse(dataString);
            // Reset buffer when we successfully parse a complete message
            this.incompleteMessageBuffer = '';
            this.isBuffering = false;
            const result =
              jsonData.choices[0]?.delta || jsonData.choices[0]?.message;
            // Validate the result can be safely stringified
            JSON.stringify(result);
            return result;
          } catch (parseErr) {
            // Handle incomplete JSON - likely a multi-chunk message
            if (
              parseErr instanceof SyntaxError &&
              (parseErr.message.includes('Unterminated string') ||
                parseErr.message.includes('Unexpected end of JSON input'))
            ) {
              // Start buffering
              this.isBuffering = true;
              this.incompleteMessageBuffer += responseChunk;
              this.logger.info(
                {
                  buffer:
                    this.incompleteMessageBuffer.substring(0, 100) + '...',
                },
                'Started buffering incomplete message chunk'
              );
              // Return null to signal we need to skip this chunk but not emit anything
              return null;
            }

            // If it's a JSON parsing error (but not an incomplete message), log it and return error
            this.logger.error(
              { err: parseErr, dataString: dataString.substring(0, 200) },
              'Error parsing message JSON'
            );
            return {
              role: 'error',
              content: `Error parsing server response: ${parseErr.message}`,
            };
          }
        }
      }

      // If we get here, try to parse the chunk as a regular JSON object
      try {
        const jsonData =
          typeof responseChunk === 'string'
            ? JSON.parse(responseChunk)
            : responseChunk;
        const result =
          jsonData.choices[0]?.delta || jsonData.choices[0]?.message;
        // Validate the result can be safely stringified
        JSON.stringify(result);
        return result;
      } catch (_err) {
        // If it's a JSON parsing error, return null to signal we need to skip this chunk but not emit anything
        return null;
      }
    } catch (outerErr) {
      // Catch any unexpected errors in the extraction process
      this.logger.error(
        { err: outerErr },
        'Unexpected error in message extraction'
      );
      return {
        role: 'error',
        content: 'Internal error processing server response',
      };
    }
  }

  _transform(chunk, encoding, callback) {
    try {
      // If it's a new conversation, send an initial welcome message before the stream
      if (this.isNewConversation) {
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
            sessionId: this.sessionId,
          }) + '\n';
        this.push(initialMessage);
        this.isNewConversation = false;
      }

      const message = this._extractMessage(chunk);

      // Skip chunks that are being buffered (message is null)
      if (message === null) {
        return callback();
      }

      // Handle error messages specifically
      if (message.role === 'error') {
        const errorResponse =
          JSON.stringify({
            role: 'error',
            content: message.content,
            sessionId: this.sessionId,
          }) + '\n';
        callback(null, errorResponse);
        return;
      }

      if (
        (message.role === 'assistant' && !message.tool_calls) ||
        message.role === ''
      ) {
        // Store assistant responses in chat memory
        if (message.content) {
          if (this.chatMemory) {
            this.chatMemory
              .storeMessage({
                sessionId: this.sessionId,
                role: 'assistant',
                content: message.content,
              })
              .catch((err) => {
                this.logger.error(
                  { err },
                  'Error storing assistant message in chat memory'
                );
              });
          }
          this.push(message.content);
        }
        return callback();
      }

      // Ignore tool output
      if (message.role === 'tool') {
        return callback();
      }

      // Get summarized content safely
      let summarizedMessage;
      try {
        summarizedMessage = summarizeMessage(message, this.logger);
      } catch (err) {
        this.logger.error(
          {
            err,
            message:
              typeof message === 'object'
                ? JSON.stringify(message).substring(0, 200)
                : String(message),
          },
          'Error in summarizeMessage'
        );
        summarizedMessage = {
          role: 'error',
          content: 'Error processing tool response',
        };
      }

      // Create the response
      let summarizedResponse;
      try {
        summarizedResponse =
          JSON.stringify({
            role: summarizedMessage.role,
            content: summarizedMessage.content,
            tool: summarizedMessage.tool,
            sessionId: this.sessionId,
          }) + '\n';
      } catch (jsonErr) {
        this.logger.error(
          { err: jsonErr },
          'Error stringifying summarized response'
        );
        // Fallback to a safe response
        summarizedResponse =
          JSON.stringify({
            role: 'error',
            content: 'Error creating response',
            sessionId: this.sessionId,
          }) + '\n';
      }

      this.lastChunk = chunk; // This was in the original code, keeping it for now.
      callback(null, summarizedResponse);
    } catch (err) {
      this.logger.error({ err, chunk }, 'Error in transform stream');
      // Send a valid error response
      const errorResponse =
        JSON.stringify({
          role: 'error',
          content: `Stream error: ${err.message}`,
          sessionId: this.sessionId,
        }) + '\n';
      this.push(errorResponse);
      callback(null); // Don't propagate error to avoid breaking the stream
    }
  }

  _flush(callback) {
    this.push('\n');
    callback();
  }
}
