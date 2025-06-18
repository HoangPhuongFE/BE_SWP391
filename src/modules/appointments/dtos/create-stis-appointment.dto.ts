import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceMode } from '@modules/services/dtos/create-service.dto';

export enum TestingSession {
  Morning = 'morning',
  Afternoon = 'afternoon',
}

export class CreateStiAppointmentDto {
  @ApiProperty({ example: 'svc001', description: 'ID dịch vụ xét nghiệm' })
  @IsString()
  serviceId: string;

  @ApiProperty({ example: '2025-06-15', description: 'Ngày xét nghiệm (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'morning', enum: TestingSession, description: 'Buổi xét nghiệm' })
  @IsEnum(TestingSession)
  session: TestingSession;

  @ApiPropertyOptional({ example: 'Phòng khám X', description: 'Địa điểm' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 'STI', description: 'Loại xét nghiệm' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: 'AT_HOME', enum: ServiceMode, description: 'Hình thức thực hiện' })
  @IsEnum(ServiceMode)
  selected_mode: ServiceMode;

  // Thêm các trường cho ShippingInfo (nếu AT_HOME)
  @ApiPropertyOptional({ example: 'Nguyen Van A', description: 'Tên người nhận' })
  @IsString()
  @IsOptional()
  contact_name?: string;

  @ApiPropertyOptional({ example: '0909123456', description: 'Số điện thoại liên hệ' })
  @IsString()
  @IsOptional()
  contact_phone?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Van A, Q1', description: 'Địa chỉ nhận kit' })
  @IsString()
  @IsOptional()
  shipping_address?: string;

  @ApiPropertyOptional({ example: 'TP.HCM', description: 'Tỉnh/Thành phố' })
  @IsString()
  @IsOptional()
  province?: string;

  @ApiPropertyOptional({ example: 'Quận 1', description: 'Quận/Huyện' })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({ example: 'Phường 1', description: 'Phường/Xã' })
  @IsString()
  @IsOptional()
  ward?: string;
}