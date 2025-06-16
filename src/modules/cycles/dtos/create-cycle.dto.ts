import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCycleDto {
  @ApiProperty({ example: '2025-05-29', description: 'Ngày bắt đầu chu kỳ' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: 6, description: 'Độ dài kỳ kinh (2-7 ngày)' })
  @IsInt()
  @Min(2)
  @Max(7)
  periodLength: number;

  @ApiProperty({ example: 'Đau bụng nhẹ', description: 'Triệu chứng', required: false })
  @IsOptional()
  @IsString()
  symptoms?: string;

  @ApiProperty({ example: 'Tâm trạng khó chịu', description: 'Ghi chú', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}