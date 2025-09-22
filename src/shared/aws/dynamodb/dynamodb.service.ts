import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommandInput,
  ScanCommandInput,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { getErrorMessage } from '../../utils/error.util';

export interface ImageEntity {
  ImageId: string;
  CreatedAt: string;
  name: string;
  url: string;
  s3Key: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  labels?: LabelUnion[];
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface Label {
  name: string;
  confidence: number;
}

// Raw label format from DynamoDB/Lambda
export interface RawLabel {
  Name: string;
  Confidence: number;
}

// Union type for labels that can be in either format
export type LabelUnion = Label | RawLabel;

export interface LabelStats {
  name: string;
  count: number;
  averageConfidence: number;
}

// Utility functions to safely access label properties
export function getLabelName(label: LabelUnion): string {
  return 'Name' in label ? label.Name : label.name;
}

export function getLabelConfidence(label: LabelUnion): number {
  return 'Confidence' in label ? label.Confidence : label.confidence;
}

// Type guard to check if a label is in raw format
export function isRawLabel(label: LabelUnion): label is RawLabel {
  return 'Name' in label && 'Confidence' in label;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

// Type for DynamoDB raw item response
interface DynamoDBImageItem {
  ImageId?: string;
  CreatedAt?: string;
  name?: string;
  url?: string;
  s3Key?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  status?: string;
  labels?: Label[];
  dimensions?: {
    width: number;
    height: number;
  };
  // Lambda-created fields (for compatibility)
  FileName?: string;
  S3Key?: string;
  FileSize?: number;
  ProcessedAt?: string;
  Status?: string;
  Labels?: Label[];
  S3Bucket?: string;
  ETag?: string;
  VersionId?: string;
  LabelValue?: string;
}

// Type for DynamoDB pagination key
@Injectable()
export class DynamoDBService {
  private readonly logger = new Logger(DynamoDBService.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    this.tableName = this.configService.get<string>('AWS_DYNAMODB_TABLE_NAME') || 'image-recognition-dev-table';

    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    this.dynamoClient = new DynamoDBClient({
      region,
      ...(accessKeyId &&
        secretAccessKey && {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }),
    });

    this.docClient = DynamoDBDocumentClient.from(this.dynamoClient);

    this.logger.log(`DynamoDBService initialized with table: ${this.tableName}`);
  }

  /**
   * Store image metadata in DynamoDB
   */
  async putImageMetadata(imageData: Partial<ImageEntity>): Promise<void> {
    try {
      const item: ImageEntity = {
        ImageId: imageData.ImageId,
        CreatedAt: imageData.CreatedAt || 'METADATA',
        name: imageData.name,
        url: imageData.url,
        s3Key: imageData.s3Key,
        size: imageData.size,
        mimeType: imageData.mimeType,
        uploadedAt: imageData.uploadedAt || new Date().toISOString(),
        status: imageData.status || 'uploading',
        labels: imageData.labels || [],
        dimensions: imageData.dimensions,
      };

      this.logger.log(`Storing image metadata: ${item.ImageId}`);

      const command = new PutCommand({
        TableName: this.tableName,
        Item: item,
      });

      await this.docClient.send(command);

      this.logger.log(`Image metadata stored successfully: ${item.ImageId}`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to store image metadata: ${errorMessage}`);
      throw new Error(`DynamoDB put failed: ${errorMessage}`);
    }
  }

  /**
   * Get image metadata by ID
   */
  async getImageMetadata(imageId: string): Promise<ImageEntity | null> {
    try {
      this.logger.log(`Getting image metadata: ${imageId}`);

      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          ImageId: imageId,
          CreatedAt: 'METADATA',
        },
      });

      const response = await this.docClient.send(command);

      if (!response.Item) {
        this.logger.log(`Image not found: ${imageId}`);
        return null;
      }

      return response.Item as ImageEntity;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get image metadata: ${errorMessage}`);
      throw new Error(`DynamoDB get failed: ${errorMessage}`);
    }
  }

  /**
   * Get all images with pagination
   */
  async getAllImages(page: number = 1, limit: number = 10): Promise<PaginatedResult<ImageEntity>> {
    try {
      this.logger.log(`Getting all images: page ${page}, limit ${limit}`);

      // For proper pagination, we need to scan through pages sequentially
      // This avoids the ID shifting issue that occurs with client-side slicing
      let lastEvaluatedKey: Record<string, any> | undefined;
      let allItems: ImageEntity[] = [];
      let currentPage = 1;

      // Scan through pages until we reach the desired page
      while (currentPage <= page) {
        const params: ScanCommandInput = {
          TableName: this.tableName,
          FilterExpression: 'CreatedAt = :metadata',
          ExpressionAttributeValues: {
            ':metadata': 'METADATA',
          },
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        };

        const command = new ScanCommand(params);
        const response = await this.docClient.send(command);

        const items = (response.Items || []) as DynamoDBImageItem[];

        const typedItems: ImageEntity[] = items.map((item, index) => {
          try {
            // Handle size field with proper type conversion
            let size = 0;
            if (typeof item.size === 'number') {
              size = item.size;
            } else if (typeof item.FileSize === 'number') {
              size = item.FileSize;
            } else if (item.size) {
              const parsedSize = parseInt(String(item.size), 10);
              size = isNaN(parsedSize) ? 0 : parsedSize;
            } else if (item.FileSize) {
              const parsedFileSize = parseInt(String(item.FileSize), 10);
              size = isNaN(parsedFileSize) ? 0 : parsedFileSize;
            }

            // Handle labels array
            const labels = Array.isArray(item.labels) ? item.labels : Array.isArray(item.Labels) ? item.Labels : [];

            return {
              ImageId: item.ImageId || '',
              CreatedAt: item.CreatedAt || '',
              name: item.name || item.FileName || '',
              url: item.url || '',
              s3Key: item.s3Key || item.S3Key || '',
              size,
              mimeType: item.mimeType || '',
              uploadedAt: item.uploadedAt || item.ProcessedAt || '',
              status: (item.status as ImageEntity['status']) || (item.Status as ImageEntity['status']) || 'uploading',
              labels,
              dimensions: item.dimensions,
            };
          } catch (itemError) {
            this.logger.error(`Error processing item ${index}: ${getErrorMessage(itemError)}`);
            this.logger.error(`Problematic item: ${JSON.stringify(item)}`);
            // Return a default item to prevent the entire request from failing
            return {
              ImageId: item.ImageId || 'unknown',
              CreatedAt: item.CreatedAt || '',
              name: 'Error processing item',
              url: '',
              s3Key: '',
              size: 0,
              mimeType: '',
              uploadedAt: '',
              status: 'error' as ImageEntity['status'],
              labels: [],
              dimensions: undefined,
            };
          }
        });

        if (currentPage === page) {
          // This is the page we want
          allItems = typedItems;
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
        currentPage++;

        // If we've reached the desired page or there are no more items, break
        if (currentPage > page || !lastEvaluatedKey) {
          break;
        }
      }

      // Check if there are more pages
      const hasMore = !!lastEvaluatedKey;

      this.logger.log(`Retrieved ${allItems.length} images for page ${page}`);

      return {
        items: allItems,
        total: allItems.length, // Note: total count is not easily available with DynamoDB scan
        hasMore,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get all images: ${errorMessage}`);
      throw new Error(`DynamoDB scan failed: ${errorMessage}`);
    }
  }

  /**
   * Search images by label using GSI
   */
  async queryImagesByLabel(
    label: string,
    minConfidence: number = 80,
    limit: number = 10,
  ): Promise<PaginatedResult<ImageEntity>> {
    try {
      this.logger.log(`Searching images by label: ${label}, confidence: ${minConfidence}`);

      // First, try to find images where the primary label matches
      const primaryLabelParams: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: 'LabelIndex',
        KeyConditionExpression: 'LabelValue = :label',
        ExpressionAttributeValues: {
          ':label': label,
        },
        Limit: Number(limit),
      };

      const primaryLabelCommand = new QueryCommand(primaryLabelParams);
      const primaryLabelResponse = await this.docClient.send(primaryLabelCommand);

      // Get all processed images to search through their labels
      const allImagesParams: ScanCommandInput = {
        TableName: this.tableName,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'processed',
        },
        Limit: 100, // Reasonable limit for scanning
      };

      const allImagesCommand = new ScanCommand(allImagesParams);
      const allImagesResponse = await this.docClient.send(allImagesCommand);

      // Combine results and filter by label and confidence in application code
      const allItems = [...(primaryLabelResponse.Items || []), ...(allImagesResponse.Items || [])];

      // Remove duplicates and convert to ImageEntity
      const uniqueItems = new Map<string, any>();
      for (const item of allItems) {
        if (item.ImageId && item.CreatedAt === 'METADATA') {
          uniqueItems.set(item.ImageId as string, item);
        }
      }

      // Filter by label and confidence
      const filteredImages: ImageEntity[] = [];
      for (const [, item] of uniqueItems) {
        const imageEntity = item as ImageEntity;

        // Check if any label matches the search criteria
        const hasMatchingLabel = imageEntity.labels?.some((labelObj) => {
          const labelName = getLabelName(labelObj);
          const labelConfidence = getLabelConfidence(labelObj);
          return (
            labelName &&
            labelConfidence != null &&
            labelName.toLowerCase() === label.toLowerCase() &&
            labelConfidence >= minConfidence
          );
        });

        if (hasMatchingLabel && filteredImages.length < limit) {
          filteredImages.push(imageEntity);
        }
      }

      this.logger.log(`Found ${filteredImages.length} images with label: ${label}`);

      return {
        items: filteredImages.slice(0, limit),
        total: filteredImages.length,
        hasMore: filteredImages.length > limit,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to search images by label: ${errorMessage}`);
      throw new Error(`DynamoDB query failed: ${errorMessage}`);
    }
  }

  /**
   * Get all available labels with statistics
   */
  async getAllLabelsWithStats(limit: number = 50, minCount: number = 1): Promise<LabelStats[]> {
    try {
      this.logger.log(`Getting all labels with stats`);

      // Scan all processed images to aggregate label statistics
      const params: ScanCommandInput = {
        TableName: this.tableName,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'processed',
        },
        ProjectionExpression: 'labels',
      };

      const command = new ScanCommand(params);
      const response = await this.docClient.send(command);

      // Aggregate label statistics
      const labelMap = new Map<string, { count: number; totalConfidence: number }>();

      // Process all images and their labels
      (response.Items || []).forEach((item) => {
        const entity = item as ImageEntity;
        if (entity.labels) {
          entity.labels.forEach((label) => {
            const labelName = getLabelName(label);
            const labelConfidence = getLabelConfidence(label);

            if (labelName) {
              if (!labelMap.has(labelName)) {
                labelMap.set(labelName, { count: 0, totalConfidence: 0 });
              }
              const stats = labelMap.get(labelName);
              if (stats) {
                stats.count += 1;
                stats.totalConfidence += labelConfidence;
              }
            }
          });
        }
      });

      // Convert to LabelStats array
      const labelStats: LabelStats[] = Array.from(labelMap.entries())
        .filter(([, stats]) => stats.count >= minCount)
        .map(([name, stats]) => ({
          name,
          count: stats.count,
          averageConfidence: stats.totalConfidence / stats.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      this.logger.log(`Retrieved ${labelStats.length} labels`);

      return labelStats;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get labels with stats: ${errorMessage}`);
      throw new Error(`DynamoDB labels query failed: ${errorMessage}`);
    }
  }

  /**
   * Update image status
   */
  async updateImageStatus(imageId: string, status: ImageEntity['status'], labels?: Label[]): Promise<void> {
    try {
      this.logger.log(`Updating image status: ${imageId} -> ${status}`);

      const updateExpression = labels ? 'SET #status = :status, #labels = :labels' : 'SET #status = :status';

      const expressionAttributeValues: Record<string, string | Label[]> = {
        ':status': status,
      };

      const expressionAttributeNames: Record<string, string> = {
        '#status': 'status',
      };

      if (labels) {
        expressionAttributeValues[':labels'] = labels;
        expressionAttributeNames['#labels'] = 'labels';
      }

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          ImageId: imageId,
          CreatedAt: 'METADATA',
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      });

      await this.docClient.send(command);

      this.logger.log(`Image status updated successfully: ${imageId}`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to update image status: ${errorMessage}`);
      throw new Error(`DynamoDB update failed: ${errorMessage}`);
    }
  }

  /**
   * Delete image metadata
   */
  async deleteImageMetadata(imageId: string): Promise<void> {
    try {
      this.logger.log(`Deleting image metadata: ${imageId}`);

      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: {
          ImageId: imageId,
          CreatedAt: 'METADATA',
        },
      });

      await this.docClient.send(command);

      this.logger.log(`Image metadata deleted successfully: ${imageId}`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to delete image metadata: ${errorMessage}`);
      throw new Error(`DynamoDB delete failed: ${errorMessage}`);
    }
  }
}
