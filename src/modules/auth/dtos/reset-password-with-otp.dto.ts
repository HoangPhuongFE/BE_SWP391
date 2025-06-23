import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordWithOtpDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() otpCode: string;
  @ApiProperty() @IsString() @Length(6, 32) newPassword: string;
}
