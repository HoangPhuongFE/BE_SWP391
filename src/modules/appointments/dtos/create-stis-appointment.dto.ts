import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStiAppointmentDto {
  @ApiProperty({ example: 'svc001', description: 'ID dịch vụ xét nghiệm' })
  @IsString()
  serviceId: string;

  @ApiProperty({ example: 'sch001', description: 'ID lịch trống' })
  @IsString()
  scheduleId: string;

  @ApiPropertyOptional({ example: 'Phòng khám A', description: 'Địa điểm' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 'STI', description: 'Loại xét nghiệm' })
  @IsString()
  @IsOptional()
  category?: string;
}
