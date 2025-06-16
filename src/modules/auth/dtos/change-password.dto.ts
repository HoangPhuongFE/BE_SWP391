import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ssw0rd', description: 'Mật khẩu hiện tại' })
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @ApiProperty({ example: 'NewP@ss1234', description: 'Mật khẩu mới ', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
