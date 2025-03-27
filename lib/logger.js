import pino from 'pino';

export const loggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
};

const logger = pino(loggerOptions);

export function getLogger() {
  return logger;
}
