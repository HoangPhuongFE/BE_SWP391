import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmAppointmentDto {
  @ApiPropertyOptional({ example: 'Xác nhận lịch hẹn xét nghiệm', description: 'Ghi chú xác nhận' })
  @IsString()
  @IsOptional()
  notes?: string;
}
