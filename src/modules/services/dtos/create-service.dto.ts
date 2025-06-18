// src/modules/services/dtos/create-service.dto.ts
import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, Min, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum ServiceType {
  Testing = 'Testing',
  Consultation = 'Consultation',
}

export enum ServiceMode {
  AT_HOME = 'AT_HOME',
  AT_CLINIC = 'AT_CLINIC',
}

export class CreateServiceDto {
  @ApiProperty({ example: 'Gói toàn diện', description: 'Tên dịch vụ' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1500000, description: 'Giá dịch vụ (VND)' })
  @Transform(({ value }) => typeof value === 'string' ? parseFloat(value) : value)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'HIV, HPV, Chlamydia', description: 'Mô tả dịch vụ' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'STI', description: 'Danh mục dịch vụ' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ example: true, description: 'Trạng thái hoạt động' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ example: 'Testing', enum: ServiceType, description: 'Loại dịch vụ' })
  @IsEnum(ServiceType)
  type: ServiceType;

  @ApiPropertyOptional({ example: ['AT_HOME', 'AT_CLINIC'], isArray: true, enum: ServiceMode, description: 'Các hình thức dịch vụ hỗ trợ' })
  @IsEnum(ServiceMode, { each: true })
  @IsOptional()
  available_modes?: ServiceMode[];

  @ApiPropertyOptional({ example: '123 Nguyễn Văn A, Q1, HCM', description: 'Địa chỉ nhận mẫu từ khách' })
  @IsString()
  @IsOptional()
  return_address?: string;

  @ApiPropertyOptional({ example: '0909123456', description: 'SĐT nhận mẫu từ khách' })
  @IsString()
  @IsOptional()
  return_phone?: string;
}