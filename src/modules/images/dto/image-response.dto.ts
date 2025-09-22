import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LabelDto {
  @ApiProperty({
    description: 'Label name',
    example: 'person',
  })
  name: string;

  @ApiProperty({
    description: 'Confidence score (0-100)',
    example: 95.2,
  })
  confidence: number;
}

export class ImageResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the image',
    example: 'img_1234567890123',
  })
  id: string;

  @ApiProperty({
    description: 'Original filename of the image',
    example: 'vacation-photo.jpg',
  })
  name: string;

  @ApiProperty({
    description: 'S3 URL of the image',
    example: 'https://image-bucket.s3.amazonaws.com/images/img_1234567890123.jpg',
  })
  url: string;

  @ApiProperty({
    description: 'Recognized labels in the image',
    type: [LabelDto],
  })
  labels: LabelDto[];

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-09-04T12:00:00Z',
  })
  uploadedAt: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 2048576,
  })
  size?: number;

  @ApiPropertyOptional({
    description: 'Image MIME type',
    example: 'image/jpeg',
  })
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Image processing status',
    example: 'completed',
    enum: ['uploading', 'processing', 'completed', 'failed'],
  })
  status?: string;
}
