// src/modules/appointments/dtos/create-sti-appointment.dto.ts
import { IsString, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStiAppointmentDto {
  @ApiProperty({ example: 'svc001', description: 'ID dịch vụ xét nghiệm' })
  @IsString()
  serviceId: string;

  @ApiProperty({ example: '2025-06-15T09:00:00Z', description: 'Thời gian bắt đầu' })
  @IsDateString()
  start_time: string;

  @ApiProperty({ example: '2025-06-15T11:00:00Z', description: 'Thời gian kết thúc' })
  @IsDateString()
  end_time: string;

  @ApiPropertyOptional({ example: 'Phòng khám X', description: 'Địa điểm' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 'STI', description: 'Loại xét nghiệm' })
  @IsString()
  @IsOptional()
  category?: string;
}
