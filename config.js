export const config = {
  PORT: +process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  PUBLIC_KEY: process.env.PUBLIC_KEY,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  AI_ENGINE: process.env.AI_ENGINE, // mia or agentforce
  // Configuration options if AI_ENGINE is MIA
  ENABLE_MEMORY: process.env.ENABLE_MEMORY || false,
  REDIS_URL: process.env.REDIS_URL,
  APP_NAME: process.env.APP_NAME, // The app name to use for the heroku tools
  DATABASE_ATTACHMENT: process.env.DATABASE_ATTACHMENT, // The name of the database attachment to use for the heroku tools
  DYNO_SIZE: process.env.DYNO_SIZE || 'Standard-1X', // The size of the dyno to use for the heroku tools
  INFERENCE_KEY: process.env.INFERENCE_KEY,
  INFERENCE_MODEL_ID: process.env.INFERENCE_MODEL_ID,
  INFERENCE_URL: process.env.INFERENCE_URL,
  MAX_CALLS: process.env.MAX_CALLS || 5,
};

// Check required config for MIA
if (config.AI_ENGINE === 'mia') {
  if (!config.INFERENCE_KEY) {
    throw new Error(
      'INFERENCE_KEY is required for MIA, please provision the MIA addon'
    );
  }
  if (!config.INFERENCE_URL) {
    throw new Error(
      'INFERENCE_URL is required for MIA, please provision the MIA addon'
    );
  }
  if (!config.INFERENCE_MODEL_ID) {
    throw new Error(
      'INFERENCE_MODEL_ID is required for MIA, please provision the MIA addon'
    );
  }

  if (!config.APP_NAME) {
    throw new Error(
      'APP_NAME is required for MIA, please set the APP_NAME environment variable'
    );
  }

  if (!config.DATABASE_ATTACHMENT) {
    throw new Error(
      'DATABASE_ATTACHMENT is required for MIA, please set the DATABASE_ATTACHMENT environment variable'
    );
  }

  if (config.ENABLE_MEMORY) {
    if (!config.REDIS_URL) {
      throw new Error(
        'REDIS_URL is required for Chat Memory in MIA, please provision a Heroku Key-Value Store addon'
      );
    }
  }
}
