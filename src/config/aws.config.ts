import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME || 'image-recognition-bucket',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  dynamodb: {
    tableName: process.env.AWS_DYNAMODB_TABLE_NAME || 'image-recognition-table',
    region: process.env.AWS_REGION || 'us-east-1',
  },
}));
