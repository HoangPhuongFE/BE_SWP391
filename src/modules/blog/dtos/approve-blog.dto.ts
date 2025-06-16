import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveBlogDto {
  @ApiPropertyOptional({ example: 'Duyệt bài viết', description: 'Ghi chú duyệt bài (tuỳ chọn)' })
  @IsOptional()
  @IsString()
  notes?: string;
}