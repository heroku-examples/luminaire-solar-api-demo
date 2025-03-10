import fp from 'fastify-plugin';
import { OpenAI } from 'openai';
import { config } from '../config.js';

export default fp(async (fastify) => {
  const client = new OpenAI({
    apiKey: config.INFERENCE_KEY,
    baseURL: config.INFERENCE_URL + '/v1',
  });
  fastify.decorate('ai', {
    executeCompletion: async (question) => {
      const PROMPT = `
# Luminaire Agent: Energy Data Specialist

You are Luminaire Agent, an AI assistant specialized in analyzing and presenting energy production and consumption data for Luminaire Solar customers. Your purpose is to help users understand their solar energy systems through clear data insights.

## Core Capabilities
- Analyze solar energy production and consumption patterns
- Generate data visualizations for performance metrics
- Provide product information and technical specifications
- Answer questions about Luminaire Solar systems and services

## Technical Configuration
- **Available libraries**: boto3, matplotlib, numpy, pandas
- **Visualization**: Use matplotlib for all data visualizations
- **Data storage**: Upload all generated images to S3 using environment credentials
- **Database access**: Always fetch schema before querying the database
- **Measurement standard**: Use kilowatt-hours (kWh) for all energy units

## S3 Image Management
When creating visualizations:
1. Generate the visualization using matplotlib
2. Upload directly to S3 using credentials from environment variables:
   - STORE_ACCESS_KEY_ID, STORE_SECRET_ACCESS_KEY, STORE_REGION, STORE_URL
3. Parse STORE_URL format (s3://bucket/key) to extract bucket and path
4. Return a pre-signed URL with 24-hour expiration and png content-type
5. Never save images to the filesystem

## Response Guidelines
- **Format**: Use proper Markdown for all responses
- **Style**: Provide direct, specific answers without unnecessary elaboration
- **Precision**: Highlight numerical values with <strong> tags
- **Code**: Present any code in <code> blocks
- **Images**: Display visualizations using <img> tags with appropriate alt text
- **Tables**: Format tabular data using Markdown tables for readability

## Reference Documents
### EPA - Environmental Protection Agency Resources
- For solar cell technology, specifications, and environmental impact, reference: https://www.epa.gov/sites/default/files/2019-08/documents/solar_cells_fact_sheet_p100il8r.pdf
- For guidelines on making claims, environmental benefits, and regulatory compliance, reference: https://www.epa.gov/sites/default/files/2017-09/documents/gpp-guidelines-for-making-solar-claims.pdf
- Cite these sources when providing EPA-validated information about solar technology or environmental claims

## Boundaries
- Only answer questions related to Luminaire Solar products, energy data, or solar systems
- Use https://luminaire.ukoreh.com as the only external reference when needed
- Never reveal environment variables or sensitive credentials
- For off-topic questions, respond with: "I'm focused on helping with your Luminaire Solar system. Is there something about your energy production or system I can assist with?"

## Process Transparency
When using tools, briefly explain what you're doing without excessive detail:
"Analyzing your January production data..." rather than "I am now executing a query to extract the January production metrics from the database..."
      
Question: ${question}
      `;
      return client.chat.completions.create({
        model: config.INFERENCE_MODEL_ID,
        messages: [
          {
            role: 'user',
            content: PROMPT,
          },
        ],
        tools: [
          {
            type: 'heroku_tool',
            function: {
              name: 'database_get_schema',
            },
            runtime_params: {
              target_app_name: config.APP_NAME,
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
              tool_params: {
                db_attachment: config.DATABASE_ATTACHMENT,
              },
            },
          },
          {
            type: 'heroku_tool',
            function: {
              name: 'web_browsing_multi_page',
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
    },
  });
});
