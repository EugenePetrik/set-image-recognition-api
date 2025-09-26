import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Readable } from 'stream';
import { S3Service } from '../../../shared/aws/s3/s3.service';
import {
  DynamoDBService,
  ImageEntity,
  getLabelName,
  getLabelConfidence,
} from '../../../shared/aws/dynamodb/dynamodb.service';
import { UploadImageDto } from '../dto/upload-image.dto';
import { ImageUploadResponseDto } from '../dto/image-upload-response.dto';
import { GetAllImagesDto } from '../dto/get-all-images.dto';
import { SearchImagesDto } from '../dto/search-images.dto';
import { ImageResponseDto } from '../dto/image-response.dto';
import { LabelResponseDto } from '../dto/label-response.dto';
import { getErrorMessage } from '../../../shared/utils/error.util';

export interface GetAllImagesResponseDto {
  images: ImageResponseDto[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface SearchImagesResponseDto {
  images: (ImageResponseDto & { matchingLabel?: { name: string; confidence: number } })[];
  searchCriteria: {
    label: string;
    confidence: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly dynamoService: DynamoDBService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Upload an image and initiate recognition process
   */
  async uploadImage(file: Express.Multer.File, uploadDto: UploadImageDto): Promise<ImageUploadResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Validate the image file
      this.s3Service.validateImage(file);

      // Generate unique image ID
      const imageId = `img_${Date.now()}`;

      this.logger.log(`Processing image upload: ${file.originalname} -> ${imageId}`);

      // Upload to S3 (this will trigger the recognition pipeline)
      const uploadResult = await this.s3Service.uploadImage(file, imageId);

      // Store initial metadata in DynamoDB
      const imageMetadata: Partial<ImageEntity> = {
        ImageId: imageId,
        CreatedAt: 'METADATA',
        name: file.originalname,
        url: uploadResult.url,
        s3Key: uploadResult.key,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
        status: 'uploading',
        labels: [],
        // Include description from uploadDto if provided
        ...(uploadDto.description && { description: uploadDto.description }),
      };

      await this.dynamoService.putImageMetadata(imageMetadata);

      this.logger.log(`Image uploaded successfully: ${imageId}`);

      return {
        imageId,
        imageUrl: uploadResult.url,
        uploadedAt: imageMetadata.uploadedAt,
        message: 'Image uploaded successfully. Recognition process started.',
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to upload image: ${errorMessage}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Image upload failed: ${errorMessage}`);
    }
  }

  /**
   * Get all images with pagination
   */
  async getAllImages(query: GetAllImagesDto): Promise<GetAllImagesResponseDto> {
    try {
      // Ensure proper defaults and validation for pagination parameters
      const page = Math.max(1, query.page || 1);
      const limit = Math.min(100, Math.max(1, query.limit || 10));

      this.logger.log(`Getting all images: page ${page}, limit ${limit}`);

      const result = await this.dynamoService.getAllImages(page, limit);

      const images = result.items.map((item) => this.mapToImageResponse(item));

      return {
        images,
        pagination: {
          page,
          limit,
          hasMore: result.hasMore,
        },
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get all images: ${errorMessage}`);
      throw new BadRequestException(`Failed to retrieve images: ${errorMessage}`);
    }
  }

  /**
   * Get specific image metadata by ID
   */
  async getImageById(id: string): Promise<ImageResponseDto> {
    try {
      this.logger.log(`Getting image metadata: ${id}`);

      const imageMetadata = await this.dynamoService.getImageMetadata(id);

      if (!imageMetadata) {
        throw new NotFoundException(`Image with ID '${id}' not found`);
      }

      return this.mapToImageResponse(imageMetadata);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get image by ID: ${errorMessage}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Failed to get image: ${errorMessage}`);
    }
  }

  /**
   * Get image file stream
   */
  async getImageFile(id: string, res: Response): Promise<void> {
    try {
      this.logger.log(`Getting image file stream for ID: ${id}`);

      // Get image metadata from DynamoDB
      const imageMetadata = await this.dynamoService.getImageMetadata(id);

      if (!imageMetadata) {
        throw new NotFoundException(`Image with ID '${id}' not found`);
      }

      // Check if image exists in S3
      const exists = await this.s3Service.imageExists(imageMetadata.s3Key);
      if (!exists) {
        throw new NotFoundException(`Image file not found in storage`);
      }

      // Get image stream from S3
      const { stream, contentType, contentLength } = await this.s3Service.getImageStream(imageMetadata.s3Key);

      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', contentLength);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

      // Set content disposition for proper filename
      const filename = imageMetadata.name || `image-${id}`;
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

      // Pipe the stream to the response
      if (stream instanceof Readable) {
        stream.pipe(res);
      } else {
        // For AWS SDK v3, the Body might be a different type
        (stream as Readable).pipe(res);
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get image file: ${errorMessage}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Failed to get image file: ${errorMessage}`);
    }
  }

