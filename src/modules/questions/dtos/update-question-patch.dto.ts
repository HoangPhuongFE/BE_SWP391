import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQuestionPatchDto {
  @ApiPropertyOptional({ example: 'Cập nhật tiêu đề', description: 'Tiêu đề mới (tùy chọn)' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Cập nhật nội dung', description: 'Nội dung mới (tùy chọn)' })
  @IsString()
  @IsOptional()
  content?: string;
}