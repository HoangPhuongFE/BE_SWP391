import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBlogDto {
  @ApiProperty({ example: 'Tiêu đề bài viết', description: 'Tiêu đề của bài viết' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  title: string;

  @ApiProperty({ example: 'Nội dung bài viết...', description: 'Nội dung của bài viết' })
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  @IsString({ message: 'Nội dung phải là chuỗi' })
  content: string;

  @ApiProperty({ example: 'Sức khỏe', description: 'Danh mục bài viết (tuỳ chọn)', required: false })
  @IsString({ message: 'Danh mục phải là chuỗi' })
  category?: string;
}