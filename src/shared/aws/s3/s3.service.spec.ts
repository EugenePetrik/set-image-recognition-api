/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service, UploadResult, ImageMetadata } from './s3.service';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const mockSend = jest.fn();
const mockS3Client = { send: mockSend };

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn((input: any) => ({ input })),
  GetObjectCommand: jest.fn((input: any) => ({ input })),
  DeleteObjectCommand: jest.fn((input: any) => ({ input })),
  HeadObjectCommand: jest.fn((input: any) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-12345'),
}));

describe('S3Service', () => {
  let service: S3Service;
  let configService: jest.Mocked<ConfigService>;

  const mockFile: Express.Multer.File = {
    fieldname: 'image',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024000,
    buffer: Buffer.from('fake-image-data'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    jest.clearAllMocks();

    (S3Client as jest.Mock).mockImplementation(() => mockS3Client);
    (getSignedUrl as jest.Mock).mockResolvedValue('https://signed-url.com/image.jpg');

    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Service, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<S3Service>(S3Service);
    configService = module.get(ConfigService);

    configService.get.mockImplementation((key: string, defaultValue?: string) => {
      switch (key) {
        case 'AWS_S3_BUCKET_NAME':
          return 'test-bucket';
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

  describe('constructor', () => {
    it('should initialize with environment configuration', () => {
      jest.clearAllMocks();

      const mockConfigWithCredentials = {
        get: jest.fn((key: string, defaultValue?: string) => {
          switch (key) {
            case 'AWS_S3_BUCKET_NAME':
              return 'custom-bucket';
            case 'AWS_REGION':
              return 'eu-west-1';
            case 'AWS_ACCESS_KEY_ID':
              return 'test-access-key';
            case 'AWS_SECRET_ACCESS_KEY':
              return 'test-secret-key';
            default:
              return defaultValue;
          }
        }),
      };

      new S3Service(mockConfigWithCredentials as unknown as ConfigService);

      expect(S3Client).toHaveBeenCalledWith({
        region: 'eu-west-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('should use default values when config is not provided', () => {
      const mockConfigServiceEmpty = {
        get: jest.fn().mockReturnValue(undefined),
      };

      new S3Service(mockConfigServiceEmpty as unknown as ConfigService);

      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
      });
    });

    it('should handle missing bucket name configuration', () => {
      const mockConfigWithoutBucket = {
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'AWS_S3_BUCKET_NAME') {
            return undefined;
          }
          return defaultValue || 'default-value';
        }),
      };

      expect(() => {
        new S3Service(mockConfigWithoutBucket as unknown as ConfigService);
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
            case 'AWS_S3_BUCKET_NAME':
              return 'test-bucket';
            default:
              return defaultValue || 'us-east-1';
          }
        }),
      };

      new S3Service(mockConfigWithEmptyStrings as unknown as ConfigService);

      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
      });
    });

    it('should handle partial credentials', () => {
      const mockConfigWithPartialCredentials = {
        get: jest.fn((key: string, defaultValue?: string) => {
          switch (key) {
            case 'AWS_ACCESS_KEY_ID':
              return 'test-access-key';
            case 'AWS_SECRET_ACCESS_KEY':
              return '';
            case 'AWS_S3_BUCKET_NAME':
              return 'test-bucket';
            default:
              return defaultValue || 'us-east-1';
          }
        }),
      };

      new S3Service(mockConfigWithPartialCredentials as unknown as ConfigService);

      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
      });
    });
  });

  describe('uploadImage', () => {
    it('should upload image with custom imageId', async () => {
      mockS3Client.send.mockResolvedValue({});

      const customImageId = 'custom-image-id';
      const result: UploadResult = await service.uploadImage(mockFile, customImageId);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: 'images/custom-image-id.jpg',
          }),
        }),
      );

      expect(result.key).toBe('images/custom-image-id.jpg');
    });

    it('should handle files without extension', async () => {
      mockS3Client.send.mockResolvedValue({});

      const fileWithoutExtension = {
        ...mockFile,
        originalname: 'test-image',
      };

      const result: UploadResult = await service.uploadImage(fileWithoutExtension);

      expect(result.key).toBe('images/mocked-uuid-12345');
    });

    it('should handle files with multiple dots in name', async () => {
      mockS3Client.send.mockResolvedValue({});

      const fileWithMultipleDots = {
        ...mockFile,
        originalname: 'test.image.final.jpg',
      };

      const result: UploadResult = await service.uploadImage(fileWithMultipleDots);

      expect(result.key).toBe('images/mocked-uuid-12345.jpg');
    });

    it('should handle different file extensions', async () => {
      mockS3Client.send.mockResolvedValue({});

      const extensions = ['png', 'gif', 'webp', 'jpeg'];

      for (const ext of extensions) {
        const fileWithExtension = {
          ...mockFile,
          originalname: `test-image.${ext}`,
          mimetype: `image/${ext}`,
        };

        const result: UploadResult = await service.uploadImage(fileWithExtension);
        expect(result.key).toBe(`images/mocked-uuid-12345.${ext}`);
      }
    });

    it('should handle S3 upload errors', async () => {
      const error = new Error('S3 upload failed');
      mockS3Client.send.mockRejectedValue(error);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: S3 upload failed');
    });

    it('should handle network connectivity issues', async () => {
      const networkError = new Error('ENOTFOUND');
      networkError.name = 'NetworkingError';
      mockS3Client.send.mockRejectedValue(networkError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: ENOTFOUND');
    });

    it('should handle permission errors', async () => {
      const permissionError = new Error('Access denied');
      permissionError.name = 'AccessDenied';
      mockS3Client.send.mockRejectedValue(permissionError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: Access denied');
    });

    it('should handle bucket not found errors', async () => {
      const bucketError = new Error('The specified bucket does not exist');
      bucketError.name = 'NoSuchBucket';
      mockS3Client.send.mockRejectedValue(bucketError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        'S3 upload failed: The specified bucket does not exist',
      );
    });

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.name = 'ServiceQuotaExceededException';
      mockS3Client.send.mockRejectedValue(quotaError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: Quota exceeded');
    });
  });

  describe('getImageUrl', () => {
    it('should generate signed URL with custom expiration', async () => {
      const signedUrl = 'https://signed-url.com/image.jpg';
      (getSignedUrl as jest.Mock).mockResolvedValue(signedUrl);

      const customExpiration = 7200;
      await service.getImageUrl('images/test.jpg', customExpiration);

      expect(getSignedUrl).toHaveBeenCalledWith(mockS3Client, expect.any(Object), { expiresIn: customExpiration });
    });

    it('should handle signed URL generation errors', async () => {
      const error = new Error('Failed to generate signed URL');
      (getSignedUrl as jest.Mock).mockRejectedValue(error);

      await expect(service.getImageUrl('images/test.jpg')).rejects.toThrow(
        'Failed to get image URL: Failed to generate signed URL',
      );
    });

    it('should handle invalid key errors', async () => {
      const keyError = new Error('Invalid key');
      keyError.name = 'InvalidObjectName';
      (getSignedUrl as jest.Mock).mockRejectedValue(keyError);

      await expect(service.getImageUrl('invalid-key')).rejects.toThrow('Failed to get image URL: Invalid key');
    });

    it('should handle access denied for signed URL', async () => {
      const accessError = new Error('Access denied');
      accessError.name = 'AccessDenied';
      (getSignedUrl as jest.Mock).mockRejectedValue(accessError);

      await expect(service.getImageUrl('images/test.jpg')).rejects.toThrow('Failed to get image URL: Access denied');
    });
  });

  describe('getImageStream', () => {
    it('should handle missing body in response', async () => {
      mockS3Client.send.mockResolvedValue({
        Body: undefined,
        ContentType: 'image/jpeg',
        ContentLength: 1024000,
      });

      await expect(service.getImageStream('images/test.jpg')).rejects.toThrow(
        'Failed to get image stream: No image data received from S3',
      );
    });

    it('should handle missing content type and length', async () => {
      const mockStream = { pipe: jest.fn(), on: jest.fn() } as any;
      mockS3Client.send.mockResolvedValue({
        Body: mockStream,
        ContentType: undefined,
        ContentLength: undefined,
      });

      const result = await service.getImageStream('images/test.jpg');

      expect(result).toEqual({
        stream: mockStream,
        contentType: 'application/octet-stream',
        contentLength: 0,
      });
    });

    it('should handle S3 get object errors', async () => {
      const error = new Error('Object not found');
      mockS3Client.send.mockRejectedValue(error);

      await expect(service.getImageStream('images/nonexistent.jpg')).rejects.toThrow(
        'Failed to get image stream: Object not found',
      );
    });

    it('should handle access denied errors', async () => {
      const accessError = new Error('Access denied');
      accessError.name = 'AccessDenied';
      mockS3Client.send.mockRejectedValue(accessError);

      await expect(service.getImageStream('images/test.jpg')).rejects.toThrow(
        'Failed to get image stream: Access denied',
      );
    });

    it('should handle no such key errors', async () => {
      const keyError = new Error('The specified key does not exist');
      keyError.name = 'NoSuchKey';
      mockS3Client.send.mockRejectedValue(keyError);

      await expect(service.getImageStream('images/nonexistent.jpg')).rejects.toThrow(
        'Failed to get image stream: The specified key does not exist',
      );
    });
  });

  describe('imageExists', () => {
    it('should return false when image does not exist', async () => {
      const notFoundError = new Error('Not found');
      notFoundError.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(notFoundError);

      const result = await service.imageExists('images/nonexistent.jpg');

      expect(result).toBe(false);
    });

    it('should throw error for other S3 errors', async () => {
      const accessError = new Error('Access denied');
      accessError.name = 'AccessDenied';
      mockS3Client.send.mockRejectedValue(accessError);

      await expect(service.imageExists('images/test.jpg')).rejects.toThrow(
        'Failed to check image existence: Access denied',
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkingError';
      mockS3Client.send.mockRejectedValue(networkError);

      await expect(service.imageExists('images/test.jpg')).rejects.toThrow(
        'Failed to check image existence: Network timeout',
      );
    });

    it('should handle bucket not found errors', async () => {
      const bucketError = new Error('The specified bucket does not exist');
      bucketError.name = 'NoSuchBucket';
      mockS3Client.send.mockRejectedValue(bucketError);

      await expect(service.imageExists('images/test.jpg')).rejects.toThrow(
        'Failed to check image existence: The specified bucket does not exist',
      );
    });
  });

  describe('deleteImage', () => {
    it('should handle S3 delete errors', async () => {
      const error = new Error('Delete failed');
      mockS3Client.send.mockRejectedValue(error);

      await expect(service.deleteImage('images/test.jpg')).rejects.toThrow('S3 delete failed: Delete failed');
    });

    it('should handle access denied errors', async () => {
      const accessError = new Error('Access denied');
      accessError.name = 'AccessDenied';
      mockS3Client.send.mockRejectedValue(accessError);

      await expect(service.deleteImage('images/test.jpg')).rejects.toThrow('S3 delete failed: Access denied');
    });

    it('should handle deleting non-existent objects', async () => {
      mockS3Client.send.mockResolvedValue({});

      await expect(service.deleteImage('images/nonexistent.jpg')).resolves.not.toThrow();
    });

    it('should handle bucket not found errors', async () => {
      const bucketError = new Error('The specified bucket does not exist');
      bucketError.name = 'NoSuchBucket';
      mockS3Client.send.mockRejectedValue(bucketError);

      await expect(service.deleteImage('images/test.jpg')).rejects.toThrow(
        'S3 delete failed: The specified bucket does not exist',
      );
    });

    it('should handle permission errors for deletion', async () => {
      const permissionError = new Error('Insufficient permissions');
      permissionError.name = 'AccessDenied';
      mockS3Client.send.mockRejectedValue(permissionError);

      await expect(service.deleteImage('images/test.jpg')).rejects.toThrow(
        'S3 delete failed: Insufficient permissions',
      );
    });
  });

  describe('getImageMetadata', () => {
    it('should handle missing metadata fields', async () => {
      mockS3Client.send.mockResolvedValue({
        ContentLength: undefined,
        ContentType: undefined,
        Metadata: undefined,
      });

      const result: ImageMetadata = await service.getImageMetadata('images/test.jpg');

      expect(result).toEqual({
        size: 0,
        mimeType: 'application/octet-stream',
        originalName: 'unknown',
      });
    });

    it('should handle partial metadata', async () => {
      mockS3Client.send.mockResolvedValue({
        ContentLength: 2048000,
        ContentType: 'image/png',
        Metadata: {
          uploadedAt: '2024-01-15T10:30:00.000Z',
        },
      });

      const result: ImageMetadata = await service.getImageMetadata('images/test.png');

      expect(result).toEqual({
        size: 2048000,
        mimeType: 'image/png',
        originalName: 'unknown',
      });
    });

    it('should handle empty metadata object', async () => {
      mockS3Client.send.mockResolvedValue({
        ContentLength: 1024000,
        ContentType: 'image/jpeg',
        Metadata: {},
      });

      const result: ImageMetadata = await service.getImageMetadata('images/test.jpg');

      expect(result).toEqual({
        size: 1024000,
        mimeType: 'image/jpeg',
        originalName: 'unknown',
      });
    });

    it('should handle S3 head object errors', async () => {
      const error = new Error('Object not found');
      mockS3Client.send.mockRejectedValue(error);

      await expect(service.getImageMetadata('images/nonexistent.jpg')).rejects.toThrow(
        'Failed to get image metadata: Object not found',
      );
    });

    it('should handle access denied errors', async () => {
      const accessError = new Error('Access denied');
      accessError.name = 'AccessDenied';
      mockS3Client.send.mockRejectedValue(accessError);

      await expect(service.getImageMetadata('images/test.jpg')).rejects.toThrow(
        'Failed to get image metadata: Access denied',
      );
    });

    it('should handle no such key errors', async () => {
      const keyError = new Error('The specified key does not exist');
      keyError.name = 'NoSuchKey';
      mockS3Client.send.mockRejectedValue(keyError);

      await expect(service.getImageMetadata('images/nonexistent.jpg')).rejects.toThrow(
        'Failed to get image metadata: The specified key does not exist',
      );
    });
  });

  describe('validateImage', () => {
    it('should validate supported image types', () => {
      const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

      supportedTypes.forEach((mimetype) => {
        const validFile = {
          ...mockFile,
          mimetype,
          size: 1024000,
        };

        expect(() => service.validateImage(validFile)).not.toThrow();
      });
    });

    it('should reject unsupported file types', () => {
      const unsupportedTypes = [
        'text/plain',
        'application/pdf',
        'video/mp4',
        'audio/mp3',
        'image/svg+xml',
        'image/bmp',
        'image/tiff',
      ];

      unsupportedTypes.forEach((mimetype) => {
        const invalidFile = {
          ...mockFile,
          mimetype,
        };

        expect(() => service.validateImage(invalidFile)).toThrow(
          `Invalid file type. Allowed types: image/jpeg, image/png, image/gif, image/webp`,
        );
      });
    });

    it('should reject files that are too large', () => {
      const oversizedFile = {
        ...mockFile,
        size: 6 * 1024 * 1024,
      };

      expect(() => service.validateImage(oversizedFile)).toThrow('File too large. Maximum size: 5MB');
    });

    it('should accept files at the maximum size limit', () => {
      const maxSizeFile = {
        ...mockFile,
        size: 5 * 1024 * 1024,
      };

      expect(() => service.validateImage(maxSizeFile)).not.toThrow();
    });

    it('should accept very small files', () => {
      const smallFile = {
        ...mockFile,
        size: 1024, // 1KB
      };

      expect(() => service.validateImage(smallFile)).not.toThrow();
    });

    it('should handle zero-size files', () => {
      const zeroSizeFile = {
        ...mockFile,
        size: 0,
      };

      expect(() => service.validateImage(zeroSizeFile)).not.toThrow();
    });

    it('should handle edge case file sizes', () => {
      const edgeCases = [1, 1023, 1024, 1024 * 1024 - 1, 1024 * 1024, 5 * 1024 * 1024 - 1, 5 * 1024 * 1024];

      edgeCases.forEach((size) => {
        const edgeFile = {
          ...mockFile,
          size,
        };

        expect(() => service.validateImage(edgeFile)).not.toThrow();
      });
    });

    it('should handle case variations in mime types', () => {
      const caseVariations = ['IMAGE/JPEG', 'Image/Jpeg', 'image/JPEG', 'IMAGE/PNG', 'image/GIF', 'image/WEBP'];

      caseVariations.forEach((mimetype) => {
        const caseFile = {
          ...mockFile,
          mimetype,
        };

        expect(() => service.validateImage(caseFile)).toThrow();
      });
    });
  });

  describe('error handling and resilience', () => {
    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockS3Client.send.mockRejectedValue(timeoutError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: Request timeout');
    });

    it('should handle credential errors', async () => {
      const credentialError = new Error('Invalid credentials');
      credentialError.name = 'CredentialsError';
      mockS3Client.send.mockRejectedValue(credentialError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: Invalid credentials');
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service unavailable');
      serviceError.name = 'ServiceUnavailable';
      mockS3Client.send.mockRejectedValue(serviceError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: Service unavailable');
    });

    it('should handle throttling errors', async () => {
      const throttleError = new Error('Slow down');
      throttleError.name = 'SlowDown';
      mockS3Client.send.mockRejectedValue(throttleError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: Slow down');
    });

    it('should handle unexpected error formats', async () => {
      const stringError = 'Simple string error';
      mockS3Client.send.mockRejectedValue(stringError);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: Simple string error');
    });

    it('should handle null/undefined errors', async () => {
      mockS3Client.send.mockRejectedValue(null);

      await expect(service.uploadImage(mockFile)).rejects.toThrow('S3 upload failed: Unknown error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete image lifecycle', async () => {
      mockS3Client.send.mockResolvedValueOnce({});
      const uploadResult = await service.uploadImage(mockFile);

      mockS3Client.send.mockResolvedValueOnce({
        ContentLength: 1024000,
        ContentType: 'image/jpeg',
      });
      const exists = await service.imageExists(uploadResult.key);

      mockS3Client.send.mockResolvedValueOnce({
        ContentLength: 1024000,
        ContentType: 'image/jpeg',
        Metadata: { originalName: 'test-image.jpg' },
      });
      const metadata = await service.getImageMetadata(uploadResult.key);

      (getSignedUrl as jest.Mock).mockResolvedValue('https://signed-url.com/image.jpg');
      const signedUrl = await service.getImageUrl(uploadResult.key);

      mockS3Client.send.mockResolvedValueOnce({});
      await service.deleteImage(uploadResult.key);

      expect(exists).toBe(true);
      expect(metadata.originalName).toBe('test-image.jpg');
      expect(signedUrl).toBe('https://signed-url.com/image.jpg');
    });

    it('should handle validation before upload workflow', () => {
      expect(() => service.validateImage(mockFile)).not.toThrow();

      mockS3Client.send.mockResolvedValue({});
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(service.uploadImage(mockFile)).resolves.toBeDefined();
    });

    it('should handle failed validation preventing upload', () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'text/plain',
      };

      expect(() => service.validateImage(invalidFile)).toThrow();
    });
  });
});
