// src/modules/services/dtos/create-service.dto.ts
import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ServiceType } from '@prisma/client';

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
}