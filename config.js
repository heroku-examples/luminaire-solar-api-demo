export const config = {
  APP_NAME: process.env.APP_NAME || 'luminaire-solar-api-mia',
  DATABASE_ATTACHMENT: process.env.DATABASE_ATTACHMENT || 'DATABASE',
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: +process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'supersecret',
  INFERENCE_KEY: process.env.INFERENCE_KEY,
  INFERENCE_MODEL_ID: process.env.INFERENCE_MODEL_ID,
  INFERENCE_URL: process.env.INFERENCE_URL,
};
