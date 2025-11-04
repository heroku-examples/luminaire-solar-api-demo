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
   * @returns {Promise<Array<string>>} Array of system IDs
   */
  async seedSystems(userId) {
    const client = await this.db.connect();
    try {
      const systemIds = [];

      // Create systems
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
          [userId, systemId]
        );
      }

      this.logger.info(`Created ${systemIds.length} systems`);
      return systemIds;
    } finally {
      client.release();
    }
  }

  /**
   * Seed metrics for systems
   * @param {Array<string>} systemIds - Array of system IDs
   * @returns {Promise<void>}
   */
  async seedMetrics(systemIds) {
    const client = await this.db.connect();
    try {
      const energyRatios = [
        {
          // System 1: EXCELLENT - High production, low consumption
          // Produces ~42 kWh/day, consumes ~14.4 kWh/day
          // Worst case: 66% savings, Best case: 80% savings → ALWAYS "high" forecast → Excellent
          produced: { min: 1.5, max: 2.0 },
          consumed: { min: 0.4, max: 0.6 },
        },
        {
          // System 2: FAIR - Balanced production and consumption
          // Produces ~42 kWh/day, consumes ~31 kWh/day
          // Worst case: 7% savings, Best case: 40% savings → ALWAYS "medium" forecast → Fair
          produced: { min: 1.5, max: 2.0 },
          consumed: { min: 1.2, max: 1.4 },
        },
        {
          // System 3: VERY LOW - Very low production, very high consumption
          // Produces ~12 kWh/day, consumes ~96 kWh/day
          // Worst case: -650% savings → ALWAYS "low" forecast → Very Low
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
   * @param {Array<string>} systemIds - Array of system IDs
   * @returns {Promise<void>}
   */
  async seedSystemComponents(systemIds) {
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
    const systemIds = await this.seedSystems(user.id);

    // Seed metrics
    await this.seedMetrics(systemIds);

    // Seed products
    await this.seedProducts();

    // Seed system components
    await this.seedSystemComponents(systemIds);

    this.logger.info('Demo data reset completed successfully');

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      counts: {
        systems: systemIds.length,
        metrics: METRIC_COUNT * systemIds.length,
        products: 4,
        whitelisted_urls: 3,
        whitelisted_pdfs: 2,
      },
    };
  }
}
