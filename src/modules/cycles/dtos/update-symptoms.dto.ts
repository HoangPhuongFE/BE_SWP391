// src/modules/cycles/dtos/update-symptoms.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSymptomsDto {
  @ApiProperty({ example: 'Đau bụng nhẹ', description: 'Triệu chứng' })
  @IsString()
  symptoms: string;

  @ApiProperty({ example: 'Tâm trạng khó chịu', description: 'Ghi chú', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}