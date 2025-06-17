import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentType } from '@prisma/client';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'con001', description: 'ID Consultant' })
  @IsString()
  @IsOptional()
  consultant_id?: string;

  @ApiProperty({ example: 'sch001', description: 'ID lịch trống' })
  @IsString()
  schedule_id: string;

  @ApiProperty({ example: 'svc001', description: 'ID dịch vụ' })
  @IsString()
  service_id: string;

  @ApiProperty({ example: 'Consultation', enum: AppointmentType })
  @IsEnum(AppointmentType)
  type: AppointmentType;

  @ApiPropertyOptional({ example: 'Phòng khám A', description: 'Địa điểm' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'ID xét nghiệm liên quan để miễn phí' })
  @IsString()
  @IsOptional()
  related_appointment_id?: string;
}