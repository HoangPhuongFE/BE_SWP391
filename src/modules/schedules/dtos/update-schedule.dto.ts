import { IsDateString, IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScheduleDto {
  @ApiPropertyOptional({ example: '2025-06-11T09:30:00Z', description: 'Thời gian bắt đầu mới' })
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional({ example: '2025-06-11T10:30:00Z', description: 'Thời gian kết thúc mới' })
  @IsDateString()
  @IsOptional()
  end_time?: string;

  @ApiPropertyOptional({ example: 'svc002', description: 'ID dịch vụ mới' })
  @IsString()
  @IsOptional()
  service_id?: string;
}