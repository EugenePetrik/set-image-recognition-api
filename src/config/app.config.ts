import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0',
  apiVersion: process.env.API_VERSION || 'v1',
  apiPrefix: process.env.API_PREFIX || 'api',
  logLevel: process.env.LOG_LEVEL || 'info',
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT ?? '10000', 10),
}));
