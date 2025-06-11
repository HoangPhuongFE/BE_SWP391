// src/modules/schedules/dtos/create-schedule.dto.ts
import { IsDateString, IsString, Min, Max ,IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ example: "2025-06-11T09:00:00Z", description: 'Thời gian bắt đầu' })
  @IsDateString()
  start_time: string;

  @ApiProperty({ example: "2025-06-11T10:00:00Z", description: 'Thời gian kết thúc' })
  @IsDateString()
  @Min(0)
  end_time: string;

  @ApiProperty({ example: "svc001", description: 'ID dịch vụ' })
  @IsString()
  service_id: string;
}

export class UpdateScheduleDto {
  @ApiProperty({ example: "2025-06-11T09:30:00Z", description: 'Thời gian bắt đầu mới', required: false })
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiProperty({ example: "2025-06-11T10:30:00Z", description: 'Thời gian kết thúc mới', required: false })
  @IsDateString()
  @IsOptional()
  @Min(0)
  end_time?: string;

  @ApiProperty({ example: "svc002", description: 'ID dịch vụ mới', required: false })
  @IsString()
  @IsOptional()
  service_id?: string;
}