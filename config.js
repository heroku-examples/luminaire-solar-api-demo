export const config = {
  APP_NAME: process.env.APP_NAME || 'lumina-solar-api',
  DATABASE_ATTACHMENT: process.env.DATABASE_ATTACHMENT || 'DATABASE',
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: +process.env.PORT || 3000,
  PUBLIC_KEY: JSON.parse(process.env.PUBLIC_KEY),
  PRIVATE_KEY: JSON.parse(process.env.PRIVATE_KEY),
  DYNO_INTEROP_BASE_URL: process.env.DYNO_INTEROP_BASE_URL,
  DYNO_INTEROP_TOKEN: process.env.DYNO_INTEROP_TOKEN,
};
