export const config = {
  APP_NAME: process.env.APP_NAME, // The app name to use for the heroku tools
  PYTHON_RUNNER: process.env.PYTHON_RUNNER, // The app name to use for the heroku tools python runner
  DATABASE_ATTACHMENT: process.env.DATABASE_ATTACHMENT || 'DATABASE', // The name of the database attachment to use for the heroku tools
  DYNO_SIZE: process.env.DYNO_SIZE || 'Standard-1X', // The size of the dyno to use for the heroku tools
  DATABASE_URL: process.env.DATABASE_URL,
  ENABLE_MEMORY: process.env.ENABLE_MEMORY || false,
  REDIS_URL: process.env.REDIS_URL,
  PORT: +process.env.PORT || 3000,
  PUBLIC_KEY: process.env.PUBLIC_KEY,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  INFERENCE_KEY: process.env.INFERENCE_KEY,
  INFERENCE_MODEL_ID: process.env.INFERENCE_MODEL_ID,
  INFERENCE_URL: process.env.INFERENCE_URL,
};
