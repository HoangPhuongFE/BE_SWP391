import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudentDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ tên đầy đủ của sinh viên' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'nguyenvana@example.com', description: 'Email hợp lệ của sinh viên' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
