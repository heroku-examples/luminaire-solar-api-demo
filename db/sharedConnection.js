import 'dotenv/config';
import pg from 'pg';

/**
 * This is a single shared connection to the DB (following the singleton pattern)
 *  for services that do not have access to the connection created through the
 *  main fastify framework.
 * The goal is to avoid creating multiple extraneous connections that need to be managed.
 */
async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  return client;
}

const sharedConnection = await main();
export default sharedConnection;
