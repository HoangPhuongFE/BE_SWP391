import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentStatusDto {
  @ApiProperty({ example: 'SampleCollected', enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @ApiPropertyOptional({ example: 'Mẫu máu đã lấy', description: 'Ghi chú' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: '2025-06-15T09:00:00Z', description: 'Ngày lấy mẫu (bắt buộc khi status là SampleCollected)' })
  @IsDateString()
  @IsOptional()
  sampleCollectedDate?: string;

  @ApiPropertyOptional({
    example: { HIV: 'Negative' },
    description: 'Kết quả xét nghiệm chi tiết (bắt buộc khi status là Completed)',
  })
  @IsOptional()
  testResultDetails?: Record<string, string>;

  @ApiPropertyOptional({ example: '2025-06-16T15:00:00Z', description: 'Ngày có kết quả (bắt buộc khi status là Completed)' })
  @IsDateString()
  @IsOptional()
  resultDate?: string;
}