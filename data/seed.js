import 'dotenv/config';
import pg from 'pg';
import { faker } from '@faker-js/faker';
import { getLogger } from '../lib/logger.js';
import crypto from 'node:crypto';

const SYSTEM_COUNT = 3;
const METRIC_COUNT = 24 * 30; // 24 metrics per day for 30 days

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
    await client.query('DELETE FROM metrics');
    await client.query('DELETE FROM users_systems');
    await client.query('DELETE FROM systems');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM products');

    // Create a demo user. @TODO: refactor so that implementations can be unified via helpers
    const name = 'demo';
    const last_name = 'demo';
    const email = 'demo@heroku.ca';
    const username = 'demo';
    const password = 'demo';
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto
      .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
      .toString('hex');

    const { rows } = await client.query(
      'INSERT INTO users (name, last_name, email, username, password, salt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, last_name, email, username',
      [name, last_name, email, username, hashedPassword, salt]
    );
    const user = rows[0];

    const systemIds = [];
    // Seed systems
    for (let i = 0; i < SYSTEM_COUNT; i++) {
      const system = await client.query(
        `INSERT INTO systems (address, city, state, zip, country, battery_storage) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          faker.location.streetAddress(),
          faker.location.city(),
          faker.location.state(),
          faker.location.zipCode(),
          'US',
          faker.number.int({ min: 0, max: 100 }),
        ]
      );
      systemIds.push(system.rows[0].id);
    }

    // Link user to systems
    for (let systemId of systemIds) {
      await client.query(
        `INSERT INTO users_systems (user_id, system_id) VALUES ($1, $2)`,
        [user.id, systemId]
      );
    }

    /**
     * Seed metrics.
     * Intentionally cover different ratios of energy production:consumption for demo purposes.
     */
    const energyRatios = [
      {
        // max 20% leftover energy saved up
        produced: { min: 20, max: 25 },
        consumed: { min: 20, max: 20 },
      },
      {
        // min 75% leftover energy saved up
        produced: { min: 20, max: 25 },
        consumed: { min: 0, max: 5 },
      },
      {
        // max -25% leftover energy saved up
        produced: { min: 15, max: 20 },
        consumed: { min: 25, max: 30 },
      },
    ];
    for (let i = 0; i < systemIds.length; i++) {
      logger.info(`Seeding system ${i + 1} of ${systemIds.length}`);
      for (let j = 0; j < METRIC_COUNT; j++) {
        // inserts for ±30 days; ensure there is enough data to work for demo if run a month into the future
        let date = new Date(Date.now() - j * 3600 * 1000);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        const minEnergyProduced =
          energyRatios[i % energyRatios.length].produced.min;
        const maxEnergyProduced =
          energyRatios[i % energyRatios.length].produced.max;
        const minEnergyConsumed =
          energyRatios[i % energyRatios.length].consumed.min;
        const maxEnergyConsumed =
          energyRatios[i % energyRatios.length].consumed.max;

        await client.query(
          `INSERT INTO metrics (system_id, datetime, energy_produced, energy_consumed) VALUES ($1, $2, $3, $4)`,
          [
            systemIds[i],
            date,
            faker.number.float({
              min: minEnergyProduced,
              max: maxEnergyProduced,
              fractionDigits: 2,
            }),
            faker.number.float({
              min: minEnergyConsumed,
              max: maxEnergyConsumed,
              fractionDigits: 2,
            }),
          ]
        );
        date = new Date(Date.now() + j * 3600 * 1000);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        await client.query(
          `INSERT INTO metrics (system_id, datetime, energy_produced, energy_consumed) VALUES ($1, $2, $3, $4)`,
          [
            systemIds[i],
            date,
            faker.number.float({
              min: minEnergyProduced,
              max: maxEnergyProduced,
              fractionDigits: 2,
            }),
            faker.number.float({
              min: minEnergyConsumed,
              max: maxEnergyConsumed,
              fractionDigits: 2,
            }),
          ]
        );
      }
    }

    // Seed Products
    const products = [
      {
        name: 'SolarMax PowerBox',
        description:
          "This compact and portable solar generator is designed to provide clean and reliable electricity wherever you need it, whether you're camping, working on a remote job site, preparing for emergencies, or simply looking to reduce your environmental footprint.",
        imageUrl:
          'https://sfdc-ckz-b2b.s3.amazonaws.com/SDO/w24-product/G-100-2.png',
        price: 5100,
      },
      {
        name: 'Solar Panel',
        description:
          'Our state-of-the-art solar panels are designed to harness the power of the sun and provide you with a reliable and environmentally friendly source of electricity for your home or business.',
        imageUrl:
          'https://sfdc-ckz-b2b.s3.amazonaws.com/SDO/2021/Solar+Panel/Solar+Panel+1.png',
        price: 1600,
      },
      {
        name: 'Starter Set',
        description:
          'Our Solar Battery, Cables, and Fuses Kit is the ideal solution to supercharge your solar system, providing you with reliability, safety, and seamless power management.',
        imageUrl:
          'https://sfdc-ckz-b2b.s3.amazonaws.com/SDO/w24-product/SET-001S-1.png',
        price: 500,
      },
      {
        name: 'EnerCharge Pro',
        description:
          'The EnerCharge Pro is an advanced energy storage system that empowers homes, businesses, and utilities to efficiently manage their energy resources and reduce electricity costs. Designed with cutting-edge technology and user-friendly features, this ESS is the perfect solution for a sustainable and resilient energy future.',
        imageUrl:
          'https://sfdc-ckz-b2b.s3.amazonaws.com/SDO/w24-product/E-2000-1.png',
        price: 4500,
      },
    ];

    for (let i = 0; i < products.length; i++) {
      await client.query(
        `INSERT INTO products (name, description, image_url, price) VALUES ($1, $2, $3, $4)`,
        [
          products[i].name,
          products[i].description,
          products[i].imageUrl,
          products[i].price,
        ]
      );
    }

    /**
     * Seed system components.
     */
    for (let systemId of systemIds) {
      const name =
        products[faker.number.int({ min: 0, max: products.length - 1 })].name;
      const active = faker.datatype.boolean();
      await client.query(
        `
        INSERT INTO system_components (system_id, name, active) VALUES ($1, $2, $3)
      `,
        [systemId, name, active]
      );
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
