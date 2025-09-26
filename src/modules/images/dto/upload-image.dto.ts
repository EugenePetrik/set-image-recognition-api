import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadImageDto {
  @ApiPropertyOptional({
    description: 'Optional description for the image',
    example: 'Family vacation photo at the beach',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
