import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ServiceType } from '@prisma/client';

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
}