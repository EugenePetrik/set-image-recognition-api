import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Overall health status',
    example: 'healthy',
    enum: ['healthy', 'unhealthy'],
  })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({
    description: 'Current timestamp',
    example: '2025-09-04T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Application uptime in seconds',
    example: 3600,
  })
  uptime: number;

  @ApiProperty({
    description: 'Application version',
    example: '1.0.0',
  })
  version: string;

  @ApiProperty({
    description: 'Environment name',
    example: 'development',
  })
  environment: string;

  @ApiProperty({
    description: 'Health status of individual services',
    example: {
      database: 'healthy',
      aws: 'healthy',
      storage: 'healthy',
    },
  })
  services: Record<string, 'healthy' | 'unhealthy'>;
}
