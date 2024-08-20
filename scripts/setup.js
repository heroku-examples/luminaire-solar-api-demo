import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { getLogger } from '../lib/logger.js';

const logger = getLogger();

const { Pool } = pg;

const schema = readFileSync(
  path.join(import.meta.dirname, '../data', 'schema.sql'),
  'utf-8'
);

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    logger.info('Database setup complete');
    process.exit(0);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
