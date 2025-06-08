// src/modules/auth/dtos/update-consultant-profile.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConsultantProfileDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Trình độ, chứng chỉ',
  })
  @IsOptional()
  @IsString()
  qualifications?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Kinh nghiệm làm việc',
  })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 100,
    description: 'Chuyên môn chính',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;
}
