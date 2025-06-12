import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({ example: "Pending", enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @ApiPropertyOptional({ example: "Pending", enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiPropertyOptional({ example: "Phòng khám A", description: 'Địa điểm' })
  @IsString()
  @IsOptional()
  location?: string;
}