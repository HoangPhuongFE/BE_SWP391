import { IsString, IsEnum, IsOptional, IsDateString, ValidateIf } from 'class-validator';
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

  @ApiPropertyOptional({ example: 'Phòng khám X', description: 'Địa điểm xét nghiệm tại cơ sở (bắt buộc cho AT_CLINIC)' })
  @ValidateIf((o) => o.selected_mode === ServiceMode.AT_CLINIC)
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'STI', description: 'Loại xét nghiệm' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: 'AT_HOME', enum: ServiceMode, description: 'Hình thức thực hiện' })
  @IsEnum(ServiceMode)
  selected_mode: ServiceMode;

  @ApiPropertyOptional({ example: 'Nguyen Van A', description: 'Tên người nhận (bắt buộc cho AT_HOME)' })
  @ValidateIf((o) => o.selected_mode === ServiceMode.AT_HOME)
  @IsString()
  contact_name?: string;

  @ApiPropertyOptional({ example: '0909123456', description: 'Số điện thoại liên hệ (bắt buộc cho AT_HOME)' })
  @ValidateIf((o) => o.selected_mode === ServiceMode.AT_HOME)
  @IsString()
  contact_phone?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Van A, Q1', description: 'Địa chỉ nhận kit (bắt buộc cho AT_HOME)' })
  @ValidateIf((o) => o.selected_mode === ServiceMode.AT_HOME)
  @IsString()
  shipping_address?: string;

  @ApiPropertyOptional({ example: 'TP.HCM', description: 'Tỉnh/Thành phố (bắt buộc cho AT_HOME)' })
  @ValidateIf((o) => o.selected_mode === ServiceMode.AT_HOME)
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: 'Quận 1', description: 'Quận/Huyện (bắt buộc cho AT_HOME)' })
  @ValidateIf((o) => o.selected_mode === ServiceMode.AT_HOME)
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'Phường 1', description: 'Phường/Xã (bắt buộc cho AT_HOME)' })
  @ValidateIf((o) => o.selected_mode === ServiceMode.AT_HOME)
  @IsString()
  ward?: string;
}