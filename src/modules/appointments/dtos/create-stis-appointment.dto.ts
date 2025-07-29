import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStiAppointmentDto {
  @ApiProperty({ description: 'Service ID', example: 'cd75660b-1da1-40a2-8056-6bdbcfb7b99b' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: 'Date of appointment (YYYY-MM-DD)', example: '2025-07-24' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ description: 'Session (e.g., morning, afternoon)', example: 'morning' })
  @IsString()
  @IsNotEmpty()
  session: string;

  @ApiProperty({ description: 'Location for AT_CLINIC mode', example: 'Phòng khám X', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Category', example: 'STI', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Service mode (AT_HOME or AT_CLINIC)', example: 'AT_HOME' })
  @IsString()
  @IsNotEmpty()
  selected_mode: string;

  @ApiProperty({ description: 'Contact name for shipping', example: 'phuonghoang' })
  @IsString()
  @IsNotEmpty()
  contact_name: string;

  @ApiProperty({ description: 'Contact phone for shipping', example: '0938982777' })
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Phone number must be 10 digits starting with 0' })
  contact_phone: string;

  @ApiProperty({ description: 'Shipping address', example: '01 Lê Lai, Quận Tân Bình, TP.HCM' })
  @IsString()
  @IsNotEmpty()
  shipping_address: string;

  @ApiProperty({ description: 'Province', example: 'Hồ Chí Minh' })
  @IsString()
  @IsNotEmpty()
  province: string;

  @ApiProperty({ description: 'District name', example: 'Tân Bình' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ description: 'Ward name', example: 'Phường 12' })
  @IsString()
  @IsNotEmpty()
  ward: string;
}