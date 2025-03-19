import { build } from './app.js';
import { loggerOptions } from './lib/logger.js';
import { config } from './config.js';

// Create the server instance
const server = await build({
  logger: loggerOptions,
});

// In Fastify 5.x, the listen method only accepts an options object
await server.listen({
  port: config.PORT,
  host: '0.0.0.0',
});
