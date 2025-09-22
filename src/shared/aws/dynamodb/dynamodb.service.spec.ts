/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DynamoDBService, ImageEntity, getLabelName, getLabelConfidence, isRawLabel } from './dynamodb.service';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const mockSend = jest.fn();
const mockDocClient = { send: mockSend };

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  PutCommand: jest.fn((input: any) => ({ input })),
  GetCommand: jest.fn((input: any) => ({ input })),
  ScanCommand: jest.fn((input: any) => ({ input })),
  QueryCommand: jest.fn((input: any) => ({ input })),
  UpdateCommand: jest.fn((input: any) => ({ input })),
  DeleteCommand: jest.fn((input: any) => ({ input })),
}));

describe('DynamoDBService', () => {
  let service: DynamoDBService;
  let configService: jest.Mocked<ConfigService>;

  const mockImageEntity: ImageEntity = {
    ImageId: 'img_123456789',
    CreatedAt: 'METADATA',
    name: 'test-image.jpg',
    url: 'https://bucket.s3.amazonaws.com/images/img_123456789.jpg',
    s3Key: 'images/img_123456789.jpg',
    size: 1024000,
    mimeType: 'image/jpeg',
    uploadedAt: '2024-01-15T10:30:00.000Z',
    status: 'completed',
    labels: [
      { name: 'Car', confidence: 95.5 },
      { name: 'Vehicle', confidence: 87.2 },
    ],
    dimensions: { width: 1920, height: 1080 },
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    jest.clearAllMocks();

    (DynamoDBClient as jest.Mock).mockImplementation(() => ({}));
    (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue(mockDocClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [DynamoDBService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<DynamoDBService>(DynamoDBService);
    configService = module.get(ConfigService);

    configService.get.mockImplementation((key: string, defaultValue?: string) => {
      switch (key) {
        case 'AWS_DYNAMODB_TABLE_NAME':
          return 'image-recognition-dev-table';
        case 'AWS_REGION':
          return 'us-east-1';
        case 'AWS_ACCESS_KEY_ID':
          return 'test-access-key';
        case 'AWS_SECRET_ACCESS_KEY':
          return 'test-secret-key';
        default:
          return defaultValue;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Label utility functions', () => {
    it('should handle different label formats with getLabelName', () => {
      const apiLabel = { name: 'Car', confidence: 95 };
      const rawLabel = { Name: 'Car', Confidence: 95 };

      expect(getLabelName(apiLabel)).toBe('Car');
      expect(getLabelName(rawLabel)).toBe('Car');
    });

    it('should handle different label formats with getLabelConfidence', () => {
      const apiLabel = { name: 'Car', confidence: 95 };
      const rawLabel = { Name: 'Car', Confidence: 95 };

      expect(getLabelConfidence(apiLabel)).toBe(95);
      expect(getLabelConfidence(rawLabel)).toBe(95);
    });

    it('should correctly identify raw labels with isRawLabel', () => {
      const apiLabel = { name: 'Car', confidence: 95 };
      const rawLabel = { Name: 'Car', Confidence: 95 };

      expect(isRawLabel(apiLabel)).toBe(false);
      expect(isRawLabel(rawLabel)).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should initialize with environment configuration', () => {
      jest.clearAllMocks();

      const mockConfigWithCredentials = {
        get: jest.fn((key: string, defaultValue?: string) => {
          switch (key) {
            case 'AWS_DYNAMODB_TABLE_NAME':
              return 'image-recognition-dev-table';
            case 'AWS_REGION':
              return 'us-east-1';
            case 'AWS_ACCESS_KEY_ID':
              return 'test-access-key';
            case 'AWS_SECRET_ACCESS_KEY':
              return 'test-secret-key';
            default:
              return defaultValue;
          }
        }),
      };

      new DynamoDBService(mockConfigWithCredentials as unknown as ConfigService);

      expect(DynamoDBClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
      expect(DynamoDBDocumentClient.from).toHaveBeenCalled();
    });

    it('should use default values when config is not provided', () => {
      const mockConfigServiceEmpty = {
        get: jest.fn().mockReturnValue(undefined),
      };

      new DynamoDBService(mockConfigServiceEmpty as unknown as ConfigService);

      expect(DynamoDBClient).toHaveBeenCalledWith({
        region: 'us-east-1',
      });
    });

    it('should handle missing table name configuration', () => {
      const mockConfigWithoutTable = {
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'AWS_DYNAMODB_TABLE_NAME') {
            return undefined;
          }
          return defaultValue || 'default-value';
        }),
      };

      expect(() => {
        new DynamoDBService(mockConfigWithoutTable as unknown as ConfigService);
      }).not.toThrow();
    });

    it('should handle empty string configurations', () => {
      const mockConfigWithEmptyStrings = {
        get: jest.fn((key: string, defaultValue?: string) => {
          switch (key) {
            case 'AWS_ACCESS_KEY_ID':
              return '';
            case 'AWS_SECRET_ACCESS_KEY':
              return '';
            default:
              return defaultValue || 'default-value';
          }
        }),
      };

      new DynamoDBService(mockConfigWithEmptyStrings as unknown as ConfigService);

      expect(DynamoDBClient).toHaveBeenCalledWith({
        region: 'default-value',
      });
    });
  });

  describe('putImageMetadata', () => {
    it('should store image metadata successfully', async () => {
      mockDocClient.send.mockResolvedValue({});

      const partialImageData = {
        ImageId: 'test-id',
        name: 'test.jpg',
        url: 'https://example.com/test.jpg',
        s3Key: 'images/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      };

      await service.putImageMetadata(partialImageData);

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'image-recognition-dev-table',
            Item: expect.objectContaining({
              ImageId: 'test-id',
              CreatedAt: 'METADATA',
              name: 'test.jpg',
              url: 'https://example.com/test.jpg',
              s3Key: 'images/test.jpg',
              size: 1024,
              mimeType: 'image/jpeg',
              status: 'uploading',
              labels: [],
            }),
          }),
        }),
      );
    });

    it('should use provided values over defaults', async () => {
      mockDocClient.send.mockResolvedValue({});

      const customImageData = {
        ImageId: 'test-id',
        CreatedAt: 'CUSTOM',
        name: 'test.jpg',
        url: 'https://example.com/test.jpg',
        s3Key: 'images/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: '2024-01-01T00:00:00.000Z',
        status: 'processing' as const,
        labels: [{ name: 'Test', confidence: 90 }],
      };

      await service.putImageMetadata(customImageData);

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Item: expect.objectContaining({
              CreatedAt: 'CUSTOM',
              uploadedAt: '2024-01-01T00:00:00.000Z',
              status: 'processing',
              labels: [{ name: 'Test', confidence: 90 }],
            }),
          }),
        }),
      );
    });

    it('should handle different types of DynamoDB errors', async () => {
      const conditionalError = {
        name: 'ConditionalCheckFailedException',
        message: 'Condition check failed',
      };
      mockDocClient.send.mockRejectedValueOnce(conditionalError);

      await expect(service.putImageMetadata({ ImageId: 'test-id' })).rejects.toThrow();

      const throughputError = {
        name: 'ProvisionedThroughputExceededException',
        message: 'Throughput exceeded',
      };
      mockDocClient.send.mockRejectedValueOnce(throughputError);

      await expect(service.putImageMetadata({ ImageId: 'test-id' })).rejects.toThrow();

      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationException';
      mockDocClient.send.mockRejectedValueOnce(validationError);

      await expect(service.putImageMetadata({ ImageId: '' })).rejects.toThrow();
    });

    it('should handle network connectivity issues', async () => {
      const networkError = new Error('ENOTFOUND');
      networkError.name = 'NetworkingError';
      mockDocClient.send.mockRejectedValue(networkError);

      await expect(service.putImageMetadata({ ImageId: 'test-id' })).rejects.toThrow('DynamoDB put failed: ENOTFOUND');
    });
  });

  describe('getImageMetadata', () => {
    it('should retrieve image metadata successfully', async () => {
      mockDocClient.send.mockResolvedValue({
        Item: mockImageEntity,
      });

      const result = await service.getImageMetadata('img_123456789');

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'image-recognition-dev-table',
            Key: {
              ImageId: 'img_123456789',
              CreatedAt: 'METADATA',
            },
          }),
        }),
      );

      expect(result).toEqual(mockImageEntity);
    });

    it('should return null when image not found', async () => {
      mockDocClient.send.mockResolvedValue({
        Item: undefined,
      });

      const result = await service.getImageMetadata('non-existent');

      expect(result).toBeNull();
    });

    it('should handle empty response from DynamoDB', async () => {
      mockDocClient.send.mockResolvedValue({});

      const result = await service.getImageMetadata('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle different types of DynamoDB errors', async () => {
      const resourceError = {
        name: 'ResourceNotFoundException',
        message: 'Table not found',
      };
      mockDocClient.send.mockRejectedValueOnce(resourceError);

      await expect(service.getImageMetadata('test-id')).rejects.toThrow();

      const permissionError = { name: 'AccessDeniedException', message: 'Access denied' };
      mockDocClient.send.mockRejectedValueOnce(permissionError);

      await expect(service.getImageMetadata('test-id')).rejects.toThrow();

      const throttleError = new Error('Throttling exception');
      throttleError.name = 'ThrottlingException';
      mockDocClient.send.mockRejectedValueOnce(throttleError);

      await expect(service.getImageMetadata('test-id')).rejects.toThrow('DynamoDB get failed: Throttling exception');
    });

    it('should handle extremely long image IDs', async () => {
      const longId = 'a'.repeat(1000);
      mockDocClient.send.mockResolvedValue({ Item: null });

      const result = await service.getImageMetadata(longId);
      expect(result).toBeNull();
    });
  });

  describe('getAllImages', () => {
    it('should get all images with pagination', async () => {
      const mockItems = [mockImageEntity, { ...mockImageEntity, ImageId: 'img_987654321' }];

      mockDocClient.send.mockResolvedValue({
        Items: mockItems,
        LastEvaluatedKey: { ImageId: 'img_987654321', CreatedAt: 'METADATA' },
      });

      const result = await service.getAllImages(1, 10);

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'image-recognition-dev-table',
            FilterExpression: 'CreatedAt = :metadata',
            ExpressionAttributeValues: {
              ':metadata': 'METADATA',
            },
            Limit: 10,
          }),
        }),
      );

      expect(result).toEqual({
        items: expect.arrayContaining([
          expect.objectContaining({ ImageId: 'img_123456789' }),
          expect.objectContaining({ ImageId: 'img_987654321' }),
        ]),
        total: 2,
        hasMore: true,
      });
    });

    it('should handle empty results', async () => {
      mockDocClient.send.mockResolvedValue({
        Items: [],
      });

      const result = await service.getAllImages(1, 10);

      expect(result).toEqual({
        items: [],
        total: 0,
        hasMore: false,
      });
    });

    it('should handle items with different field formats', async () => {
      const itemWithLambdaFields = {
        ImageId: 'img_lambda',
        CreatedAt: 'METADATA',
        FileName: 'lambda-image.jpg',
        FileSize: 2048000,
        S3Key: 'lambda/image.jpg',
        Status: 'completed',
        Labels: [{ Name: 'Car', Confidence: 90 }],
        ProcessedAt: '2024-01-15T12:00:00.000Z',
      };

      mockDocClient.send.mockResolvedValue({
        Items: [itemWithLambdaFields],
      });

      const result = await service.getAllImages(1, 10);

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          ImageId: 'img_lambda',
          name: 'lambda-image.jpg',
          size: 2048000,
          s3Key: 'lambda/image.jpg',
          status: 'completed',
          uploadedAt: '2024-01-15T12:00:00.000Z',
        }),
      );
    });

    it('should handle items with partial Lambda format fields', async () => {
      const partialLambdaItem = {
        ImageId: 'img_partial',
        CreatedAt: 'METADATA',
        FileName: 'partial.jpg',
      };

      mockDocClient.send.mockResolvedValue({
        Items: [partialLambdaItem],
      });

      const result = await service.getAllImages(1, 10);

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          ImageId: 'img_partial',
          name: 'partial.jpg',
          size: 0,
          status: 'uploading',
        }),
      );
    });

    it('should handle items with mixed field naming conventions', async () => {
      const mixedFormatItem = {
        ImageId: 'img_mixed',
        CreatedAt: 'METADATA',
        name: 'api-format.jpg',
        FileSize: 5000,
        url: 'https://example.com/api-format.jpg',
        Status: 'processing',
      };

      mockDocClient.send.mockResolvedValue({
        Items: [mixedFormatItem],
      });

      const result = await service.getAllImages(1, 10);

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          name: 'api-format.jpg',
          size: 5000,
          status: 'processing',
        }),
      );
    });

    it('should handle items with null or undefined values', async () => {
      const itemWithNulls = {
        ImageId: 'img_nulls',
        CreatedAt: 'METADATA',
        name: null,
        size: undefined,
        labels: null,
      };

      mockDocClient.send.mockResolvedValue({
        Items: [itemWithNulls],
      });

      const result = await service.getAllImages(1, 1);

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          ImageId: 'img_nulls',
          name: '',
          size: 0,
          labels: [],
        }),
      );
    });

    it('should handle size field with proper type conversion', async () => {
      const itemWithStringSize = {
        ImageId: 'img_string_size',
        CreatedAt: 'METADATA',
        size: '12345',
      };

      const itemWithInvalidSize = {
        ImageId: 'img_invalid_size',
        CreatedAt: 'METADATA',
        size: 'invalid',
      };

      const itemWithFileSize = {
        ImageId: 'img_file_size',
        CreatedAt: 'METADATA',
        FileSize: '67890',
      };

      mockDocClient.send.mockResolvedValue({
        Items: [itemWithStringSize, itemWithInvalidSize, itemWithFileSize],
      });

      const result = await service.getAllImages(1, 10);

      expect(result.items[0].size).toBe(12345);
      expect(result.items[1].size).toBe(0);
      expect(result.items[2].size).toBe(67890);
    });

    it('should handle malformed data gracefully', async () => {
      const malformedItem = {
        ImageId: 'malformed',
      };

      mockDocClient.send.mockResolvedValue({
        Items: [malformedItem],
      });

      const result = await service.getAllImages(1, 1);

      expect(result.items).toBeDefined();
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          ImageId: 'malformed',
          name: '',
          url: '',
          size: 0,
          status: 'uploading',
        }),
      );
    });

    it('should handle pagination beyond available items', async () => {
      mockDocClient.send.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const result = await service.getAllImages(999, 10);

      expect(result).toEqual({
        items: [],
        total: 0,
        hasMore: false,
      });
    });

    it('should handle DynamoDB scan errors', async () => {
      const error = new Error('DynamoDB scan failed');
      mockDocClient.send.mockRejectedValue(error);

      await expect(service.getAllImages(1, 10)).rejects.toThrow('DynamoDB scan failed: DynamoDB scan failed');
    });
  });

  describe('queryImagesByLabel', () => {
    it('should search images by label', async () => {
      const mockQueryResponse = {
        Items: [mockImageEntity],
      };

      const mockScanResponse = {
        Items: [{ ...mockImageEntity, ImageId: 'img_another' }],
      };

      mockDocClient.send.mockResolvedValueOnce(mockQueryResponse).mockResolvedValueOnce(mockScanResponse);

      const result = await service.queryImagesByLabel('Car', 80, 10);

      expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ ImageId: 'img_123456789' })]));
    });

    it('should handle search with different confidence levels', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [mockImageEntity] });

      const result = await service.queryImagesByLabel('Car', 95, 10);

      expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ ImageId: 'img_123456789' })]));
    });

    it('should handle zero confidence threshold', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [mockImageEntity] });

      const result = await service.queryImagesByLabel('Car', 0, 10);

      expect(mockDocClient.send).toHaveBeenCalled();
      expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ ImageId: 'img_123456789' })]));
    });

    it('should handle very high confidence threshold', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [mockImageEntity] });

      const result = await service.queryImagesByLabel('Car', 99.9, 10);

      expect(result.items).toHaveLength(0);
    });

    it('should handle empty search results', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [] });

      const result = await service.queryImagesByLabel('non-existent-label', 80, 10);
      expect(result.items).toEqual([]);
    });

    it('should handle special characters in label names', async () => {
      const specialLabel = 'test-label!@#$%^&*()';
      mockDocClient.send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [] });

      const result = await service.queryImagesByLabel(specialLabel, 80, 10);
      expect(result.items).toEqual([]);
    });

    it('should handle case-insensitive label matching', async () => {
      const imageWithUppercaseLabel = {
        ...mockImageEntity,
        labels: [{ name: 'CAR', confidence: 95 }],
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({ Items: [imageWithUppercaseLabel] });

      const result = await service.queryImagesByLabel('car', 80, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].ImageId).toBe('img_123456789');
    });

    it('should handle labels with mixed formats', async () => {
      const imageWithRawLabels = {
        ...mockImageEntity,
        labels: [{ Name: 'Car', Confidence: 95.5 }],
      };

      mockDocClient.send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [imageWithRawLabels] });

      const result = await service.queryImagesByLabel('Car', 80, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].ImageId).toBe('img_123456789');
    });

    it('should handle DynamoDB query errors', async () => {
      const error = new Error('DynamoDB query failed');
      mockDocClient.send.mockRejectedValue(error);

      await expect(service.queryImagesByLabel('Car', 80, 10)).rejects.toThrow(
        'DynamoDB query failed: DynamoDB query failed',
      );
    });

    it('should handle duplicate items from query and scan', async () => {
      const duplicateItem = { ...mockImageEntity };

      mockDocClient.send
        .mockResolvedValueOnce({ Items: [duplicateItem] })
        .mockResolvedValueOnce({ Items: [duplicateItem] });

      const result = await service.queryImagesByLabel('Car', 80, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].ImageId).toBe('img_123456789');
    });
  });

  describe('getAllLabelsWithStats', () => {
    it('should get label statistics', async () => {
      const mockItems = [
        { ...mockImageEntity, labels: [{ name: 'Car', confidence: 95 }] },
        { ...mockImageEntity, ImageId: 'img_2', labels: [{ name: 'Car', confidence: 90 }] },
        { ...mockImageEntity, ImageId: 'img_3', labels: [{ name: 'Tree', confidence: 85 }] },
      ];

      mockDocClient.send.mockResolvedValue({
        Items: mockItems,
      });

      const result = await service.getAllLabelsWithStats(50, 1);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Car',
            count: 2,
            averageConfidence: 92.5,
          }),
          expect.objectContaining({
            name: 'Tree',
            count: 1,
            averageConfidence: 85,
          }),
        ]),
      );
    });

    it('should filter labels by minimum count', async () => {
      const mockItems = [
        { ...mockImageEntity, labels: [{ name: 'Car', confidence: 95 }] },
        { ...mockImageEntity, ImageId: 'img_2', labels: [{ name: 'Tree', confidence: 85 }] },
      ];

      mockDocClient.send.mockResolvedValue({
        Items: mockItems,
      });

      const result = await service.getAllLabelsWithStats(50, 2);

      expect(result).toHaveLength(0);
    });

    it('should handle mixed label formats', async () => {
      const mockItems = [
        { ...mockImageEntity, labels: [{ name: 'Car', confidence: 95 }] },
        { ...mockImageEntity, ImageId: 'img_2', labels: [{ Name: 'Car', Confidence: 90 }] },
      ];

      mockDocClient.send.mockResolvedValue({
        Items: mockItems,
      });

      const result = await service.getAllLabelsWithStats(50, 1);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Car',
            count: 2,
            averageConfidence: 92.5,
          }),
        ]),
      );
    });

    it('should handle empty label collection', async () => {
      mockDocClient.send.mockResolvedValue({
        Items: [],
      });

      const result = await service.getAllLabelsWithStats(50, 1);
      expect(result).toEqual([]);
    });

    it('should handle items without labels', async () => {
      const mockItems = [
        { ...mockImageEntity, labels: undefined },
        { ...mockImageEntity, ImageId: 'img_2', labels: [] },
        { ...mockImageEntity, ImageId: 'img_3', labels: [{ name: 'Tree', confidence: 85 }] },
      ];

      mockDocClient.send.mockResolvedValue({
        Items: mockItems,
      });

      const result = await service.getAllLabelsWithStats(50, 1);

      expect(result).toEqual([
        expect.objectContaining({
          name: 'Tree',
          count: 1,
          averageConfidence: 85,
        }),
      ]);
    });

    it('should sort labels by count in descending order', async () => {
      const mockItems = [
        { ...mockImageEntity, labels: [{ name: 'Car', confidence: 95 }] },
        { ...mockImageEntity, ImageId: 'img_2', labels: [{ name: 'Tree', confidence: 85 }] },
        { ...mockImageEntity, ImageId: 'img_3', labels: [{ name: 'Tree', confidence: 90 }] },
        { ...mockImageEntity, ImageId: 'img_4', labels: [{ name: 'Tree', confidence: 80 }] },
      ];

      mockDocClient.send.mockResolvedValue({
        Items: mockItems,
      });

      const result = await service.getAllLabelsWithStats(50, 1);

      expect(result[0].name).toBe('Tree');
      expect(result[0].count).toBe(3);
      expect(result[1].name).toBe('Car');
      expect(result[1].count).toBe(1);
    });

    it('should respect the limit parameter', async () => {
      const mockItems = Array.from({ length: 20 }, (_, i) => ({
        ...mockImageEntity,
        ImageId: `img_${i}`,
        labels: [{ name: `Label${i}`, confidence: 85 }],
      }));

      mockDocClient.send.mockResolvedValue({
        Items: mockItems,
      });

      const result = await service.getAllLabelsWithStats(5, 1);

      expect(result).toHaveLength(5);
    });

    it('should handle DynamoDB scan errors', async () => {
      const error = new Error('DynamoDB scan failed');
      mockDocClient.send.mockRejectedValue(error);

      await expect(service.getAllLabelsWithStats(50, 1)).rejects.toThrow(
        'DynamoDB labels query failed: DynamoDB scan failed',
      );
    });
  });

  describe('updateImageStatus', () => {
    it('should update image status without labels', async () => {
      mockDocClient.send.mockResolvedValue({});

      await service.updateImageStatus('img_123456789', 'completed');

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'image-recognition-dev-table',
            Key: {
              ImageId: 'img_123456789',
              CreatedAt: 'METADATA',
            },
            UpdateExpression: 'SET #status = :status',
            ExpressionAttributeValues: {
              ':status': 'completed',
            },
            ExpressionAttributeNames: {
              '#status': 'status',
            },
          }),
        }),
      );
    });

    it('should update image status with labels', async () => {
      mockDocClient.send.mockResolvedValue({});

      const labels = [{ name: 'Car', confidence: 95 }];
      await service.updateImageStatus('img_123456789', 'completed', labels);

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            UpdateExpression: 'SET #status = :status, #labels = :labels',
            ExpressionAttributeValues: {
              ':status': 'completed',
              ':labels': labels,
            },
            ExpressionAttributeNames: {
              '#status': 'status',
              '#labels': 'labels',
            },
          }),
        }),
      );
    });

    it('should handle updating with complex label objects', async () => {
      mockDocClient.send.mockResolvedValue({});

      const complexLabels = [
        { name: 'Car', confidence: 95.5, boundingBox: { x: 10, y: 20, width: 100, height: 50 } },
        { name: 'Vehicle', confidence: 87.2, categories: ['transport', 'automobile'] },
      ];

      await service.updateImageStatus('img_123456789', 'completed', complexLabels);

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ExpressionAttributeValues: {
              ':status': 'completed',
              ':labels': complexLabels,
            },
          }),
        }),
      );
    });

    it('should handle updating with empty labels array', async () => {
      mockDocClient.send.mockResolvedValue({});

      await service.updateImageStatus('img_123456789', 'failed', []);

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ExpressionAttributeValues: {
              ':status': 'failed',
              ':labels': [],
            },
          }),
        }),
      );
    });

    it('should handle DynamoDB update errors', async () => {
      const error = new Error('DynamoDB update failed');
      mockDocClient.send.mockRejectedValue(error);

      await expect(service.updateImageStatus('img_123456789', 'failed')).rejects.toThrow(
        'DynamoDB update failed: DynamoDB update failed',
      );
    });

    it('should handle access denied errors', async () => {
      const permissionError = new Error('Access denied');
      permissionError.name = 'AccessDeniedException';
      mockDocClient.send.mockRejectedValue(permissionError);

      await expect(service.updateImageStatus('img_123456789', 'failed')).rejects.toThrow(
        'DynamoDB update failed: Access denied',
      );
    });

    it('should handle different status values', async () => {
      mockDocClient.send.mockResolvedValue({});

      const statusValues: Array<ImageEntity['status']> = ['uploading', 'processing', 'completed', 'failed'];

      for (const status of statusValues) {
        await service.updateImageStatus('img_test', status);

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              ExpressionAttributeValues: expect.objectContaining({
                ':status': status,
              }),
            }),
          }),
        );
      }
    });
  });

  describe('deleteImageMetadata', () => {
    it('should delete image metadata successfully', async () => {
      mockDocClient.send.mockResolvedValue({});

      await service.deleteImageMetadata('img_123456789');

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'image-recognition-dev-table',
            Key: {
              ImageId: 'img_123456789',
              CreatedAt: 'METADATA',
            },
          }),
        }),
      );
    });

    it('should handle DynamoDB delete errors', async () => {
      const error = new Error('DynamoDB delete failed');
      mockDocClient.send.mockRejectedValue(error);

      await expect(service.deleteImageMetadata('img_123456789')).rejects.toThrow(
        'DynamoDB delete failed: DynamoDB delete failed',
      );
    });

    it('should handle deletion of non-existent items', async () => {
      mockDocClient.send.mockResolvedValue({
        Attributes: undefined,
      });

      const result = await service.deleteImageMetadata('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('should handle access denied errors for deletion', async () => {
      const permissionError = new Error('Access denied');
      permissionError.name = 'AccessDeniedException';
      mockDocClient.send.mockRejectedValue(permissionError);

      await expect(service.deleteImageMetadata('img_123456789')).rejects.toThrow(
        'DynamoDB delete failed: Access denied',
      );
    });

    it('should handle resource not found errors', async () => {
      const resourceError = new Error('Resource not found');
      resourceError.name = 'ResourceNotFoundException';
      mockDocClient.send.mockRejectedValue(resourceError);

      await expect(service.deleteImageMetadata('img_123456789')).rejects.toThrow(
        'DynamoDB delete failed: Resource not found',
      );
    });
  });

  describe('error handling and resilience', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = { code: 'ENOTFOUND', message: 'Network error' };
      mockDocClient.send.mockRejectedValue(networkError);

      await expect(service.getImageMetadata('test-id')).rejects.toThrow('DynamoDB get failed:');
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service unavailable');
      serviceError.name = 'ServiceUnavailableException';
      mockDocClient.send.mockRejectedValue(serviceError);

      await expect(service.getImageMetadata('test-id')).rejects.toThrow('DynamoDB get failed: Service unavailable');
    });

    it('should handle AWS credential errors during initialization', () => {
      const mockConfigWithInvalidCredentials = {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'AWS_ACCESS_KEY_ID':
              return 'invalid-key';
            case 'AWS_SECRET_ACCESS_KEY':
              return 'invalid-secret';
            case 'AWS_REGION':
              return 'invalid-region';
            default:
              return undefined;
          }
        }),
      };

      expect(() => {
        new DynamoDBService(mockConfigWithInvalidCredentials as unknown as ConfigService);
      }).not.toThrow();
    });
  });
});
