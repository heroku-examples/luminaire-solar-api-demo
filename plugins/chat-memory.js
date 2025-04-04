import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';

export default fp(async (fastify) => {
  try {
    // Ensure Redis plugin is loaded
    if (!fastify.redis) {
      throw new Error('Redis plugin is not loaded');
    }

    // Key prefixes for Redis
    const CHAT_SESSION_PREFIX = 'chat:session:';

    fastify.decorate('chatMemory', {
      /**
       * Store a message in the chat memory
       * @param {Object} message - The message to store
       * @param {string} message.sessionId - The session ID
       * @param {string} message.role - The role of the message sender (user, assistant, agent, error)
       * @param {string} message.content - The message content
       * @returns {Promise<Object>} - The stored message
       */
      storeMessage: async ({ sessionId, role, content }) => {
        const timestamp = new Date().toISOString();
        const id = randomUUID();

        // Create message object
        const message = {
          id,
          session_id: sessionId,
          role,
          content,
          timestamp,
        };

        // Store message in Redis
        // 1. Add to session list
        await fastify.redis.rpush(
          `${CHAT_SESSION_PREFIX}${sessionId}`,
          JSON.stringify(message)
        );

        // 2. Set expiration for session (2 hours)
        await fastify.redis.expire(
          `${CHAT_SESSION_PREFIX}${sessionId}`,
          60 * 60 * 2
        );

        return message;
      },

      /**
       * Get messages for a session
       * @param {string} sessionId - The session ID
       * @param {number} limit - The maximum number of messages to retrieve (default: 10)
       * @returns {Promise<Array>} - The messages
       */
      getSessionMessages: async (sessionId, limit = 10) => {
        // Get messages from Redis
        const messages = await fastify.redis.lrange(
          `${CHAT_SESSION_PREFIX}${sessionId}`,
          0,
          limit - 1
        );

        // Parse JSON strings to objects
        return messages.map((msg) => JSON.parse(msg));
      },

      /**
       * Get messages formatted for OpenAI API
       * @param {string} sessionId - The session ID
       * @param {number} limit - The maximum number of messages to retrieve (default: 10)
       * @returns {Promise<Array>} - The messages formatted for OpenAI API
       */
      getFormattedMessages: async (sessionId, limit = 10) => {
        // Get messages from Redis (last N messages)
        const messages = await fastify.redis.lrange(
          `${CHAT_SESSION_PREFIX}${sessionId}`,
          -limit,
          -1
        );

        // Parse JSON strings and format for OpenAI API
        return messages.map((msg) => {
          const parsed = JSON.parse(msg);
          return {
            role: parsed.role === 'agent' ? 'assistant' : parsed.role,
            content: parsed.content,
          };
        });
      },

      /**
       * Delete messages for a session
       * @param {string} sessionId - The session ID
       * @returns {Promise<number>} - The number of deleted messages
       */
      deleteSessionMessages: async (sessionId) => {
        // Get the number of messages in the session
        const count = await fastify.redis.llen(
          `${CHAT_SESSION_PREFIX}${sessionId}`
        );

        // Delete the session
        await fastify.redis.del(`${CHAT_SESSION_PREFIX}${sessionId}`);

        return count;
      },
    });
  } catch (err) {
    fastify.log.error({ err }, 'Error setting up chat memory');
  }
});
