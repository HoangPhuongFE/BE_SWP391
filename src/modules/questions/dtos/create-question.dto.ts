import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Express } from 'express';

export class CreateQuestionDto {
  @ApiProperty({ example: 'Về xét nghiệm STI', description: 'Tiêu đề câu hỏi' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Tôi cần biết cách xét nghiệm STI?', description: 'Nội dung câu hỏi' })
  @IsString()
  content: string;

  @ApiProperty({ example: 'CO', description: 'ID của Tư vấn viên được chọn' })
  @IsString()
  consultant_id: string;

  @ApiPropertyOptional({
    description: 'Hình ảnh đính kèm (tùy chọn, định dạng JPEG/PNG, tối đa 5MB)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  image?: Express.Multer.File;

  @ApiPropertyOptional({ example: 'STI', description: 'Danh mục câu hỏi (e.g., STI, Fertility, General)' })
  @IsString()
  @IsOptional()
  category?: string;
}