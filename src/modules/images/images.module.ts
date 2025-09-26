import { Module } from '@nestjs/common';
import { ImagesController } from './controllers/images.controller';
import { ImagesService } from './services/images.service';
import { S3Service } from '../../shared/aws/s3/s3.service';
import { DynamoDBService } from '../../shared/aws/dynamodb/dynamodb.service';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService, S3Service, DynamoDBService],
  exports: [ImagesService],
})
export class ImagesModule {}
