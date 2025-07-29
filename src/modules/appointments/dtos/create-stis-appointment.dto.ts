import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'Location for AT_CLINIC mode', example: 'Phòng khám X' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Category', example: 'STI' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Service mode (AT_HOME or AT_CLINIC)', example: 'AT_HOME' })
  @IsString()
  @IsNotEmpty()
  selected_mode: string;

  @ApiPropertyOptional({ description: 'Contact name for shipping', example: 'phuonghoang' })
  @IsOptional()
  @IsString()
  contact_name?: string;

  @ApiPropertyOptional({ description: 'Contact phone for shipping', example: '0938982777' })
  @IsOptional()
  @Matches(/^0\d{9}$/, { message: 'Phone number must be 10 digits starting with 0' })
  contact_phone?: string;

  @ApiPropertyOptional({ description: 'Shipping address', example: '01 Lê Lai, Quận Tân Bình, TP.HCM' })
  @IsOptional()
  @IsString()
  shipping_address?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'Hồ Chí Minh' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: 'District name', example: 'Tân Bình' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Ward name', example: 'Phường 12' })
  @IsOptional()
  @IsString()
  ward?: string;
}
