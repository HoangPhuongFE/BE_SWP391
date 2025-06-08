// src/modules/auth/dto/set-password.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPasswordDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'NewP@ss123', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
