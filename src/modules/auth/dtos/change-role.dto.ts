import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeRoleDto {
  @ApiProperty({ description: 'ID của người dùng cần thay đổi vai trò' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Vai trò mới (Customer, Consultant, Manager)' })
  @IsString()
  @IsNotEmpty()
  newRole: string;
}