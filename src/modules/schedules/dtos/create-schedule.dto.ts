// src/modules/appointments/dtos/create-schedule.dto.ts
import { IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ example: '2025-06-20T09:00:00Z', description: 'Thời gian bắt đầu' })
  @IsDateString()
  start_time: string;

  @ApiProperty({ example: '2025-06-20T10:00:00Z', description: 'Thời gian kết thúc' })
  @IsDateString()
  end_time: string;

  @ApiProperty({ example: 'svc003', description: 'ID dịch vụ (Consultation)' })
  @IsString()
  service_id: string;
}
