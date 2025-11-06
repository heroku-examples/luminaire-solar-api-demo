import 'dotenv/config';
import pg from 'pg';
import { faker } from '@faker-js/faker';
import { getLogger } from '../lib/logger.js';
import crypto from 'node:crypto';

const SYSTEM_COUNT = 3;
const METRIC_COUNT = 24 * 60; // 24 metrics per day for 60 days

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
    // Cleanup existing data (preserve users to maintain sessions)
    await client.query('DELETE FROM metrics');
    await client.query('DELETE FROM users_systems');
    await client.query('DELETE FROM system_components');
    await client.query('DELETE FROM systems');
    await client.query('DELETE FROM whitelist_pdfs');
    await client.query('DELETE FROM whitelist_urls');
    await client.query('DELETE FROM tool_settings');
    await client.query('DELETE FROM weather');
    // Skip: DELETE FROM users (preserve for session continuity)
    await client.query('DELETE FROM products');

    // Check if demo user already exists
    const name = 'demo';
    const last_name = 'demo';
    const email = 'demo@heroku.ca';
    const username = 'demo';
    const password = 'demo';

    let userResult = await client.query(
      'SELECT id, name, last_name, email, username FROM users WHERE username = $1',
      [username]
    );

    let user;
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      logger.info(`Using existing demo user (id: ${user.id})`);
    } else {
      // Create new demo user
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = crypto
        .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
        .toString('hex');

      const { rows } = await client.query(
        'INSERT INTO users (name, last_name, email, username, password, salt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, last_name, email, username',
        [name, last_name, email, username, hashedPassword, salt]
      );
      user = rows[0];
      logger.info(`Created new demo user (id: ${user.id})`);
    }

    // Seed tool settings for demo user with all tools enabled
    await client.query(
      `INSERT INTO tool_settings (
        user_id, 
        postgres_query_enabled, 
        postgres_schema_enabled, 
        html_to_markdown_enabled, 
        pdf_to_markdown_enabled, 
        code_exec_python_enabled, 
        schema_cache_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, true, true, true, true, true, true]
    );
    logger.info('Created tool settings for demo user');

    // Seed whitelisted URLs for the demo user
    const defaultUrls = [
      {
        url: 'https://luminaire.ukoreh.com',
        description: 'Official Luminaire Solar website',
      },
      {
        url: 'https://luminaire.ukoreh.com/products',
        description: 'Luminaire Solar product catalog',
      },
      {
        url: 'https://luminaire.ukoreh.com/about',
        description: 'About Luminaire Solar company',
      },
    ];

    for (const { url, description } of defaultUrls) {
      await client.query(
        `INSERT INTO whitelist_urls (user_id, url, description) VALUES ($1, $2, $3)`,
        [user.id, url, description]
      );
    }
    logger.info(`Added ${defaultUrls.length} whitelisted URLs`);

    // Seed whitelisted PDFs for the demo user
    const defaultPdfs = [
      {
        pdf_url:
          'https://www.epa.gov/sites/default/files/2019-08/documents/solar_cells_fact_sheet_p100il8r.pdf',
        description: 'EPA Solar Cells Fact Sheet - Technical specifications',
      },
      {
        pdf_url:
          'https://www.epa.gov/sites/default/files/2017-09/documents/gpp-guidelines-for-making-solar-claims.pdf',
        description: 'EPA Guidelines for Making Solar Claims - Compliance',
      },
    ];

    for (const { pdf_url, description } of defaultPdfs) {
      await client.query(
        `INSERT INTO whitelist_pdfs (user_id, pdf_url, description) VALUES ($1, $2, $3)`,
        [user.id, pdf_url, description]
      );
    }
    logger.info(`Added ${defaultPdfs.length} whitelisted PDFs`);

    const systemIds = [];
    const systems = [];
    // Battery storage values used to identify system performance profile
    // 100 = Excellent, 50 = Fair, 25 = Poor
    const batteryStorageValues = [100, 50, 25];

    // Seed systems
    for (let i = 0; i < SYSTEM_COUNT; i++) {
      const zip = faker.location.zipCode();
      const batteryStorage =
        batteryStorageValues[i % batteryStorageValues.length];
      const system = await client.query(
        `INSERT INTO systems (address, city, state, zip, country, battery_storage) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, zip, country, battery_storage`,
        [
          faker.location.streetAddress(),
          faker.location.city(),
          faker.location.state(),
          zip,
          'US',
          batteryStorage,
        ]
      );
      systemIds.push(system.rows[0].id);
      systems.push(system.rows[0]);
    }

    // Link user to systems
    for (let systemId of systemIds) {
      await client.query(
        `INSERT INTO users_systems (user_id, system_id) VALUES ($1, $2)`,
        [user.id, systemId]
      );
    }

    /**
     * Seed weather data aligned with system performance profiles.
     * System 1 (high): clear skies, high temperatures
     * System 2 (medium): overcast, moderate temperatures
     * System 3 (low): cloudy, lower temperatures
     */
    const weatherProfiles = [
      {
        description: 'clear skies',
        tempRange: { min: 70, max: 85 },
      },
      {
        description: 'overcast',
        tempRange: { min: 55, max: 70 },
      },
      {
        description: 'cloudy',
        tempRange: { min: 40, max: 60 },
      },
    ];

    for (let i = 0; i < systems.length; i++) {
      const system = systems[i];
      const profile = weatherProfiles[i % weatherProfiles.length];
      const temperature = faker.number.int({
        min: profile.tempRange.min,
        max: profile.tempRange.max,
      });

      await client.query(
        `INSERT INTO weather (zip, country, temperature, description) VALUES ($1, $2, $3, $4)
         ON CONFLICT (zip, country) DO UPDATE
         SET (temperature, description, updated_at) = ($3, $4, now())`,
        [system.zip, system.country, temperature, profile.description]
      );
    }
    logger.info(`Seeded weather data for ${systems.length} systems`);

    /**
     * Seed metrics with deterministic performance profiles.
     * Systems are identified by battery_storage value (100=Excellent, 50=Fair, 25=Poor)
     * and ordered by battery_storage DESC when queried.
     *
     * Each system is guaranteed to fall into a specific performance category:
     * - Excellent: >= 50% savings → "high" forecast
     * - Fair: 1% to 49% savings → "medium" forecast
     * - Poor: < 1% savings → "low" forecast
     */
    const energyRatios = [
      {
        // System 1: EXCELLENT (battery_storage=100, ordered first)
        // Produces 36-48 kWh/day, consumes 9.6-14.4 kWh/day
        // Savings range: 60-80% → ALWAYS >= 50% → ALWAYS "high" forecast
        produced: { min: 1.5, max: 2.0 },
        consumed: { min: 0.4, max: 0.6 },
      },
      {
        // System 2: FAIR (battery_storage=50, ordered second)
        // Produces 36-48 kWh/day, consumes 28.8-33.6 kWh/day
        // Savings range: 6.7-40% → ALWAYS 1-49% → ALWAYS "medium" forecast
        produced: { min: 1.5, max: 2.0 },
        consumed: { min: 1.2, max: 1.4 },
      },
      {
        // System 3: POOR (battery_storage=25, ordered third)
        // Produces 7.2-16.8 kWh/day, consumes 84-108 kWh/day
        // Savings range: -400% to -1400% → ALWAYS < 1% → ALWAYS "low" forecast
        produced: { min: 0.3, max: 0.7 },
        consumed: { min: 3.5, max: 4.5 },
      },
    ];
    // Use current time (truncated to the hour) as baseline
    const baseline = new Date();
    baseline.setMinutes(0, 0, 0);
    const baselineTime = baseline.getTime();

    // For each system, collect metric records in an array and then do a bulk insert
    for (let i = 0; i < systemIds.length; i++) {
      logger.info(`Seeding system ${i + 1} of ${systemIds.length}`);
      const records = []; // array to hold rows to insert
      const ratio = energyRatios[i % energyRatios.length];
      const { produced, consumed } = ratio;

      // Loop over METRIC_COUNT hours for the past only
      for (let j = 0; j < METRIC_COUNT; j++) {
        // Past metric (j hours before baseline)
        let pastDate = new Date(baselineTime - j * 3600 * 1000);
        pastDate.setMinutes(0, 0, 0);

        records.push([
          systemIds[i],
          pastDate,
          faker.number.float({
            min: produced.min,
            max: produced.max,
            fractionDigits: 2,
          }),
          faker.number.float({
            min: consumed.min,
            max: consumed.max,
            fractionDigits: 2,
          }),
        ]);
      }

      // Bulk insert records for the current system.
      // We'll build a parameterized query dynamically.
      let queryText = `INSERT INTO metrics (system_id, datetime, energy_produced, energy_consumed) VALUES `;
      const values = [];
      const placeholders = records.map((record, index) => {
        const baseIndex = index * 4;
        // For each record, we add 4 placeholders ($1, $2, $3, $4, etc.)
        values.push(...record);
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
      });
      queryText += placeholders.join(', ');

      await client.query(queryText, values);
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
     * Seed system components using real products.
     * Each system gets:
     * - Multiple Solar Panels (always included)
     * - 1-2 additional random products (power storage or accessories)
     *
     * Component operational status aligns with system performance:
     * - Excellent system (battery_storage=100): All components active
     * - Fair system (battery_storage=50): ~50% components active
     * - Poor system (battery_storage=25): Most components inactive
     */
    // Fetch all products with IDs
    const { rows: allProducts } = await client.query(
      'SELECT id, name FROM products ORDER BY name'
    );

    // Find Solar Panel and other products
    const solarPanel = allProducts.find((p) => p.name === 'Solar Panel');
    const otherProducts = allProducts.filter((p) => p.name !== 'Solar Panel');

    for (let i = 0; i < systems.length; i++) {
      const system = systems[i];
      const systemId = systemIds[i];

      // Determine active status based on system performance
      // Excellent (100): 100% active, Fair (50): ~50% active, Poor (25): ~20% active
      const activeRate = system.battery_storage / 100;

      // Always add Solar Panels (2-5 panels per system)
      const numberOfPanels = faker.number.int({ min: 2, max: 5 });
      for (let j = 0; j < numberOfPanels; j++) {
        // Determine if this component should be active based on system performance
        const panelActive = Math.random() < activeRate;
        await client.query(
          `INSERT INTO system_components (system_id, product_id, name, active) 
           VALUES ($1, $2, $3, $4)`,
          [systemId, solarPanel.id, solarPanel.name, panelActive]
        );
      }

      // Add 1-2 additional random products (power storage or accessories)
      const numberOfAdditionalProducts = faker.number.int({ min: 1, max: 2 });
      const selectedProducts = faker.helpers.arrayElements(
        otherProducts,
        numberOfAdditionalProducts
      );

      for (const product of selectedProducts) {
        const productActive = Math.random() < activeRate;
        await client.query(
          `INSERT INTO system_components (system_id, product_id, name, active) 
           VALUES ($1, $2, $3, $4)`,
          [systemId, product.id, product.name, productActive]
        );
      }
    }

    logger.info('Seeded system components with performance-aligned status');
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
