import { IsArray, IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetupCycleDto {
  @ApiProperty({ example: '2025-05-01', description: 'Ngày bắt đầu chu kỳ' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: 5, description: 'Độ dài kỳ kinh (2-7 ngày)' })
  @IsInt()
  @Min(2)
  @Max(7)
  periodLength: number;

  @ApiProperty({
    type: Array,
    description: '2-3 chu kỳ trước (tùy chọn)',
    example: [{ startDate: '2025-04-03', periodLength: 5 }],
    required: false,
  })
  @IsArray()
  @IsOptional()
  previousCycles?: { startDate: string; periodLength: number }[];
}