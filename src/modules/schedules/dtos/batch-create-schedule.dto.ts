import { IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchCreateScheduleDto {
  @ApiProperty({ example: '2025-07-20T09:00:00Z', description: 'Thời gian bắt đầu tổng thể' })
  @IsDateString()
  start_time: string;

  @ApiProperty({ example: '2025-07-20T12:00:00Z', description: 'Thời gian kết thúc tổng thể' })
  @IsDateString()
  end_time: string;

  @ApiProperty({ example: 60, description: 'Thời lượng mỗi lịch trống (phút, 15-120)' })
  @IsInt()
  @Min(15)
  @Max(120)
  duration_minutes: number;

  @ApiProperty({ example: 'svc003', description: 'ID dịch vụ (Consultation)' })
  @IsString()
  service_id: string;
}