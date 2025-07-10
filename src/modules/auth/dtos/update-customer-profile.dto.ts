import { IsOptional, IsString, IsDateString, IsEnum, IsPhoneNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Ngày sinh của khách hàng (định dạng YYYY-MM-DD)',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: Gender.Male,
    description: 'Giới tính của khách hàng',
    enum: Gender,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    example: 'Không có bệnh lý nền',
    description: 'Tiền sử bệnh án của khách hàng',
    minLength: 0,
  })
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  @ApiPropertyOptional({
    example: { showEmail: false, shareData: true },
    description: 'Cài đặt quyền riêng tư của khách hàng',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  privacySettings?: Record<string, any>;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Ảnh đại diện của người dùng (upload file hình ảnh)',
  })
  image?: any;

  @ApiPropertyOptional({
    example: 'Nguyen Van A',
    description: 'Họ và tên đầy đủ của người dùng',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    example: '+84912345678',
    description: 'Số điện thoại của người dùng',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '123 Đường Láng, Hà Nội',
    description: 'Địa chỉ của người dùng',
  })
  @IsOptional()
  @IsString()
  address?: string;
}