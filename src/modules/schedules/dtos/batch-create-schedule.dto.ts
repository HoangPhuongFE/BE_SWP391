import { IsString, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchCreateScheduleDto {
  @ApiProperty({ example: '2025-06-20T09:00:00Z', description: 'Thời gian bắt đầu tổng thể' })
  @IsDateString()
  start_time: string;

  @ApiProperty({ example: '2025-06-20T12:00:00Z', description: 'Thời gian kết thúc tổng thể' })
  @IsDateString()
  end_time: string;

  @ApiProperty({ example: 60, description: 'Thời lượng mỗi lịch trống (phút)' })
  @IsInt()
  @Min(1)
  duration_minutes: number;

  @ApiProperty({ example: 'svc003', description: 'ID dịch vụ (Consultation)' })
  @IsString()
  service_id: string;
}
