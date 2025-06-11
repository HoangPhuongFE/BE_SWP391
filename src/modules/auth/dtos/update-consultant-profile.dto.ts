import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConsultantProfileDto {
  @ApiPropertyOptional({
    example: 'Bác sĩ đa khoa, chứng chỉ tâm lý học',
    description: 'Trình độ học vấn hoặc chứng chỉ của tư vấn viên',
    minLength: 0,
  })
  @IsOptional()
  @IsString()
  qualifications?: string;

  @ApiPropertyOptional({
    example: '5 năm làm việc tại bệnh viện X',
    description: 'Kinh nghiệm làm việc của tư vấn viên',
    minLength: 0,
  })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({
    example: 'Tâm lý học lâm sàng',
    description: 'Chuyên môn chính của tư vấn viên',
    maxLength: 100,
    minLength: 0,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;
}