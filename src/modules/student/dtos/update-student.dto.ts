import { PartialType } from '@nestjs/mapped-types';
import { CreateStudentDto } from './create-student.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @ApiPropertyOptional({ example: 'Nguyễn Văn B' })
  fullName?: string;

  @ApiPropertyOptional({ example: 'nguyenvanb@example.com' })
  email?: string;

  
}