  /**
   * Search images by label
   */
  async searchImagesByLabel(searchDto: SearchImagesDto): Promise<SearchImagesResponseDto> {
    try {
      this.logger.log(`Searching images by label: ${searchDto.label}`);

      const result = await this.dynamoService.queryImagesByLabel(
        searchDto.label,
        searchDto.confidence,
        searchDto.limit,
      );

      const images = result.items.map((item) => {
        const imageResponse = this.mapToImageResponse(item);

        // Add matching label info
        const matchingLabel = item.labels?.find((label) => {
          const labelName = getLabelName(label);
          const labelConfidence = getLabelConfidence(label);
          return (
            labelName &&
            labelConfidence != null &&
            labelName.toLowerCase() === searchDto.label.toLowerCase() &&
            labelConfidence >= (searchDto.confidence || 80)
          );
        });

        // Transform the matching label to the expected format
        const transformedMatchingLabel = matchingLabel
          ? {
              name: getLabelName(matchingLabel),
              confidence: getLabelConfidence(matchingLabel),
            }
          : undefined;

        return {
          ...imageResponse,
          matchingLabel: transformedMatchingLabel,
        };
      });

      return {
        images,
        searchCriteria: {
          label: searchDto.label,
          confidence: searchDto.confidence || 80,
        },
        pagination: {
          page: searchDto.page || 1,
          limit: searchDto.limit || 10,
          total: result.total,
          pages: Math.ceil(result.total / (searchDto.limit || 10)),
        },
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to search images by label: ${errorMessage}`);
      throw new BadRequestException(`Search failed: ${errorMessage}`);
    }
  }

  /**
   * Get all available labels with statistics
   */
  async getAllLabels(query: { limit?: number; minCount?: number }): Promise<LabelResponseDto> {
    try {
      this.logger.log('Getting all available labels');

      const limit = typeof query.limit === 'number' ? query.limit : 50;
      const minCount = typeof query.minCount === 'number' ? query.minCount : 1;
      const labelStats = await this.dynamoService.getAllLabelsWithStats(limit, minCount);

      return {
        labels: labelStats,
        total: labelStats.length,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get all labels: ${errorMessage}`);
      throw new BadRequestException(`Failed to get labels: ${errorMessage}`);
    }
  }

  /**
   * Delete an image and its metadata
   */
  async deleteImage(id: string): Promise<{ message: string }> {
    try {
      this.logger.log(`Deleting image: ${id}`);

      const imageMetadata = await this.dynamoService.getImageMetadata(id);

      if (!imageMetadata) {
        throw new NotFoundException(`Image with ID '${id}' not found`);
      }

      // Delete from S3
      await this.s3Service.deleteImage(imageMetadata.s3Key);

      // Delete from DynamoDB
      await this.dynamoService.deleteImageMetadata(id);

      this.logger.log(`Image deleted successfully: ${id}`);

      return { message: `Image ${id} deleted successfully` };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to delete image: ${errorMessage}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Failed to delete image: ${errorMessage}`);
    }
  }

  /**
   * Map ImageEntity to ImageResponseDto
   */
  private mapToImageResponse(entity: ImageEntity): ImageResponseDto {
    return {
      id: entity.ImageId,
      name: entity.name,
      url: entity.url,
      labels: (entity.labels || []).map((label) => ({
        name: getLabelName(label),
        confidence: getLabelConfidence(label),
      })),
      uploadedAt: entity.uploadedAt,
      size: entity.size,
      mimeType: entity.mimeType,
      status: entity.status,
    };
  }
}
