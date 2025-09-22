import * as dotenv from 'dotenv';

// Load environment variables before anything else
dotenv.config();

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, awsConfig, validateEnvironmentVariables } from './config';
import { HealthModule } from './modules/health/health.module';
import { ImagesModule } from './modules/images/images.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig, awsConfig],
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: () => {
        validateEnvironmentVariables();
        return process.env;
      },
    }),
    HealthModule,
    ImagesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
