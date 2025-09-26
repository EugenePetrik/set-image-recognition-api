import { ApiProperty } from '@nestjs/swagger';

export class ImageUploadResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the uploaded image',
    example: 'img_1234567890123',
  })
  imageId: string;

  @ApiProperty({
    description: 'URL of the uploaded image',
    example: 'https://image-bucket.s3.amazonaws.com/images/img_1234567890123.jpg',
  })
  imageUrl: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-09-04T12:00:00Z',
  })
  uploadedAt: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Image uploaded successfully. Recognition process started.',
  })
  message: string;
}
