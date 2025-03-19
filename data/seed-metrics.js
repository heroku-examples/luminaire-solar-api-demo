import 'dotenv/config';
import pg from 'pg';
import { faker } from '@faker-js/faker';
import { getLogger } from '../lib/logger.js';

const METRIC_COUNT = 24 * 10; // 24 metrics per day for 10 days

const logger = getLogger();

async function seed() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    // Cleanup existing data
    const systemIds = (await client.query(`SELECT id FROM systems`)).rows.map(
      (row) => row.id
    );

    // Seed metrics
    for (let i = 0; i < systemIds.length; i++) {
      logger.info(`Seeding system ${i + 1} of ${systemIds.length}`);
      for (let j = 0; j < METRIC_COUNT; j++) {
        let date = new Date(Date.now() - j * 3600 * 1000);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        await client.query(
          `INSERT INTO metrics (system_id, datetime, energy_produced, energy_consumed) VALUES ($1, $2, $3, $4)`,
          [
            systemIds[i],
            date,
            faker.number.float({ min: 0, max: 25, fractionDigits: 2 }),
            faker.number.float({ min: 0, max: 20, fractionDigits: 2 }),
          ]
        );
      }
    }
  } finally {
    client.release();
  }
}

seed()
  .then(() => {
    logger.info('Database seeded.');
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
