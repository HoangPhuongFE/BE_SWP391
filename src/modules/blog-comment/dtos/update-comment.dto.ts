import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCommentDto {
  @ApiPropertyOptional({ example: 'Nội dung mới...', description: 'Nội dung mới của bình luận' })
  @IsOptional()
  @IsString({ message: 'Nội dung phải là chuỗi' })
  content?: string;
}