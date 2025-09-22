import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { HealthService } from './services/health.service';
import { S3Service } from '../../shared/aws/s3/s3.service';
import { DynamoDBService } from '../../shared/aws/dynamodb/dynamodb.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, S3Service, DynamoDBService],
  exports: [HealthService],
})
export class HealthModule {}
