import { ApiProperty } from '@nestjs/swagger';

export class LabelStatsDto {
  @ApiProperty({
    description: 'Label name',
    example: 'person',
  })
  name: string;

  @ApiProperty({
    description: 'Number of images with this label',
    example: 45,
  })
  count: number;

  @ApiProperty({
    description: 'Average confidence score for this label',
    example: 92.3,
  })
  averageConfidence: number;
}

export class LabelResponseDto {
  @ApiProperty({
    description: 'Available labels with statistics',
    type: [LabelStatsDto],
  })
  labels: LabelStatsDto[];

  @ApiProperty({
    description: 'Total number of unique labels',
    example: 67,
  })
  total: number;
}
