import { build } from './app.js';
import { getLogger } from './lib/logger.js';
import { config } from './config.js';

const server = await build({
  logger: getLogger(),
});

await server.listen({ port: config.PORT, host: '0.0.0.0' });
