// src/modules/auth/dtos/update-customer-profile.dto.ts
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '1990-05-15',
    description: 'Ngày sinh',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    enum: Gender,
    description: 'Giới tính',
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    type: String,
    description: 'Tiền sử bệnh án',
  })
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  @ApiPropertyOptional({
    type: 'object',
    description: 'Cài đặt quyền riêng tư',
    example: { showEmail: false, shareData: true },
    additionalProperties: true,
  })
  @IsOptional()
  privacySettings?: Record<string, any>;
}

