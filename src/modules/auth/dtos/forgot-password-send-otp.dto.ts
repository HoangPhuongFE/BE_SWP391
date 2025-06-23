import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordSendOtpDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsEmail()
  email: string;
}
