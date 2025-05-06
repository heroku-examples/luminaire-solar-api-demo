import fp from 'fastify-plugin';
import { OpenAI } from 'openai';
import { config } from '../config.js';
import { randomUUID } from 'node:crypto';

export default fp(async (fastify) => {
  const client = new OpenAI({
    apiKey: config.INFERENCE_KEY,
    baseURL: config.INFERENCE_URL + '/v1',
  });
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
- **Image generation**: Just generate an image if asked for a chart, plot or visualization
- **Data storage**: Always upload all generated images to S3 using environment credentials
- **Database access**: Always fetch schema before querying the database
- **Database query**: Only use the database to answer questions about the user's solar system metrics or products, the systemId is ${systemId || 'not provided'}. If the systemId is not provided perform a general query for all the systems that belong to the demo user.
- **Web browsing**: Only use the web browsing tool to answer questions about Luminaire Solar or the products they offer
- **Measurement standard**: Use kilowatt-hours (kWh) for all energy units

## S3 Image Management
When creating visualizations:
1. Generate the visualization using matplotlib
2. Upload directly to S3 using credentials from environment variables:
   - STORE_ACCESS_KEY_ID, STORE_SECRET_ACCESS_KEY, STORE_REGION, STORE_URL
3. Parse STORE_URL format (s3://bucket/key) to extract bucket and path
4. Return a pre-signed URL with 24-hour expiration and png content-type
5. Never save images to the filesystem

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

      // Execute the completion
      const response = await client.chat.completions.create({
        model: config.INFERENCE_MODEL_ID,
        messages,
        tools: [
          {
            type: 'heroku_tool',
            function: {
              name: 'database_get_schema',
            },
            runtime_params: {
              target_app_name: config.APP_NAME,
              dyno_size: config.DYNO_SIZE,
              tool_params: {
                db_attachment: config.DATABASE_ATTACHMENT,
              },
            },
          },
          {
            type: 'heroku_tool',
            function: {
              name: 'database_run_query',
            },
            runtime_params: {
              target_app_name: config.APP_NAME,
              dyno_size: config.DYNO_SIZE,
              tool_params: {
                db_attachment: config.DATABASE_ATTACHMENT,
              },
            },
          },
          {
            type: 'heroku_tool',
            function: {
              name: 'web_browsing_single_page',
            },
          },
          {
            type: 'heroku_tool',
            function: {
              name: 'code_exec_python',
            },
            runtime_params: {
              target_app_name: config.PYTHON_RUNNER,
              max_retries: 4,
            },
          },
          {
            type: 'heroku_tool',
            function: {
              name: 'pdf_read',
            },
          },
        ],
        tool_choice: 'auto',
        stream: true,
      });

      return response;
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
