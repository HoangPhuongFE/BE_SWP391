// src/modules/services/dtos/update-service.dto.ts
import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, Min, IsArray, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ServiceType } from '@prisma/client';
import { ServiceMode } from './create-service.dto';

export class UpdateServiceDto {
  @ApiPropertyOptional({ example: 'Gói toàn diện', description: 'Tên dịch vụ' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 1500000, description: 'Giá dịch vụ (VND)' })
  @Transform(({ value }) => typeof value === 'string' ? parseFloat(value) : value)
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'HIV, HPV, Chlamydia', description: 'Mô tả dịch vụ' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'STI', description: 'Danh mục dịch vụ' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: true, description: 'Trạng thái hoạt động' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'Testing', enum: ServiceType, description: 'Loại dịch vụ' })
  @IsEnum(ServiceType)
  @IsOptional()
  type?: ServiceType;

  @ApiPropertyOptional({ example: ['AT_HOME', 'AT_CLINIC'], isArray: true, enum: ServiceMode, description: 'Các hình thức dịch vụ hỗ trợ' })
  @IsEnum(ServiceMode, { each: true })
  @IsOptional()
  available_modes?: ServiceMode[];

  @ApiPropertyOptional({ example: '123 Nguyễn Văn A, Q1, HCM', description: 'Địa chỉ nhận mẫu' })
  @IsString()
  @IsOptional()
  return_address?: string;

  @ApiPropertyOptional({ example: '0909123456', description: 'SĐT nhận mẫu' })
  @IsString()
  @IsOptional()
  return_phone?: string;

  @ApiPropertyOptional({ example: 20, description: 'Số lượng lịch hẹn tối đa mỗi ngày' })
  @IsInt()
  @Min(0)
  @IsOptional()
  daily_capacity?: number;
}