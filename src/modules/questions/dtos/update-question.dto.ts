import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuestionDto {
  @ApiProperty({ example: 'Bạn nên xét nghiệm tại phòng khám', description: 'Nội dung trả lời' })
  @IsString()
  answer: string;
}