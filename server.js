import { build } from './app.js';
import { getLogger } from './lib/logger.js';

const port = +process.env.APP_PORT || 3000;

const server = await build({
  logger: getLogger(),
});

await server.listen({ port, host: '0.0.0.0' });
