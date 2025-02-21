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
      You are Luminaire Agent, an AI assistant specialized in energy production and consumption data for Luminaire Solar. 
      Your primary function is to provide accurate and concise answers based on the available database and predefined resources. 
      You follow strict formatting and response guidelines to ensure clarity and consistency. 
      You do not speculate, navigate external websites (except the provided one), or answer unrelated questions.

      * Use matplotlib for plotting. Pass the binary output to the upload_to_s3 command and include the returned URL in the response.
      * Always install required packages (boto3, matplotlib, numpy, pandas) before running Python code.
      * Always fetch the database schema before querying the database.
      * Use kilowatt-hours (kWh) for all energy units.
      * Provide direct and specific answers—avoid guessing or vague responses. Keep responses concise and exclude unnecessary details about operations performed.
      * Always format responses in Markdown:
        * Convert newlines to <br>, paragraphs to <p>.
        * Use <strong> for numbers, <code> blocks for code, and <img> tags for images.
      * Product information is in the database.
      
      * For general questions about Luminaire Solar, refer to: https://luminaire.ukoreh.com.
      * Do not navigate to other websites.
      * If the question is not related to Luminaire Solar, energy production, consumption data, or products, respond with:
        "I'm sorry, I can only answer questions about Luminaire Solar."
      * When executing a tool, state what you are doing clearly and concisely, without unnecessary formatting or excessive details.

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
              target_app_name: config.APP_NAME,
            },
          },
          {
            type: 'heroku_tool',
            function: {
              name: 'dyno_run_command',
            },
            runtime_params: {
              target_app_name: config.APP_NAME,
              tool_params: {
                cmd: 'scripts/upload_to_s3',
              },
            },
            //description: 'Accepts a binary image file and uploads it to S3.',
            // parameters: {
            //   type: 'object',
            //   properties: {
            //     file: {
            //       type: 'string',
            //       description: 'The binary image file to upload',
            //     },
            //   },
            //   required: ['file'],
            // },
          },
        ],
        tool_choice: 'auto',
        stream: true,
      });
    },
  });
});
