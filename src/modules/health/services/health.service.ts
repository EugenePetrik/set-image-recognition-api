import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthResponseDto } from '../dto/health-response.dto';
import { S3Service } from '../../../shared/aws/s3/s3.service';
import { DynamoDBService } from '../../../shared/aws/dynamodb/dynamodb.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
    private readonly dynamoDBService: DynamoDBService,
  ) {}

  async getHealth(): Promise<HealthResponseDto> {
    const services = await this.checkServices();
    const allServicesHealthy = Object.values(services).every((status) => status === 'healthy');

    return {
      status: allServicesHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.configService.get<string>('app.version', '1.0.0'),
      environment: this.configService.get<string>('app.environment', 'development'),
      services,
    };
  }

  private async checkServices(): Promise<Record<string, 'healthy' | 'unhealthy'>> {
    const healthChecks = await Promise.allSettled([
      this.checkDynamoDB(),
      this.checkS3(),
      this.checkEnvironmentConfig(),
    ]);

    return {
      database: healthChecks[0].status === 'fulfilled' && healthChecks[0].value ? 'healthy' : 'unhealthy',
      storage: healthChecks[1].status === 'fulfilled' && healthChecks[1].value ? 'healthy' : 'unhealthy',
      config: healthChecks[2].status === 'fulfilled' && healthChecks[2].value ? 'healthy' : 'unhealthy',
    };
  }

  private async checkDynamoDB(): Promise<boolean> {
    try {
      await this.dynamoDBService.getAllImages(1, 1);
      return true;
    } catch (error) {
      this.logger.warn('DynamoDB health check failed:', error);
      return false;
    }
  }

  private async checkS3(): Promise<boolean> {
    try {
      await this.s3Service.imageExists('health-check-test-key');
      return true;
    } catch (error) {
      this.logger.warn('S3 health check failed:', error);
      return false;
    }
  }

  private checkEnvironmentConfig(): Promise<boolean> {
    try {
      const requiredEnvVars = ['AWS_REGION', 'AWS_S3_BUCKET_NAME', 'AWS_DYNAMODB_TABLE_NAME'];

      const missingVars = requiredEnvVars.filter((varName) => !this.configService.get<string>(varName));

      if (missingVars.length > 0) {
        this.logger.warn(`Missing environment variables: ${missingVars.join(', ')}`);
        return Promise.resolve(false);
      }

      return Promise.resolve(true);
    } catch (error) {
      this.logger.warn('Environment config check failed:', error);
      return Promise.resolve(false);
    }
  }
}
