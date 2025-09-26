import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { getErrorMessage, hasErrorName } from '../../utils/error.util';

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export interface ImageMetadata {
  size: number;
  mimeType: string;
  originalName: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'image-recognition-dev-bucket';

    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    this.s3Client = new S3Client({
      region,
      ...(accessKeyId &&
        secretAccessKey && {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }),
    });

    this.logger.log(`S3Service initialized with bucket: ${this.bucketName}`);
  }

  /**
   * Upload an image file to S3
   */
  async uploadImage(file: Express.Multer.File, imageId?: string): Promise<UploadResult> {
    try {
      const key = imageId || uuidv4();
      const fileExtension = this.getFileExtension(file.originalname);
      const objectKey = `images/${key}${fileExtension}`;

      this.logger.log(`Uploading image to S3: ${objectKey}`);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${objectKey}`;

      this.logger.log(`Image uploaded successfully: ${url}`);

      return {
        key: objectKey,
        url,
        bucket: this.bucketName,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to upload image to S3: ${errorMessage}`);
      throw new Error(`S3 upload failed: ${errorMessage}`);
    }
  }

  /**
   * Get a signed URL for downloading an image
   */
  async getImageUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      this.logger.log(`Generating signed URL for: ${key}`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url: string = await getSignedUrl(this.s3Client, command, { expiresIn });

      this.logger.log(`Signed URL generated successfully`);
      return url;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to generate signed URL: ${errorMessage}`);
      throw new Error(`Failed to get image URL: ${errorMessage}`);
    }
  }

  /**
   * Get image object stream from S3
   */
  async getImageStream(
    key: string,
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string; contentLength: number }> {
    try {
      this.logger.log(`Getting image stream for: ${key}`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('No image data received from S3');
      }

      return {
        stream: response.Body as NodeJS.ReadableStream,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get image stream: ${errorMessage}`);
      throw new Error(`Failed to get image stream: ${errorMessage}`);
    }
  }

  /**
   * Check if an image exists in S3
   */
  async imageExists(key: string): Promise<boolean> {
    try {
      this.logger.log(`Checking if image exists: ${key}`);

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (hasErrorName(error, 'NotFound')) {
        return false;
      }
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Error checking image existence: ${errorMessage}`);
      throw new Error(`Failed to check image existence: ${errorMessage}`);
    }
  }

  /**
   * Delete an image from S3
   */
  async deleteImage(key: string): Promise<void> {
    try {
      this.logger.log(`Deleting image from S3: ${key}`);

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      this.logger.log(`Image deleted successfully: ${key}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to delete image from S3: ${errorMessage}`);
      throw new Error(`S3 delete failed: ${errorMessage}`);
    }
  }

  /**
   * Get image metadata from S3
   */
  async getImageMetadata(key: string): Promise<ImageMetadata> {
    try {
      this.logger.log(`Getting image metadata: ${key}`);

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        size: response.ContentLength || 0,
        mimeType: response.ContentType || 'application/octet-stream',
        originalName: response.Metadata?.originalName || 'unknown',
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get image metadata: ${errorMessage}`);
      throw new Error(`Failed to get image metadata: ${errorMessage}`);
    }
  }

  /**
   * Validate image file type and size
   */
  validateImage(file: Express.Multer.File): void {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size: ${maxSize / 1024 / 1024}MB`);
    }

    this.logger.log(`Image validation passed: ${file.originalname}`);
  }

  /**
   * Extract file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }
}
