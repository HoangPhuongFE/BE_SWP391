// src/modules/appointments/dtos/update-appointment-status.dto.ts
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentStatusDto {
  @ApiProperty({ example: "Completed", enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @ApiProperty({ example: "Xét nghiệm thành công", description: 'Ghi chú', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}