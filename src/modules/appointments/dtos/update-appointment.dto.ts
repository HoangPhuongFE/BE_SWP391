
// src/modules/appointments/dtos/update-appointment.dto.ts
import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ example: 'Ghi chú tư vấn', description: 'Ghi chú tư vấn' })
  @IsString()
  @IsOptional()
  consultation_notes?: string;

  @ApiPropertyOptional({ example: '2025-06-13T11:00:00Z', description: 'Thời gian bắt đầu' })
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional({ example: '2025-06-13T12:00:00Z', description: 'Thời gian kết thúc' })
  @IsDateString()
  @IsOptional()
  end_time?: string;

  @ApiPropertyOptional({ example: 'Phòng khám B', description: 'Địa điểm' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 'svc002', description: 'ID dịch vụ' })
  @IsString()
  @IsOptional()
  service_id?: string;
}