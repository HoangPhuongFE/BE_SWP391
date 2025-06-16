import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'Nội dung bình luận...', description: 'Nội dung của bình luận' })
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  @IsString({ message: 'Nội dung phải là chuỗi' })
  content: string;

  @ApiPropertyOptional({ example: '70aeb4cc-0751-4552-965c-a97e37fcce36', description: 'ID bình luận cha (tuỳ chọn)' })
  @IsOptional()
  @IsString({ message: 'parent_id phải là chuỗi' })
  parent_id?: string;
}