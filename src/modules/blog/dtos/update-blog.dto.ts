import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBlogDto {
  @ApiPropertyOptional({ example: 'Tiêu đề mới', description: 'Tiêu đề mới của bài viết' })
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  title?: string;

  @ApiPropertyOptional({ example: 'Nội dung mới...', description: 'Nội dung mới của bài viết' })
  @IsOptional()
  @IsString({ message: 'Nội dung phải là chuỗi' })
  content?: string;

  @ApiPropertyOptional({ example: 'Sức khỏe', description: 'Danh mục mới (tuỳ chọn)' })
  @IsOptional()
  @IsString({ message: 'Danh mục phải là chuỗi' })
  category?: string;
}