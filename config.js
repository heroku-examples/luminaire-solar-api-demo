export const config = {
  APP_NAME: process.env.APP_NAME,
  PYTHON_RUNNER: process.env.PYTHON_RUNNER,
  DATABASE_ATTACHMENT: process.env.DATABASE_ATTACHMENT,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  PORT: +process.env.PORT || 3000,
  PUBLIC_KEY: process.env.PUBLIC_KEY,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  INFERENCE_KEY: process.env.INFERENCE_KEY,
  INFERENCE_MODEL_ID: process.env.INFERENCE_MODEL_ID,
  INFERENCE_URL: process.env.INFERENCE_URL,
};
