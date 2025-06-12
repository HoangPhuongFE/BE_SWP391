import { IsString, IsNumber, Min, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateServiceDto {
  @ApiProperty({ example: 'Gói nâng cao', description: 'Tên dịch vụ', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 2000000, description: 'Giá dịch vụ', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ example: 'HIV, HPV, Chlamydia, Syphilis', description: 'Mô tả dịch vụ', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: false, description: 'Trạng thái hoạt động', required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}