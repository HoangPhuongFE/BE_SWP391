import { IsInt, IsString, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({ example: 4, description: 'Đánh giá từ 1-5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Bác sĩ giải thích rõ ràng', description: 'Nhận xét' })
  @IsString()
  @IsOptional()
  comment?: string;
}