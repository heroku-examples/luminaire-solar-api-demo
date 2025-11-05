import fp from 'fastify-plugin';
import { config } from '../config.js';
import { randomUUID } from 'node:crypto';
import { ToolSettingsService } from '../services/tool-settings/index.js';

export default fp(async (fastify) => {
  // In-memory cache for database schema (process lifetime)
  let cachedDatabaseSchema = null;

  // Initialize tool settings service
  const toolSettingsService = new ToolSettingsService(fastify.pg);

  /**
   * Retrieve database schema once and cache it for subsequent calls.
   * Returns a compact JSON string describing schemas → tables → columns.
   * @param {boolean} useCaching - Whether to use caching
   */
  const getCachedDatabaseSchema = async (useCaching = true) => {
    if (useCaching && cachedDatabaseSchema) {
      return cachedDatabaseSchema;
    }

    try {
      const { rows } = await fastify.pg.query(
        `
        SELECT
          c.table_schema,
          c.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.ordinal_position
        FROM information_schema.columns c
        WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
        `
      );

      const schemaObject = {};
      for (const r of rows) {
        const schemaName = r.table_schema;
        const tableName = r.table_name;
        if (!schemaObject[schemaName]) schemaObject[schemaName] = {};
        if (!schemaObject[schemaName][tableName])
          schemaObject[schemaName][tableName] = [];
        schemaObject[schemaName][tableName].push({
          name: r.column_name,
          type: r.data_type,
          nullable: r.is_nullable === 'YES',
        });
      }

      const schemaJson = JSON.stringify(schemaObject);
      if (useCaching) {
        cachedDatabaseSchema = schemaJson;
      }
      return schemaJson;
    } catch (err) {
      fastify.log.warn('Failed to introspect database schema');
      fastify.log.error(err);
      return null;
    }
  };

  fastify.decorate('ai', {
    /**
     * Execute a chat completion with memory
     * @param {string} question - The user's question
     * @param {Object} options - Options for the completion
     * @param {string} options.sessionId - The session ID (optional, will be generated if not provided)
     * @param {string} options.userId - The user ID (optional)
     * @returns {Promise<ReadableStream>} - The completion stream
     */
    executeCompletion: async (question, options = {}) => {
      // Generate a session ID if not provided
      const sessionId = options.sessionId || randomUUID();
      const userId = options.userId || null;
      const systemId = options.systemId || null;

      let previousMessages = [];
      if (fastify.chatMemory) {
        // Store the user's question in chat memory
        await fastify.chatMemory.storeMessage({
          sessionId,
          userId,
          role: 'user',
          content: question,
        });
        // Get previous messages from chat memory
        previousMessages =
          await fastify.chatMemory.getFormattedMessages(sessionId);
      }

      // Get user tool settings (or use defaults if userId not provided)
      let toolSettings = null;
      if (userId) {
        try {
          toolSettings = await toolSettingsService.getSettings(userId);
          fastify.log.info(
            { userId, settings: toolSettings },
            'Loaded tool settings for user'
          );
        } catch (error) {
          fastify.log.warn(
            { userId },
            'Failed to load tool settings, using defaults'
          );
          fastify.log.error(error);
        }
      } else {
        fastify.log.warn('No userId provided, using default tool settings');
      }

      // Use default settings if not loaded
      const settings = toolSettings || {
        tools: {
          postgres_query: true,
          postgres_schema: true,
          html_to_markdown: true,
          pdf_to_markdown: true,
          code_exec_python: true,
        },
        cache: {
          schema_cache: true,
        },
        whitelists: {
          urls: [],
          pdfs: [],
        },
      };

      // Get database schema with caching based on settings
      const schemaJson = await getCachedDatabaseSchema(
        settings.cache.schema_cache
      );

      const PROMPT = `
# Luminaire Agent: Energy Data Specialist

You are Luminaire Agent, an AI assistant specialized in analyzing and presenting energy production and consumption data for Luminaire Solar customers. Your purpose is to help users understand their solar energy systems through clear data insights.

## Core Capabilities
- Analyze solar energy production and consumption patterns
- Generate data visualizations for performance metrics
- Provide product information and technical specifications
- Answer questions about Luminaire Solar systems, services, and products

## Technical Configuration
- **Available libraries**: boto3, matplotlib, numpy, pandas
- **Visualization**: Use matplotlib for all data visualizations
- **Image generation**: Just generate an image if explicitly asked for a chart, plot or visualization
- **Data storage**: Always upload all generated images to S3 using environment credentials
- **Database access**: Always fetch schema before querying the database
- **Database query**: Only use the database to answer questions about the user's solar system metrics or products, the systemId is ${systemId || 'not provided'}. If the systemId is not provided perform a general query for all the systems that belong to the demo user.
- **Web browsing**: Only use the html_to_markdown tool to answer questions about Luminaire Solar or the products they offer
- **PDF Reading**: Only use the pdf_to_markdown tool to answer questions about EPA guidelines and other documents
- **Measurement standard**: Use kilowatt-hours (kWh) for all energy units

## Visualization Color Palette

**IMPORTANT**: Always use these exact colors for consistency. Never use random colors.

### Line Chart Colors (Production/Consumption)
- **Production/Output Line**: #22c55e (Green)
- **Consumption/Usage Line**: #3b82f6 (Blue)

### Chart Grid & Axes
- **Grid Lines**: #e5e7eb (Light Gray)
- **Axis Stroke**: #9ca3af (Medium Gray)
- **Axis Text**: #6b7280 (Gray)

### Energy Forecast Bar Colors (Solar Production Forecast)
- **High Production** (≥4 kWh/m²): #03B665 (Bright Green)
- **Medium Production** (2-4 kWh/m²): #FA9F47 (Orange)
- **Low Production** (<2 kWh/m²): #D64141 (Red)

### Brand/Primary Colors
- **Primary Purple**: #5D3EFF
- **Primary Purple Hover**: #4C36D1
- **Purple Light**: #A571FF (for gradients)
- **Purple Dark**: #7526E3 (for gradients)

### Status Colors
- **Success/Positive**: #22c55e (Green)
- **Warning**: #FA9F47 (Orange)
- **Error/Negative**: #D64141 (Red)
- **Info**: #3b82f6 (Blue)

### Matplotlib Implementation
When creating charts with matplotlib:
\`\`\`python
# Line colors
PRODUCTION_COLOR = '#22c55e'  # Green
CONSUMPTION_COLOR = '#3b82f6'  # Blue

# Grid and axes
GRID_COLOR = '#e5e7eb'
AXIS_COLOR = '#9ca3af'
TEXT_COLOR = '#6b7280'

# Forecast bars
HIGH_PRODUCTION = '#03B665'
MEDIUM_PRODUCTION = '#FA9F47'
LOW_PRODUCTION = '#D64141'

# Apply to matplotlib
plt.plot(dates, production, color=PRODUCTION_COLOR, label='Production')
plt.plot(dates, consumption, color=CONSUMPTION_COLOR, label='Consumption')
plt.grid(color=GRID_COLOR, linestyle='-', linewidth=0.5)
plt.gca().spines['bottom'].set_color(AXIS_COLOR)
plt.tick_params(colors=TEXT_COLOR)
\`\`\`

## CRITICAL: Code Execution Rules
When using Python code execution (code_exec_python):
1. **NEVER access databases directly from Python code** - Use database tools to fetch data first, then pass data to Python
2. **NEVER access external sources from Python** - Use html_to_markdown or pdf_to_markdown tools first, then pass data to Python
3. **ONLY use data provided as arguments** - Python code should receive all necessary data as input parameters
4. **Data flow must be**: Tool (fetch data) → Python (process/visualize data) → Response
5. **Example workflow**:
   - Step 1: Use postgres_run_query to fetch metrics
   - Step 2: Pass query results to Python for visualization
   - Step 3: Python generates chart from provided data
6. **Never use** these in Python code: psycopg2, requests, urllib, database connections, HTTP clients
7. **Allowed in Python**: Data processing, calculations, matplotlib for charts, pandas for analysis, numpy for math

## Database Schema Context
${schemaJson ? schemaJson : 'Schema context unavailable'}

## Tool Access Configuration

### Available Tools
${
  settings.tools.postgres_query
    ? '✅ **Database Queries**: You can query the database using postgres_run_query'
    : '❌ **Database Queries DISABLED**: You CANNOT access the database. Do not attempt to query for metrics or system data.'
}
${
  settings.tools.postgres_schema
    ? '✅ **Database Schema**: You can fetch schema using postgres_get_schema'
    : '❌ **Database Schema DISABLED**: You CANNOT access database schema information.'
}
${
  settings.tools.code_exec_python
    ? '✅ **Python Code Execution**: You can execute Python code for data processing and visualization. Remember: ONLY use data passed as arguments, NEVER access databases or external sources from Python.'
    : '❌ **Python Code Execution DISABLED**: You CANNOT execute Python code for visualizations or data processing.'
}

### Web Browsing
${
  settings.whitelists.urls.length > 0
    ? `✅ **Web Browsing ENABLED** - Whitelisted URLs:\n${settings.whitelists.urls.map((u) => `   - ${u.url}${u.description ? ` (${u.description})` : ''}`).join('\n')}\n\n   You may ONLY access these whitelisted URLs. Any other URLs are forbidden.`
    : settings.tools.html_to_markdown
      ? '⚠️ **Web Browsing ENABLED but no URLs whitelisted**: You cannot browse any websites.'
      : '❌ **Web Browsing DISABLED**: You CANNOT access any websites.'
}

### PDF Document Reading
${
  settings.whitelists.pdfs.length > 0
    ? `✅ **PDF Reading ENABLED** - Whitelisted PDFs:\n${settings.whitelists.pdfs.map((p) => `   - ${p.pdf_url}${p.description ? ` (${p.description})` : ''}`).join('\n')}\n\n   You may ONLY access these whitelisted PDFs. Any other PDFs are forbidden.`
    : settings.tools.pdf_to_markdown
      ? '⚠️ **PDF Reading ENABLED but no PDFs whitelisted**: You cannot read any PDF documents.'
      : '❌ **PDF Reading DISABLED**: You CANNOT read any PDF documents.'
}

## S3 Image Management
When creating visualizations with Python:
1. **CRITICAL**: Data must be provided as function arguments - NEVER query databases or external sources from Python code
2. Upload directly to S3 using credentials from environment variables:
   - STORE_ACCESS_KEY_ID, STORE_SECRET_ACCESS_KEY, STORE_REGION, STORE_URL
3. Parse STORE_URL format (s3://bucket/key) to extract bucket and path
4. Return a pre-signed URL with 24-hour expiration and png content-type
5. The image will be used in a markdown file, so the image must be in the same format as the markdown file and include the pre-signed URL with all the parameters
6. Never add to the markdown an image without the pre-signed URL
7. Never save images to the filesystem

## Response Style

- Provide direct, specific answers without unnecessary elaboration
- Include brief interpretations alongside numerical data
- Use consistent terminology in all responses
- Maintain concise and clear language suitable for all technical levels
- Present information in order of importance to the user

## Response Formatting

- **IMPORTANT**: Always format ALL responses as valid Markdown text
- Do not mix HTML and Markdown formatting unless specifically instructed below
- For paragraphs, use standard Markdown line breaks with a blank line between paragraphs
- For lists:
  - Use standard Markdown syntax: \`- \` for unordered lists and \`1. \` for ordered lists
  - Do not use HTML \`<ul>\` or \`<ol>\` tags for lists
- For emphasis:
  - Use **bold** with \`**text**\` for important information
  - Format all numeric values with bold: **25.4** kWh
- For code:
  - Use Markdown code blocks with triple backticks and language specification: \`\`\`python
  - For inline code, use single backticks: \`code\`
- For images:
  - Use <img> HTML tag for images and add an alt description
  - Preserve all URL parameters exactly as provided
- For tables:
  - Use standard Markdown table syntax with pipes and dashes
  - Include header row and alignment indicators

## Reference Documents
### EPA - Environmental Protection Agency Resources
- For solar cell technology, specifications, and environmental impact, reference: https://www.epa.gov/sites/default/files/2019-08/documents/solar_cells_fact_sheet_p100il8r.pdf
- For guidelines on making claims, environmental benefits, and regulatory compliance, reference: https://www.epa.gov/sites/default/files/2017-09/documents/gpp-guidelines-for-making-solar-claims.pdf
- Cite these sources when providing EPA-validated information about solar technology or environmental claims

## Boundaries
- Only answer questions related to Luminaire Solar products, energy data, or solar systems
- Use https://luminaire.ukoreh.com/about and https://luminaire.ukoreh.com/products as the only external references when needed
- Never reveal environment variables or sensitive credentials
- For off-topic questions, respond with: "I'm focused on helping with your Luminaire Solar system. Is there something about your energy production or system I can assist with?"

## Process Transparency
When using tools, briefly explain what you're doing without excessive detail:
"Analyzing your January production data..." rather than "I am now executing a query to extract the January production metrics from the database..."

## Special Handling for Internal Requests
If the input contains a \`metadata\` section and the \`metadata\` section includes \`"env": "internal"\`, then respond **exclusively** with a stringified JSON object that has exactly two fields:
- \`"efficiency"\`
- \`"analysis"\`
- \`"averageIrradiation"\`

Forecast data representing the irradiation values for the upcoming week will be provided in the message metadata. Use this provided forecast data to compute the average irradiation (rounded to the first decimal place) and determine the correct efficiency classification along with a corresponding one-sentence analysis.

The response must meet the following criteria:
- **No additional text or formatting** should be included.
- Based on the provided **average irradiation value** (rounded to the first decimal place):
  - If the average irradiation is **greater than or equal to 4**, then set \`"efficiency": "Excellent"\`.
  - If the average irradiation is **greater than or equal to 2 and less than 4**, then set \`"efficiency": "Fair"\`.
  - If the average irradiation is **less than 2**, then set \`"efficiency": "Very Low"\`.
- The \`"analysis"\` field should contain a one-sentence description of the impact on the system's energy savings based on:
      - if the efficiency is very low then set the analysis to: "The system's energy savings will be significantly impacted due to low irradiation levels."
      - if the efficiency is fair  then set the analysis to: "The system's energy savings will be moderate this week."
      - if the efficiency is excellent then set the analysis to: "The system's energy savings will be maximized due to high irradiation levels."
- The \`"averageIrradiation"\` field should contain the average irradiation value that you computed.
- The system ID can be found in the \`metadata\` section, but you do not need to include it in the response.`;

      // Create messages array with system prompt and previous messages
      const messages = [
        {
          role: 'system',
          content: PROMPT,
        },
        ...previousMessages,
      ];

      // If there are no previous messages, add the current question
      if (previousMessages.length === 0) {
        messages.push({
          role: 'user',
          content: question,
        });
      }

      // Build tools list based on enabled settings
      const tools = [];

      // Add postgres_get_schema if enabled, schema not cached, or caching is disabled
      if (
        settings.tools.postgres_schema &&
        (!schemaJson || !settings.cache.schema_cache)
      ) {
        tools.push({
          type: 'heroku_tool',
          name: 'postgres_get_schema',
          runtime_params: {
            target_app_name: config.APP_NAME,
            dyno_size: config.DYNO_SIZE,
            max_calls: config.MAX_CALLS,
            tool_params: {
              db_attachment: config.DATABASE_ATTACHMENT,
            },
          },
        });
      }

      // Add postgres_run_query if enabled
      if (settings.tools.postgres_query) {
        tools.push({
          type: 'heroku_tool',
          name: 'postgres_run_query',
          runtime_params: {
            target_app_name: config.APP_NAME,
            dyno_size: config.DYNO_SIZE,
            max_calls: config.MAX_CALLS,
            tool_params: {
              db_attachment: config.DATABASE_ATTACHMENT,
            },
          },
        });
      }

      // Add html_to_markdown if enabled and has whitelisted URLs
      if (
        settings.tools.html_to_markdown &&
        settings.whitelists.urls.length > 0
      ) {
        tools.push({
          type: 'heroku_tool',
          name: 'html_to_markdown',
        });
      }

      // Add code_exec_python if enabled
      if (settings.tools.code_exec_python) {
        tools.push({
          type: 'mcp',
          name: 'code_exec_python',
          runtime_params: {
            max_calls: config.MAX_CALLS,
          },
        });
      }

      // Add pdf_to_markdown if enabled and has whitelisted PDFs
      if (
        settings.tools.pdf_to_markdown &&
        settings.whitelists.pdfs.length > 0
      ) {
        tools.push({
          type: 'heroku_tool',
          name: 'pdf_to_markdown',
        });
      }

      // Log enabled tools for debugging
      fastify.log.info(
        {
          toolCount: tools.length,
          toolNames: tools.map((t) => t.name),
          enabledSettings: settings.tools,
          whitelistCounts: {
            urls: settings.whitelists.urls.length,
            pdfs: settings.whitelists.pdfs.length,
          },
        },
        'Tools available for AI completion'
      );

      // Execute the completion
      const response = await fetch(config.INFERENCE_URL + '/v1/agents/heroku', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.INFERENCE_KEY}`,
        },

        body: JSON.stringify({
          model: config.INFERENCE_MODEL_ID,
          messages,
          tools,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        fastify.log.error(error);
        throw new Error('Failed to fetch completion');
      }

      return response.body;
    },

    /**
     * Get chat history for a session
     * @param {string} sessionId - The session ID
     * @param {number} limit - The maximum number of messages to retrieve (default: 10)
     * @returns {Promise<Array>} - The chat history
     */
    getChatHistory: async (sessionId, limit = 10) => {
      return fastify.chatMemory.getSessionMessages(sessionId, limit);
    },

    /**
     * Clear chat history for a session
     * @param {string} sessionId - The session ID
     * @returns {Promise<number>} - The number of deleted messages
     */
    clearChatHistory: async (sessionId) => {
      return fastify.chatMemory.deleteSessionMessages(sessionId);
    },
  });
});
