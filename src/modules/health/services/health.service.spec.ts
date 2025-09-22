import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { S3Service } from '../../../shared/aws/s3/s3.service';
import { DynamoDBService } from '../../../shared/aws/dynamodb/dynamodb.service';

describe('HealthService', () => {
  let service: HealthService;
  let configService: jest.Mocked<ConfigService>;
  let s3Service: jest.Mocked<S3Service>;
  let dynamoDBService: jest.Mocked<DynamoDBService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const mockS3Service = {
      imageExists: jest.fn(),
    };

    const mockDynamoDBService = {
      getAllImages: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: S3Service, useValue: mockS3Service },
        { provide: DynamoDBService, useValue: mockDynamoDBService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    configService = module.get(ConfigService);
    s3Service = module.get(S3Service);
    dynamoDBService = module.get(DynamoDBService);

    configService.get.mockImplementation((key: string, defaultValue?: string) => {
      switch (key) {
        case 'app.version':
          return '1.0.0';
        case 'app.environment':
          return 'test';
        case 'AWS_REGION':
          return 'us-east-1';
        case 'AWS_S3_BUCKET_NAME':
          return 'test-bucket';
        case 'AWS_DYNAMODB_TABLE_NAME':
          return 'test-table';
        default:
          return defaultValue;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return healthy status when all services are working', async () => {
      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.version).toBe('1.0.0');
      expect(result.environment).toBe('test');
      expect(result.services).toEqual({
        database: 'healthy',
        storage: 'healthy',
        config: 'healthy',
      });
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.uptime).toBe('number');

      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when any service fails', async () => {
      dynamoDBService.getAllImages.mockRejectedValue(new Error('DynamoDB connection failed'));
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result).toMatchObject({
        status: 'unhealthy',
        services: {
          database: 'unhealthy',
          storage: 'healthy',
          config: 'healthy',
        },
      });
    });

    it('should return unhealthy status when S3 fails', async () => {
      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockRejectedValue(new Error('S3 connection failed'));

      const result = await service.getHealth();

      expect(result).toMatchObject({
        status: 'unhealthy',
        services: {
          database: 'healthy',
          storage: 'unhealthy',
          config: 'healthy',
        },
      });
    });

    it('should return unhealthy status when config is missing', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        switch (key) {
          case 'app.version':
            return '1.0.0';
          case 'app.environment':
            return 'test';
          case 'AWS_REGION':
            return undefined;
          case 'AWS_S3_BUCKET_NAME':
            return 'test-bucket';
          case 'AWS_DYNAMODB_TABLE_NAME':
            return 'test-table';
          default:
            return defaultValue;
        }
      });

      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result).toMatchObject({
        status: 'unhealthy',
        services: {
          database: 'healthy',
          storage: 'healthy',
          config: 'unhealthy',
        },
      });
    });

    it('should use default values when config values are not provided', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        return defaultValue;
      });

      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.version).toBe('1.0.0');
      expect(result.environment).toBe('development');
    });

    it('should track uptime correctly', async () => {
      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const firstCheck = await service.getHealth();
      const firstUptime = firstCheck.uptime;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const secondCheck = await service.getHealth();
      const secondUptime = secondCheck.uptime;

      expect(secondUptime).toBeGreaterThanOrEqual(firstUptime);
    });
  });

  describe('checkServices', () => {
    it('should handle all service checks passing', async () => {
      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.services).toEqual({
        database: 'healthy',
        storage: 'healthy',
        config: 'healthy',
      });
    });

    it('should handle all service checks failing', async () => {
      dynamoDBService.getAllImages.mockRejectedValue(new Error('DB error'));
      s3Service.imageExists.mockRejectedValue(new Error('S3 error'));
      configService.get.mockReturnValue(undefined);

      const result = await service.getHealth();

      expect(result.services).toEqual({
        database: 'unhealthy',
        storage: 'unhealthy',
        config: 'unhealthy',
      });
    });
  });

  describe('checkDynamoDB', () => {
    it('should return true when DynamoDB is accessible', async () => {
      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.services.database).toBe('healthy');
    });

    it('should return false when DynamoDB is not accessible', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      dynamoDBService.getAllImages.mockRejectedValue(new Error('Connection timeout'));
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.services.database).toBe('unhealthy');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('checkS3', () => {
    it('should return true when S3 is accessible', async () => {
      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.services.storage).toBe('healthy');
    });

    it('should return false when S3 is not accessible', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockRejectedValue(new Error('Access denied'));

      const result = await service.getHealth();

      expect(result.services.storage).toBe('unhealthy');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('checkEnvironmentConfig', () => {
    it('should return true when all required environment variables are present', async () => {
      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.services.config).toBe('healthy');
    });

    it('should return false when required environment variables are missing', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        switch (key) {
          case 'app.version':
            return '1.0.0';
          case 'app.environment':
            return 'test';
          case 'AWS_REGION':
            return undefined;
          case 'AWS_S3_BUCKET_NAME':
            return undefined;
          case 'AWS_DYNAMODB_TABLE_NAME':
            return 'test-table';
          default:
            return defaultValue;
        }
      });

      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.services.config).toBe('unhealthy');

      consoleWarnSpy.mockRestore();
    });

    it('should handle config check errors gracefully', async () => {
      dynamoDBService.getAllImages.mockResolvedValue({
        items: [],
        total: 0,
        hasMore: false,
      });
      s3Service.imageExists.mockResolvedValue(true);

      configService.get.mockImplementation((key: string) => {
        if (key === 'AWS_DYNAMODB_TABLE_NAME') {
          throw new Error('Config error');
        }
        return 'test-value';
      });

      const result = await service.getHealth();

      expect(result.services.config).toBe('unhealthy');
    });
  });

  describe('service resilience', () => {
    it('should handle partial service failures gracefully', async () => {
      dynamoDBService.getAllImages.mockRejectedValue(new Error('DB error'));
      s3Service.imageExists.mockResolvedValue(true);

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database).toBe('unhealthy');
      expect(result.services.storage).toBe('healthy');
      expect(result.services.config).toBe('healthy');
    });

    it('should return response even if all services fail', async () => {
      dynamoDBService.getAllImages.mockRejectedValue(new Error('DB error'));
      s3Service.imageExists.mockRejectedValue(new Error('S3 error'));
      configService.get.mockReturnValue(undefined);

      const result = await service.getHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('unhealthy');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
