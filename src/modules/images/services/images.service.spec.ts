/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Readable } from 'stream';
import { ImagesService } from './images.service';
import { S3Service } from '../../../shared/aws/s3/s3.service';
import { DynamoDBService, ImageEntity } from '../../../shared/aws/dynamodb/dynamodb.service';
import { UploadImageDto } from '../dto/upload-image.dto';
import { GetAllImagesDto } from '../dto/get-all-images.dto';
import { SearchImagesDto } from '../dto/search-images.dto';

describe('ImagesService', () => {
  let service: ImagesService;
  let s3Service: jest.Mocked<S3Service>;
  let dynamoService: jest.Mocked<DynamoDBService>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-data'),
    size: 1024000,
    destination: '',
    filename: '',
    path: '',
    stream: undefined,
  };

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
    const mockS3Service = {
      validateImage: jest.fn(),
      uploadImage: jest.fn(),
      imageExists: jest.fn(),
      getImageUrl: jest.fn(),
      getImageStream: jest.fn(),
      deleteImage: jest.fn(),
    };

    const mockDynamoService = {
      putImageMetadata: jest.fn(),
      getImageMetadata: jest.fn(),
      getAllImages: jest.fn(),
      queryImagesByLabel: jest.fn(),
      getAllLabelsWithStats: jest.fn(),
      deleteImageMetadata: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: S3Service, useValue: mockS3Service },
        { provide: DynamoDBService, useValue: mockDynamoService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ImagesService>(ImagesService);
    s3Service = module.get(S3Service);
    dynamoService = module.get(DynamoDBService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadImage', () => {
    const uploadDto: UploadImageDto = {
      description: 'Test image upload',
    };

    it('should upload image successfully', async () => {
      const uploadResult = {
        key: 'images/img_123456789.jpg',
        url: 'https://bucket.s3.amazonaws.com/images/img_123456789.jpg',
        bucket: 'test-bucket',
      };

      s3Service.validateImage.mockReturnValue(undefined);
      s3Service.uploadImage.mockResolvedValue(uploadResult);
      dynamoService.putImageMetadata.mockResolvedValue(undefined);

      const result = await service.uploadImage(mockFile, uploadDto);

      expect(s3Service.validateImage).toHaveBeenCalledWith(mockFile);
      expect(s3Service.uploadImage).toHaveBeenCalledWith(mockFile, expect.stringMatching(/^img_\d+$/) as string);
      expect(dynamoService.putImageMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-image.jpg',
          url: uploadResult.url,
          s3Key: uploadResult.key,
          size: 1024000,
          mimeType: 'image/jpeg',
          status: 'uploading',
          labels: [],
          description: 'Test image upload',
        }),
      );

      expect(result).toMatchObject({
        imageId: expect.stringMatching(/^img_\d+$/) as string,
        imageUrl: uploadResult.url,
        uploadedAt: expect.any(String) as string,
        message: 'Image uploaded successfully. Recognition process started.',
      });
    });

    it('should throw BadRequestException when no file provided', async () => {
      await expect(service.uploadImage(null as unknown as Express.Multer.File, uploadDto)).rejects.toThrow(
        new BadRequestException('No file provided'),
      );
    });

    it('should handle S3 validation errors', async () => {
      s3Service.validateImage.mockImplementation(() => {
        throw new BadRequestException('Invalid file type');
      });

      await expect(service.uploadImage(mockFile, uploadDto)).rejects.toThrow(
        new BadRequestException('Invalid file type'),
      );

      expect(s3Service.uploadImage).not.toHaveBeenCalled();
      expect(dynamoService.putImageMetadata).not.toHaveBeenCalled();
    });

    it('should handle S3 upload errors', async () => {
      s3Service.validateImage.mockReturnValue(undefined);
      s3Service.uploadImage.mockRejectedValue(new Error('S3 upload failed'));

      await expect(service.uploadImage(mockFile, uploadDto)).rejects.toThrow(
        new BadRequestException('Image upload failed: S3 upload failed'),
      );

      expect(dynamoService.putImageMetadata).not.toHaveBeenCalled();
    });

    it('should handle DynamoDB errors', async () => {
      const uploadResult = {
        key: 'images/img_123456789.jpg',
        url: 'https://bucket.s3.amazonaws.com/images/img_123456789.jpg',
        bucket: 'test-bucket',
      };

      s3Service.validateImage.mockReturnValue(undefined);
      s3Service.uploadImage.mockResolvedValue(uploadResult);
      dynamoService.putImageMetadata.mockRejectedValue(new Error('DynamoDB error'));

      await expect(service.uploadImage(mockFile, uploadDto)).rejects.toThrow(
        new BadRequestException('Image upload failed: DynamoDB error'),
      );
    });
  });

  describe('getAllImages', () => {
    it('should get all images with default pagination', async () => {
      const query: GetAllImagesDto = {};
      const mockResult = {
        items: [mockImageEntity],
        total: 1,
        hasMore: false,
      };

      dynamoService.getAllImages.mockResolvedValue(mockResult);

      const result = await service.getAllImages(query);

      expect(dynamoService.getAllImages).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual({
        images: [
          {
            id: 'img_123456789',
            name: 'test-image.jpg',
            url: 'https://bucket.s3.amazonaws.com/images/img_123456789.jpg',
            labels: [
              { name: 'Car', confidence: 95.5 },
              { name: 'Vehicle', confidence: 87.2 },
            ],
            uploadedAt: '2024-01-15T10:30:00.000Z',
            size: 1024000,
            mimeType: 'image/jpeg',
            status: 'completed',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          hasMore: false,
        },
      });
    });

    it('should handle custom pagination parameters', async () => {
      const query: GetAllImagesDto = { page: 2, limit: 5 };
      const mockResult = {
        items: [],
        total: 0,
        hasMore: true,
      };

      dynamoService.getAllImages.mockResolvedValue(mockResult);

      const result = await service.getAllImages(query);

      expect(dynamoService.getAllImages).toHaveBeenCalledWith(2, 5);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        hasMore: true,
      });
    });

    it('should enforce pagination limits', async () => {
      const query: GetAllImagesDto = { page: 0, limit: 200 };
      dynamoService.getAllImages.mockResolvedValue({ items: [], total: 0, hasMore: false });

      await service.getAllImages(query);

      expect(dynamoService.getAllImages).toHaveBeenCalledWith(1, 100);
    });

    it('should handle DynamoDB errors', async () => {
      const query: GetAllImagesDto = {};
      dynamoService.getAllImages.mockRejectedValue(new Error('DynamoDB error'));

      await expect(service.getAllImages(query)).rejects.toThrow(
        new BadRequestException('Failed to retrieve images: DynamoDB error'),
      );
    });
  });

  describe('getImageById', () => {
    it('should get image by ID successfully', async () => {
      dynamoService.getImageMetadata.mockResolvedValue(mockImageEntity);

      const result = await service.getImageById('img_123456789');

      expect(dynamoService.getImageMetadata).toHaveBeenCalledWith('img_123456789');
      expect(result).toEqual({
        id: 'img_123456789',
        name: 'test-image.jpg',
        url: 'https://bucket.s3.amazonaws.com/images/img_123456789.jpg',
        labels: [
          { name: 'Car', confidence: 95.5 },
          { name: 'Vehicle', confidence: 87.2 },
        ],
        uploadedAt: '2024-01-15T10:30:00.000Z',
        size: 1024000,
        mimeType: 'image/jpeg',
        status: 'completed',
      });
    });

    it('should throw NotFoundException when image not found', async () => {
      dynamoService.getImageMetadata.mockResolvedValue(null);

      await expect(service.getImageById('non-existent')).rejects.toThrow(
        new NotFoundException("Image with ID 'non-existent' not found"),
      );
    });

    it('should handle DynamoDB errors', async () => {
      dynamoService.getImageMetadata.mockRejectedValue(new Error('DynamoDB error'));

      await expect(service.getImageById('img_123456789')).rejects.toThrow(
        new BadRequestException('Failed to get image: DynamoDB error'),
      );
    });
  });

  describe('getImageFile', () => {
    it('should stream image file successfully', async () => {
      const mockImageData: ImageEntity = {
        ImageId: 'test-id',
        CreatedAt: 'METADATA',
        name: 'test.png',
        url: 'https://bucket.s3.amazonaws.com/images/test.png',
        s3Key: 'images/test.png',
        size: 1024,
        mimeType: 'image/png',
        uploadedAt: new Date().toISOString(),
        status: 'completed',
        labels: [],
        dimensions: { width: 100, height: 100 },
      };

      const mockStream = new Readable({
        read() {
          this.push('image data');
          this.push(null);
        },
      });

      const mockS3Response = {
        stream: mockStream,
        contentType: 'image/png',
        contentLength: 1024,
      };

      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn().mockReturnValue(true),
        end: jest.fn(),
        once: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
      } as unknown as Response;

      dynamoService.getImageMetadata.mockResolvedValue(mockImageData);
      s3Service.imageExists.mockResolvedValue(true);
      s3Service.getImageStream.mockResolvedValue(mockS3Response);

      await service.getImageFile('test-id', mockResponse);

      expect(dynamoService.getImageMetadata).toHaveBeenCalledWith('test-id');
      expect(s3Service.imageExists).toHaveBeenCalledWith('images/test.png');
      expect(s3Service.getImageStream).toHaveBeenCalledWith('images/test.png');
      expect(mockResponse.setHeader as jest.Mock).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(mockResponse.setHeader as jest.Mock).toHaveBeenCalledWith('Content-Length', 1024);
      expect(mockResponse.setHeader as jest.Mock).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
      expect(mockResponse.setHeader as jest.Mock).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="test.png"',
      );
    });

    it('should throw NotFoundException when image metadata not found', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      dynamoService.getImageMetadata.mockResolvedValue(null);

      await expect(service.getImageFile('non-existent', mockResponse)).rejects.toThrow(
        new NotFoundException("Image with ID 'non-existent' not found"),
      );
    });

    it('should throw NotFoundException when image file not found in S3', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      dynamoService.getImageMetadata.mockResolvedValue(mockImageEntity);
      s3Service.imageExists.mockResolvedValue(false);

      await expect(service.getImageFile('img_123456789', mockResponse)).rejects.toThrow(
        new NotFoundException('Image file not found in storage'),
      );
    });
  });

  describe('searchImagesByLabel', () => {
    it('should search images by label successfully', async () => {
      const searchDto: SearchImagesDto = {
        label: 'Car',
        confidence: 90,
        page: 1,
        limit: 10,
      };

      const mockResult = {
        items: [mockImageEntity],
        total: 1,
        hasMore: false,
      };

      dynamoService.queryImagesByLabel.mockResolvedValue(mockResult);

      const result = await service.searchImagesByLabel(searchDto);

      expect(dynamoService.queryImagesByLabel).toHaveBeenCalledWith('Car', 90, 10);
      expect(result).toEqual({
        images: [
          expect.objectContaining({
            id: 'img_123456789',
            matchingLabel: { name: 'Car', confidence: 95.5 },
          }),
        ],
        searchCriteria: {
          label: 'Car',
          confidence: 90,
        },
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      });
    });

    it('should use default values for optional parameters', async () => {
      const searchDto: SearchImagesDto = { label: 'Car' };
      dynamoService.queryImagesByLabel.mockResolvedValue({ items: [], total: 0, hasMore: false });

      const result = await service.searchImagesByLabel(searchDto);

      expect(dynamoService.queryImagesByLabel).toHaveBeenCalledWith('Car', undefined, undefined);
      expect(result.searchCriteria.confidence).toBe(80);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should handle DynamoDB errors', async () => {
      const searchDto: SearchImagesDto = { label: 'Car' };
      dynamoService.queryImagesByLabel.mockRejectedValue(new Error('DynamoDB error'));

      await expect(service.searchImagesByLabel(searchDto)).rejects.toThrow(
        new BadRequestException('Search failed: DynamoDB error'),
      );
    });
  });

  describe('getAllLabels', () => {
    it('should get all labels with default parameters', async () => {
      const mockLabelStats = [
        { name: 'Car', count: 5, averageConfidence: 92.5 },
        { name: 'Vehicle', count: 3, averageConfidence: 88.7 },
      ];

      dynamoService.getAllLabelsWithStats.mockResolvedValue(mockLabelStats);

      const result = await service.getAllLabels({});

      expect(dynamoService.getAllLabelsWithStats).toHaveBeenCalledWith(50, 1);
      expect(result).toEqual({
        labels: mockLabelStats,
        total: 2,
      });
    });

    it('should handle custom parameters', async () => {
      const query = { limit: 20, minCount: 5 };
      dynamoService.getAllLabelsWithStats.mockResolvedValue([]);

      await service.getAllLabels(query);

      expect(dynamoService.getAllLabelsWithStats).toHaveBeenCalledWith(20, 5);
    });

    it('should handle DynamoDB errors', async () => {
      dynamoService.getAllLabelsWithStats.mockRejectedValue(new Error('DynamoDB error'));

      await expect(service.getAllLabels({})).rejects.toThrow(
        new BadRequestException('Failed to get labels: DynamoDB error'),
      );
    });
  });

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      dynamoService.getImageMetadata.mockResolvedValue(mockImageEntity);
      s3Service.deleteImage.mockResolvedValue(undefined);
      dynamoService.deleteImageMetadata.mockResolvedValue(undefined);

      const result = await service.deleteImage('img_123456789');

      expect(dynamoService.getImageMetadata).toHaveBeenCalledWith('img_123456789');
      expect(s3Service.deleteImage).toHaveBeenCalledWith('images/img_123456789.jpg');
      expect(dynamoService.deleteImageMetadata).toHaveBeenCalledWith('img_123456789');
      expect(result).toEqual({
        message: 'Image img_123456789 deleted successfully',
      });
    });

    it('should throw NotFoundException when image not found', async () => {
      dynamoService.getImageMetadata.mockResolvedValue(null);

      await expect(service.deleteImage('non-existent')).rejects.toThrow(
        new NotFoundException("Image with ID 'non-existent' not found"),
      );

      expect(s3Service.deleteImage).not.toHaveBeenCalled();
      expect(dynamoService.deleteImageMetadata).not.toHaveBeenCalled();
    });

    it('should handle S3 deletion errors', async () => {
      dynamoService.getImageMetadata.mockResolvedValue(mockImageEntity);
      s3Service.deleteImage.mockRejectedValue(new Error('S3 delete failed'));

      await expect(service.deleteImage('img_123456789')).rejects.toThrow(
        new BadRequestException('Failed to delete image: S3 delete failed'),
      );

      expect(dynamoService.deleteImageMetadata).not.toHaveBeenCalled();
    });

    it('should handle DynamoDB deletion errors', async () => {
      dynamoService.getImageMetadata.mockResolvedValue(mockImageEntity);
      s3Service.deleteImage.mockResolvedValue(undefined);
      dynamoService.deleteImageMetadata.mockRejectedValue(new Error('DynamoDB delete failed'));

      await expect(service.deleteImage('img_123456789')).rejects.toThrow(
        new BadRequestException('Failed to delete image: DynamoDB delete failed'),
      );
    });
  });

  describe('mapToImageResponse', () => {
    it('should map ImageEntity to ImageResponseDto correctly', async () => {
      dynamoService.getImageMetadata.mockResolvedValue(mockImageEntity);

      const result = await service.getImageById('img_123456789');

      expect(result).toEqual({
        id: 'img_123456789',
        name: 'test-image.jpg',
        url: 'https://bucket.s3.amazonaws.com/images/img_123456789.jpg',
        labels: [
          { name: 'Car', confidence: 95.5 },
          { name: 'Vehicle', confidence: 87.2 },
        ],
        uploadedAt: '2024-01-15T10:30:00.000Z',
        size: 1024000,
        mimeType: 'image/jpeg',
        status: 'completed',
      });
    });

    it('should handle entity with no labels', async () => {
      const entityWithoutLabels = { ...mockImageEntity, labels: undefined };
      dynamoService.getImageMetadata.mockResolvedValue(entityWithoutLabels);

      const result = await service.getImageById('img_123456789');

      expect(result.labels).toEqual([]);
    });
  });
});
