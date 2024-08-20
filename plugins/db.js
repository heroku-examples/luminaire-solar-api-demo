import crypto from 'node:crypto';
import fp from 'fastify-plugin';

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
      getMetricsSummaryBySystem: async (systemId, date) => {
        // Daily
        const startDate = new Date(date);
        const startOfDay = new Date(startDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(startDate.setHours(23, 59, 59, 999));

        // Daily
        const { rows: dailyRows } = await client.query(
          `SELECT date_trunc('day', datetime) as date, 
            SUM(energy_produced) as total_energy_produced, 
            SUM(energy_consumed) as total_energy_consumed 
        FROM metrics 
        WHERE system_id = $1 AND datetime >= $2 AND datetime <= $3
        GROUP BY date_trunc('day', datetime)
        ORDER BY date_trunc('day', datetime) DESC`,
          [systemId, startOfDay, endOfDay]
        );

        // Weekly
        const startOfWeek = new Date(date);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const { rows: weeklyRows } = await client.query(
          `SELECT date_trunc('week', datetime) as date, 
          SUM(energy_produced) as total_energy_produced, 
          SUM(energy_consumed) as total_energy_consumed 
        FROM metrics 
        WHERE system_id = $1 AND datetime >= $2 AND datetime <= $3
        GROUP BY date_trunc('week', datetime)
        ORDER BY date_trunc('week', datetime) DESC`,
          [systemId, startOfWeek, endOfWeek]
        );

        // Monthly
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
        return { daily: dailyRows, weekly: weeklyRows, monthly: monthlyRows };
      },
      getProducts: async () => {
        const { rows } = await client.query(
          'SELECT id, name, description, image_url as "imageUrl", price FROM products'
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
    });
  } catch (err) {
    fastify.log.info('Error connecting to the database');
    fastify.log.error(err);
  }
});
