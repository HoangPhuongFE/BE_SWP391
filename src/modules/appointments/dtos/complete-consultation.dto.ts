import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteConsultationDto {
  @ApiPropertyOptional({ example: 'Sức khỏe không được tốt cần đặt dịch vụ khám bệnh', description: 'Ghi chú tư vấn' })
  @IsString()
  @IsOptional()
  consultation_notes?: string;
}