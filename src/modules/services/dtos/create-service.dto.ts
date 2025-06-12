import { IsString, IsNumber, Min, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateServiceDto {
  @ApiProperty({ example: 'Gói toàn diện', description: 'Tên dịch vụ' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1500000, description: 'Giá dịch vụ' })
  @Transform(({ value }) => typeof value === 'string' ? parseFloat(value) : value)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'HIV, HPV, Chlamydia', description: 'Mô tả dịch vụ', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'STI', description: 'Danh mục dịch vụ' })
  @IsString()
  category: string;

  @ApiProperty({ example: true, description: 'Trạng thái hoạt động', required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;
}