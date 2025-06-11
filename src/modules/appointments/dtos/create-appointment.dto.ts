// src/modules/appointments/dtos/create-appointment.dto.ts
import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentType, AppointmentStatus, PaymentStatus } from '@prisma/client';

export class CreateAppointmentDto {
  @ApiProperty({ example: "con001", description: 'ID Consultant' })
  @IsString()
  consultant_id: string;

  @ApiProperty({ example: "sch001", description: 'ID lịch trống' })
  @IsString()
  schedule_id: string;

  @ApiProperty({ example: "svc001", description: 'ID dịch vụ' })
  @IsString()
  service_id: string;

  @ApiProperty({ example: "Consultation", enum: AppointmentType })
  @IsEnum(AppointmentType)
  type: AppointmentType;

  @ApiProperty({ example: "Pending", enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @ApiProperty({ example: "Pending", enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  payment_status: PaymentStatus;

  @ApiProperty({ example: "Phòng khám A", description: 'Địa điểm', required: false })
  @IsString()
  @IsOptional()
  location?: string;
}

export class UpdateAppointmentDto {
  @ApiProperty({ example: "Confirmed", enum: AppointmentStatus, required: false })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @ApiProperty({ example: "Paid", enum: PaymentStatus, required: false })
  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiProperty({ example: "Ghi chú tư vấn", description: 'Ghi chú', required: false })
  @IsString()
  @IsOptional()
  consultation_notes?: string;
}

export class CreateStiAppointmentDto {
  @ApiProperty({ example: "svc001", description: 'ID dịch vụ xét nghiệm' })
  @IsString()
  serviceId: string;

  @ApiProperty({ example: "sch001", description: 'ID lịch trống' })
  @IsString()
  scheduleId: string;

  @ApiProperty({ example: "Phòng khám A", description: 'Địa điểm', required: false })
  @IsString()
  @IsOptional()
  location?: string;
}