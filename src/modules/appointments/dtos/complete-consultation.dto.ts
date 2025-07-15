import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteConsultationDto {
  @ApiPropertyOptional({ example: 'Tư vấn về sức khỏe sinh sản', description: 'Ghi chú tư vấn' })
  @IsString()
  @IsOptional()
  consultation_notes?: string;
}