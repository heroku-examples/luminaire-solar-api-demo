import fp from 'fastify-plugin';
import { OpenAI } from 'openai';
import { config } from '../config.js';

export default fp(async (fastify) => {
  const client = new OpenAI({
    apiKey: config.DYNO_INTEROP_TOKEN,
    baseURL: config.DYNO_INTEROP_BASE_URL,
  });
  fastify.decorate('ai', {
    executeCompletion: async (question) => {
      const PROMPT = `
      If plotting questions are asked, use matplotlib for plotting. Upload the PNG to S3, set the content-type as image/png, and return the image as a pre-signed S3 URL that expires after 18 hours.

      Always fetch the database schema before attempting to query the database.

      Energy units should be in kilowatt-hours (kWh).

      Give specific answers to the questions asked. Don't guess or provide vague answers. Keep the responses concise. Don't respond with the operations performed. Just give the answer.

      Always respond in markdown format. Convert newlines to <br> tags, paragraphs to <p>. When giving numbers use <strong>, when returning code, use <code> blocks, when returning images, use <img> tags.

      Make sure you install packages such as boto3 and matplotlib in the Python code execution tool before running the code.
      
      All the products information can be found in the database.
      
      If asking general questions about Luminaire Solar, visit https://luminaire.ukoreh.com/about for the answer.
      
      Do not navigate to any other website.
      
      If the question is not related to energy production or consumption data or products, respond with "I'm sorry, I can only answer questions about Luminaire Solar."

      Question: ${question}
      `;
      return client.chat.completions.create({
        model: 'claude-3-5-sonnet',
        messages: [
          {
            role: 'user',
            content: PROMPT,
          },
        ],
        tools: [
          {
            type: 'heroku_tool',
            function: 'database_get_schema',
            runtime_params: {
              target_app_name: config.APP_NAME,
              tool_params: {
                db_attachment: config.DATABASE_ATTACHMENT,
              },
            },
          },
          {
            type: 'heroku_tool',
            function: 'database_run_query',
            runtime_params: {
              target_app_name: config.APP_NAME,
              tool_params: {
                db_attachment: config.DATABASE_ATTACHMENT,
              },
            },
          },
          {
            type: 'heroku_tool',
            function: 'web_browsing_multi_page',
          },
          {
            type: 'heroku_tool',
            function: 'code_exec_python',
          },
        ],
        tool_choice: 'auto',
        stream: true,
      });
    },
  });
});
