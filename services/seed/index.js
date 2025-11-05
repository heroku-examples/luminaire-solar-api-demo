/**
 * Seed Service
 * Manages database seeding and reset operations
 */
import { faker } from '@faker-js/faker';
import crypto from 'node:crypto';

const SYSTEM_COUNT = 3;
const METRIC_COUNT = 24 * 60; // 24 metrics per day for 60 days

export class SeedService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Clear all data from the database (preserves users for session continuity)
   * @returns {Promise<void>}
   */
  async clearAllData() {
    const client = await this.db.connect();
    try {
      this.logger.info('Clearing all data (preserving users)...');

      // Delete in order to respect foreign key constraints
      await client.query('DELETE FROM metrics');
      await client.query('DELETE FROM users_systems');
      await client.query('DELETE FROM system_components');
      await client.query('DELETE FROM systems');
      await client.query('DELETE FROM whitelist_pdfs');
      await client.query('DELETE FROM whitelist_urls');
      await client.query('DELETE FROM tool_settings');
      // Skip: DELETE FROM users (preserve for session continuity)
      await client.query('DELETE FROM products');
      await client.query('DELETE FROM weather');

      this.logger.info('All data cleared successfully (users preserved)');
    } finally {
      client.release();
    }
  }

  /**
   * Create demo user with default credentials (or return existing one)
   * @returns {Promise<Object>} The created or existing user object
   */
  async createDemoUser() {
    const client = await this.db.connect();
    try {
      const name = 'demo';
      const last_name = 'demo';
      const email = 'demo@heroku.ca';
      const username = 'demo';
      const password = 'demo';

      // Check if demo user already exists
      const existingUser = await client.query(
        'SELECT id, name, last_name, email, username FROM users WHERE username = $1',
        [username]
      );

      if (existingUser.rows.length > 0) {
        this.logger.info(
          `Using existing demo user (id: ${existingUser.rows[0].id})`
        );
        return existingUser.rows[0];
      }

      // Create new demo user
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = crypto
        .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
        .toString('hex');

      const { rows } = await client.query(
        'INSERT INTO users (name, last_name, email, username, password, salt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, last_name, email, username',
        [name, last_name, email, username, hashedPassword, salt]
      );

      this.logger.info(`Created new demo user (id: ${rows[0].id})`);
      return rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Seed tool settings for a user
   * @param {string} userId - The user ID
   * @returns {Promise<void>}
   */
  async seedToolSettings(userId) {
    const client = await this.db.connect();
    try {
      // Create tool settings with all tools enabled
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
        [userId, true, true, true, true, true, true]
      );
      this.logger.info('Created tool settings');

      // Seed whitelisted URLs
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
          [userId, url, description]
        );
      }
      this.logger.info(`Added ${defaultUrls.length} whitelisted URLs`);

      // Seed whitelisted PDFs
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
          [userId, pdf_url, description]
        );
      }
      this.logger.info(`Added ${defaultPdfs.length} whitelisted PDFs`);
    } finally {
      client.release();
    }
  }

  /**
   * Seed solar systems
   * @param {string} userId - The user ID
   * @returns {Promise<Array<Object>>} Array of system objects with id, zip, country
   */
  async seedSystems(userId) {
    const client = await this.db.connect();
    try {
      const systems = [];
      // Battery storage values used to identify system performance profile
      // 100 = Excellent, 50 = Fair, 25 = Poor
      const batteryStorageValues = [100, 50, 25];

      // Create systems
      for (let i = 0; i < SYSTEM_COUNT; i++) {
        const zip = faker.location.zipCode();
        const system = await client.query(
          `INSERT INTO systems (address, city, state, zip, country, battery_storage) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, zip, country`,
          [
            faker.location.streetAddress(),
            faker.location.city(),
            faker.location.state(),
            zip,
            'US',
            batteryStorageValues[i % batteryStorageValues.length],
          ]
        );
        systems.push(system.rows[0]);
      }

      // Link user to systems
      for (let system of systems) {
        await client.query(
          `INSERT INTO users_systems (user_id, system_id) VALUES ($1, $2)`,
          [userId, system.id]
        );
      }

      this.logger.info(`Created ${systems.length} systems`);
      return systems;
    } finally {
      client.release();
    }
  }

  /**
   * Seed weather data aligned with system performance profiles
   * @param {Array<Object>} systems - Array of system objects with id, zip, country
   * @returns {Promise<void>}
   */
  async seedWeather(systems) {
    const client = await this.db.connect();
    try {
      /**
       * Weather profiles aligned with system performance:
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

      this.logger.info(`Seeded weather data for ${systems.length} systems`);
    } finally {
      client.release();
    }
  }

  /**
   * Seed metrics for systems
   * @param {Array<Object>} systems - Array of system objects (only id property is used)
   * @returns {Promise<void>}
   */
  async seedMetrics(systems) {
    const systemIds = systems.map((s) => s.id);
    const client = await this.db.connect();
    try {
      /**
       * Deterministic performance profiles - each system is guaranteed to fall
       * into a specific performance category based on thresholds.
       * Systems are identified by battery_storage value (100=Excellent, 50=Fair, 25=Poor)
       * and ordered by battery_storage DESC when queried.
       *
       * Performance thresholds:
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

      const baseline = new Date();
      baseline.setMinutes(0, 0, 0);
      const baselineTime = baseline.getTime();

      for (let i = 0; i < systemIds.length; i++) {
        this.logger.info(
          `Seeding metrics for system ${i + 1} of ${systemIds.length}`
        );
        const records = [];
        const ratio = energyRatios[i % energyRatios.length];
        const { produced, consumed } = ratio;

        for (let j = 0; j < METRIC_COUNT; j++) {
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

        // Bulk insert
        let queryText = `INSERT INTO metrics (system_id, datetime, energy_produced, energy_consumed) VALUES `;
        const values = [];
        const placeholders = records.map((record, index) => {
          const baseIndex = index * 4;
          values.push(...record);
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
        });
        queryText += placeholders.join(', ');

        await client.query(queryText, values);
      }

      this.logger.info('Metrics seeded');
    } finally {
      client.release();
    }
  }

  /**
   * Seed products
   * @returns {Promise<void>}
   */
  async seedProducts() {
    const client = await this.db.connect();
    try {
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

      this.logger.info(`Created ${products.length} products`);
    } finally {
      client.release();
    }
  }

  /**
   * Seed system components
   * @param {Array<Object>} systems - Array of system objects (only id property is used)
   * @returns {Promise<void>}
   */
  async seedSystemComponents(systems) {
    const systemIds = systems.map((s) => s.id);
    const client = await this.db.connect();
    try {
      for (let systemId of systemIds) {
        const mainComponent = faker.helpers.arrayElement([
          'SolarMax PowerBox',
          'EnerCharge Pro',
        ]);
        const mainActive = faker.datatype.boolean();

        await client.query(
          `INSERT INTO system_components (system_id, name, active) VALUES ($1, $2, $3)`,
          [systemId, mainComponent, mainActive]
        );

        if (mainComponent === 'EnerCharge Pro') {
          const numberOfPanels = faker.number.int({ min: 2, max: 5 });

          for (let i = 0; i < numberOfPanels; i++) {
            const panelActive = faker.datatype.boolean();
            await client.query(
              `INSERT INTO system_components (system_id, name, active) VALUES ($1, $2, $3)`,
              [systemId, 'Solar Panel', panelActive]
            );
          }
        }
      }

      this.logger.info('System components seeded');
    } finally {
      client.release();
    }
  }

  /**
   * Reset and reseed all demo data
   * @returns {Promise<Object>} Summary of seeded data
   */
  async resetDemoData() {
    this.logger.info('Starting demo data reset...');

    // Clear all existing data
    await this.clearAllData();

    // Create demo user
    const user = await this.createDemoUser();

    // Seed tool settings
    await this.seedToolSettings(user.id);

    // Seed systems
    const systems = await this.seedSystems(user.id);

    // Seed weather data aligned with system performance
    await this.seedWeather(systems);

    // Seed metrics
    await this.seedMetrics(systems);

    // Seed products
    await this.seedProducts();

    // Seed system components
    await this.seedSystemComponents(systems);

    this.logger.info('Demo data reset completed successfully');

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      counts: {
        systems: systems.length,
        metrics: METRIC_COUNT * systems.length,
        products: 4,
        whitelisted_urls: 3,
        whitelisted_pdfs: 2,
        weather: systems.length,
      },
    };
  }
}
