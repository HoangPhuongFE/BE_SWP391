import { IsDateString, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ example: '2025-06-11T09:00:00Z', description: 'Thời gian bắt đầu' })
  @IsDateString()
  start_time: string;

  @ApiProperty({ example: '2025-06-11T10:00:00Z', description: 'Thời gian kết thúc' })
  @IsDateString()
  end_time: string;

  @ApiProperty({ example: 'svc001', description: 'ID dịch vụ' })
  @IsString()
  service_id: string;
}