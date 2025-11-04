import 'dotenv/config';
import pg from 'pg';
import { faker } from '@faker-js/faker';
import { getLogger } from '../lib/logger.js';

const logger = getLogger();

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    // Get systems
    const systems = await client.query('SELECT * FROM systems');
    // Generate metrics for the current hour
    for (const system of systems.rows) {
      // Realistic household values: 0-5 kWh/hour produced (varies by time of day)
      // Average residential system produces ~20-30 kWh/day
      const energyProduced = faker.number.float({
        min: 0,
        max: 5,
        fractionDigits: 2,
      });
      // Realistic household consumption: 0.5-3 kWh/hour
      // Average household uses ~30-40 kWh/day
      const energyConsumed = faker.number.float({
        min: 0.5,
        max: 3,
        fractionDigits: 2,
      });
      const date = new Date();
      date.setMinutes(0);
      date.setSeconds(0);
      date.setMilliseconds(0);
      logger.info(
        `Generating metrics for system ${system.id} at ${date.toISOString()}`
      );
      await client.query(
        `INSERT INTO metrics (system_id, datetime, energy_produced, energy_consumed) VALUES ($1, $2, $3, $4)`,
        [system.id, date, energyProduced, energyConsumed]
      );
    }
  } finally {
    client.release();
  }
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
