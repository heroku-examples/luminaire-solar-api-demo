import 'dotenv/config';
import pg from 'pg';
import { faker } from '@faker-js/faker';
import { getLogger } from '../lib/logger.js';

const SYSTEM_COUNT = 10;
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
    await client.query('DELETE FROM metrics');
    await client.query('DELETE FROM users_systems');
    await client.query('DELETE FROM systems');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM products');

    const systemIds = [];
    // Seed systems
    for (let i = 0; i < SYSTEM_COUNT; i++) {
      const system = await client.query(
        `INSERT INTO systems (address, city, state, zip, country) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          faker.location.streetAddress(),
          faker.location.city(),
          faker.location.state(),
          faker.location.zipCode(),
          'US',
        ]
      );
      systemIds.push(system.rows[0].id);
    }

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
