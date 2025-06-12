import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus, PaymentStatus } from '@prisma/client';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ example: 'Confirmed', enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @ApiPropertyOptional({ example: 'Paid', enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiPropertyOptional({ example: 'Ghi chú tư vấn', description: 'Ghi chú' })
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

  @ApiPropertyOptional({ example: 'svc002', description: 'ID dịch vụ' })
  @IsString()
  @IsOptional()
  service_id?: string;
}