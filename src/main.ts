import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  const environment = configService.get<string>('app.environment', 'development');
  const version = configService.get<string>('app.version', '1.0.0');

  app.setGlobalPrefix(`${configService.get<string>('API_PREFIX')}/${configService.get<string>('API_VERSION')}`);

  // Only logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('Image Recognition API Docs123')
    .setDescription('A comprehensive API for image upload, storage, and AI-powered recognition using AWS services')
    .setVersion(version)
    .addTag('health', 'Health check endpoints')
    .addTag('image', 'Image management and recognition endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Image Recognition API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`� API Documentation: http://localhost:${port}/api/docs`);
  console.log(`❤️  Health Check: http://localhost:${port}/health`);
  console.log(`📝 Environment: ${environment}`);
  console.log(`🗄️ S3 Bucket: ${process.env.AWS_S3_BUCKET_NAME || 'not set'}`);
  console.log(`🗂️ DynamoDB Table: ${process.env.AWS_DYNAMODB_TABLE_NAME || 'not set'}`);
}

void bootstrap();
