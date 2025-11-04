/**
 * Tool Settings Service
 * Manages AI tool configuration and whitelists
 */

export class ToolSettingsService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get tool settings for a user
   * @param {string} userId - The user ID (UUID)
   * @returns {Promise<Object>} - The tool settings with whitelists
   */
  async getSettings(userId) {
    const client = await this.db.connect();
    try {
      // Get tool settings
      const settingsResult = await client.query(
        `SELECT * FROM tool_settings WHERE user_id = $1`,
        [userId]
      );

      // If no settings exist, create default settings
      if (settingsResult.rows.length === 0) {
        await client.query(`INSERT INTO tool_settings (user_id) VALUES ($1)`, [
          userId,
        ]);
        return this.getSettings(userId);
      }

      const settings = settingsResult.rows[0];

      // Get whitelisted URLs
      const urlsResult = await client.query(
        `SELECT id, url, description, created_at FROM whitelist_urls WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      // Get whitelisted PDFs
      const pdfsResult = await client.query(
        `SELECT id, pdf_url, description, created_at FROM whitelist_pdfs WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      return {
        tools: {
          postgres_query: settings.postgres_query_enabled,
          postgres_schema: settings.postgres_schema_enabled,
          html_to_markdown: settings.html_to_markdown_enabled,
          pdf_to_markdown: settings.pdf_to_markdown_enabled,
          code_exec_python: settings.code_exec_python_enabled,
        },
        cache: {
          schema_cache: settings.schema_cache_enabled,
        },
        whitelists: {
          urls: urlsResult.rows,
          pdfs: pdfsResult.rows,
        },
        updated_at: settings.updated_at,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update tool settings for a user
   * @param {string} userId - The user ID (UUID)
   * @param {Object} updates - The settings to update
   * @returns {Promise<Object>} - The updated settings
   */
  async updateSettings(userId, updates) {
    const client = await this.db.connect();
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      // Build dynamic update query
      if (updates.postgres_query !== undefined) {
        fields.push(`postgres_query_enabled = $${paramCount++}`);
        values.push(updates.postgres_query);
      }
      if (updates.postgres_schema !== undefined) {
        fields.push(`postgres_schema_enabled = $${paramCount++}`);
        values.push(updates.postgres_schema);
      }
      if (updates.html_to_markdown !== undefined) {
        fields.push(`html_to_markdown_enabled = $${paramCount++}`);
        values.push(updates.html_to_markdown);
      }
      if (updates.pdf_to_markdown !== undefined) {
        fields.push(`pdf_to_markdown_enabled = $${paramCount++}`);
        values.push(updates.pdf_to_markdown);
      }
      if (updates.code_exec_python !== undefined) {
        fields.push(`code_exec_python_enabled = $${paramCount++}`);
        values.push(updates.code_exec_python);
      }
      if (updates.schema_cache !== undefined) {
        fields.push(`schema_cache_enabled = $${paramCount++}`);
        values.push(updates.schema_cache);
      }

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Always update the updated_at timestamp
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const query = `
        UPDATE tool_settings
        SET ${fields.join(', ')}
        WHERE user_id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        // Create settings if they don't exist
        await client.query(`INSERT INTO tool_settings (user_id) VALUES ($1)`, [
          userId,
        ]);
        return this.updateSettings(userId, updates);
      }

      return this.getSettings(userId);
    } finally {
      client.release();
    }
  }

  /**
   * Add a URL to the whitelist
   * @param {string} userId - The user ID (UUID)
   * @param {string} url - The URL to whitelist
   * @param {string} description - Optional description
   * @returns {Promise<Object>} - The created whitelist entry
   */
  async addWhitelistUrl(userId, url, description = null) {
    const result = await this.db.query(
      `INSERT INTO whitelist_urls (user_id, url, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, url) DO UPDATE
       SET description = EXCLUDED.description
       RETURNING *`,
      [userId, url, description]
    );
    return result.rows[0];
  }

  /**
   * Remove a URL from the whitelist
   * @param {string} userId - The user ID (UUID)
   * @param {number} urlId - The whitelist entry ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeWhitelistUrl(userId, urlId) {
    const result = await this.db.query(
      `DELETE FROM whitelist_urls WHERE id = $1 AND user_id = $2`,
      [urlId, userId]
    );
    return result.rowCount > 0;
  }

  /**
   * Add a PDF to the whitelist
   * @param {string} userId - The user ID (UUID)
   * @param {string} pdfUrl - The PDF URL to whitelist
   * @param {string} description - Optional description
   * @returns {Promise<Object>} - The created whitelist entry
   */
  async addWhitelistPdf(userId, pdfUrl, description = null) {
    const result = await this.db.query(
      `INSERT INTO whitelist_pdfs (user_id, pdf_url, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, pdf_url) DO UPDATE
       SET description = EXCLUDED.description
       RETURNING *`,
      [userId, pdfUrl, description]
    );
    return result.rows[0];
  }

  /**
   * Remove a PDF from the whitelist
   * @param {string} userId - The user ID (UUID)
   * @param {number} pdfId - The whitelist entry ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeWhitelistPdf(userId, pdfId) {
    const result = await this.db.query(
      `DELETE FROM whitelist_pdfs WHERE id = $1 AND user_id = $2`,
      [pdfId, userId]
    );
    return result.rowCount > 0;
  }

  /**
   * Check if a URL is whitelisted for a user
   * @param {string} userId - The user ID (UUID)
   * @param {string} url - The URL to check
   * @returns {Promise<boolean>} - Whether the URL is whitelisted
   */
  async isUrlWhitelisted(userId, url) {
    const result = await this.db.query(
      `SELECT 1 FROM whitelist_urls WHERE user_id = $1 AND url = $2`,
      [userId, url]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if a PDF is whitelisted for a user
   * @param {string} userId - The user ID (UUID)
   * @param {string} pdfUrl - The PDF URL to check
   * @returns {Promise<boolean>} - Whether the PDF is whitelisted
   */
  async isPdfWhitelisted(userId, pdfUrl) {
    const result = await this.db.query(
      `SELECT 1 FROM whitelist_pdfs WHERE user_id = $1 AND pdf_url = $2`,
      [userId, pdfUrl]
    );
    return result.rows.length > 0;
  }
}
