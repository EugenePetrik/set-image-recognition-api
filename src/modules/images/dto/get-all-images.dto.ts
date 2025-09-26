import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetAllImagesDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return 1;
    const num = Number(value);
    return isNaN(num) || num < 1 ? 1 : Math.floor(num);
  })
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return 10;
    const num = Number(value);
    if (isNaN(num) || num < 1) return 10;
    return Math.min(100, Math.max(1, Math.floor(num)));
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
