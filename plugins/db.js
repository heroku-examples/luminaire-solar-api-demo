import crypto from 'node:crypto';
import fp from 'fastify-plugin';
import generateEnergyForecast from '../data/mockForecast.js';
import WeatherService from '../services/weather/index.js';

export default fp(async (fastify) => {
  try {
    const client = await fastify.pg.connect();
    fastify.decorate('db', {
      createUser: async ({ name, last_name, email, username, password }) => {
        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = crypto
          .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
          .toString('hex');

        const { rows } = await client.query(
          'INSERT INTO users (name, last_name, email, username, password, salt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, last_name, email, username',
          [name, last_name, email, username, hashedPassword, salt]
        );
        return rows[0];
      },
      authenticate: async (username, password) => {
        const { rows } = await client.query(
          'SELECT * FROM users WHERE username = $1',
          [username]
        );

        if (rows.length === 0) {
          return false;
        }

        const user = rows[0];
        const hashedPassword = crypto
          .pbkdf2Sync(password, user.salt, 1000, 64, 'sha512')
          .toString('hex');
        return user.password === hashedPassword;
      },
      getUserByUsername: async (username) => {
        const { rows } = await client.query(
          'SELECT id, name, last_name, username, email FROM users WHERE username = $1',
          [username]
        );
        return rows[0];
      },
      getSystems: async () => {
        const { rows } = await client.query('SELECT * FROM systems');
        return rows;
      },
      getSystemsByUser: async (userId) => {
        const { rows } = await client.query(
          `SELECT systems.* FROM systems 
         JOIN users_systems ON systems.id = users_systems.system_id
         WHERE users_systems.user_id = $1`,
          [userId]
        );
        return rows;
      },
      getMetricsBySystem: async (systemId, date) => {
        const { rows } = await client.query(
          'SELECT * FROM metrics WHERE system_id = $1 AND datetime::date = $2',
          [systemId, date]
        );
        return rows;
      },
      getSystemDetails: async (systemId) => {
        const { rows: systemRows } = await client.query(
          `SELECT * FROM systems WHERE systems.id = $1`,
          [systemId]
        );
        const { rows: componentsRows } = await client.query(
          `SELECT id, name, active FROM system_components WHERE system_components.system_id = $1`,
          [systemId]
        );
        return {
          system: systemRows[0],
          components: componentsRows,
        };
      },
      getActivityHistoryBySystem: async (systemId) => {
        // Last 30 days
        const today = new Date(new Date().setHours(23, 59, 59, 999)); // end date is today near 24th hour
        let startDate = new Date(new Date().setDate(today.getDate() - 30)); // start date is 30 days ago near 0th hour
        startDate = new Date(startDate.setHours(0, 0, 0, 0));
        console.log(systemId, startDate, today);
        const { rows } = await client.query(
          `SELECT date_trunc('day', datetime) as date, 
          SUM(energy_produced) as total_energy_produced, 
          SUM(energy_consumed) as total_energy_consumed 
          FROM metrics 
          WHERE system_id = $1 AND datetime >= $2 AND datetime <= $3
          GROUP BY date_trunc('day', datetime)
          ORDER BY date_trunc('day', datetime) DESC`,
          [systemId, startDate, today]
        );
        return rows;
      },
      getMetricsSummaryBySystem: async (systemId, date) => {
        // Daily
        const startDate = new Date(date);
        const startOfDay = new Date(startDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(startDate.setHours(23, 59, 59, 999));

        // Daily
        const { rows: dailyRows } = await client.query(
          `SELECT 
            SUM(energy_produced) as total_energy_produced, 
            SUM(energy_consumed) as total_energy_consumed 
          FROM metrics 
          WHERE system_id = $1 AND datetime >= $2 AND datetime <= $3`,
          [systemId, startOfDay, endOfDay]
        );

        // Weekly
        const rollingStartWeek = new Date(date);
        rollingStartWeek.setDate(rollingStartWeek.getDate() - 6);
        rollingStartWeek.setHours(0, 0, 0, 0);

        const rollingEndWeek = new Date(date);
        rollingEndWeek.setHours(23, 59, 59, 999);

        const { rows: weeklyRows } = await client.query(
          `SELECT 
            SUM(energy_produced) AS total_energy_produced, 
            SUM(energy_consumed) AS total_energy_consumed 
          FROM metrics 
          WHERE system_id = $1 AND datetime >= $2 AND datetime <= $3`,
          [systemId, rollingStartWeek, rollingEndWeek]
        );

        // Monthly
        const rollingStartMonth = new Date(date);
        rollingStartMonth.setDate(rollingStartMonth.getDate() - 29);
        rollingStartMonth.setHours(0, 0, 0, 0);

        const rollingEndMonth = new Date(date);
        rollingEndMonth.setHours(23, 59, 59, 999);

        const { rows: monthlyRows } = await client.query(
          `SELECT 
          SUM(energy_produced) AS total_energy_produced, 
          SUM(energy_consumed) AS total_energy_consumed 
          FROM metrics 
          WHERE system_id = $1 AND datetime >= $2 AND datetime <= $3`,
          [systemId, rollingStartMonth, rollingEndMonth]
        );
        return {
          daily: dailyRows[0],
          weekly: weeklyRows[0],
          monthly: monthlyRows[0],
        };
      },
      getProducts: async () => {
        const { rows } = await client.query(
          'SELECT id, name, description, image_url as "imageUrl", price FROM products'
        );
        return rows;
      },
      getAdditionalProducts: async () => {
        const { rows } = await client.query(
          `SELECT name, description, 
            productcode as "productCode", image_url__c as "imageUrl" 
           FROM salesforce.product2
           WHERE family in ('Home Solutions', 'Solar Panels', 'Battery Tools') AND image_url__c IS NOT NULL
           ORDER BY name`
        );
        return rows;
      },
      getProductById: async (id) => {
        const { rows } = await client.query(
          'SELECT id, name, description, image_url as "imageUrl", price FROM products WHERE id = $1',
          [id]
        );
        return rows[0];
      },
      getEnergyForecast: async (systemId, date) => {
        // deterministic (static) forecasts based on system performance, for TDX demo script purposes
        const startOfMonth = new Date(date);
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);
        endOfMonth.setHours(23, 59, 59, 999);

        const { rows: monthlyRows } = await client.query(
          `SELECT date_trunc('month', datetime) as date, 
          SUM(energy_produced) as total_energy_produced, 
          SUM(energy_consumed) as total_energy_consumed 
          FROM metrics 
          WHERE system_id = $1 AND datetime >= $2 AND datetime <= $3
          GROUP BY date_trunc('month', datetime)
          ORDER BY date_trunc('month', datetime) DESC`,
          [systemId, startOfMonth, endOfMonth]
        );
        const energySavingsPercentage =
          (monthlyRows[0].total_energy_produced -
            monthlyRows[0].total_energy_consumed) /
          monthlyRows[0].total_energy_produced;

        let energyForecast;
        // for the "happy" system, generate good outlook for energy forecast, as per script
        if (energySavingsPercentage >= 0.5) {
          energyForecast = generateEnergyForecast('high');
        } else if (energySavingsPercentage >= 0.01) {
          // for the "medium" system, generate medium outlook for energy forecast
          energyForecast = generateEnergyForecast('medium');
        } else {
          // for the "negative" system, generate bad outlook for energy forecast
          energyForecast = generateEnergyForecast('low');
        }
        return energyForecast;
      },
      getWeatherBySystem: async (systemId) => {
        const { rows: systems } = await client.query(
          `
            SELECT zip, country
            FROM systems
            WHERE id = $1
          `,
          [systemId]
        );
        const system = systems[0];
        const weatherService = new WeatherService(system.zip, system.country);
        const weatherRows = await weatherService.getWeather();
        return weatherRows[0];
      },
    });
  } catch (err) {
    fastify.log.info('Error connecting to the database');
    fastify.log.error(err);
  }
});
