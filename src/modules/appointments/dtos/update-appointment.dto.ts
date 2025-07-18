import { IsString, IsOptional, IsDateString, IsEnum, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceMode } from '@prisma/client';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ example: 'Ghi chú tư vấn', description: 'Ghi chú tư vấn, chỉ áp dụng cho lịch hẹn tư vấn.' })
  @IsString()
  @IsOptional()
  consultation_notes?: string;

  @ApiPropertyOptional({ example: '2025-06-13T11:00:00Z', description: 'Thời gian bắt đầu (định dạng ISO).' })
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional({ example: '2025-06-13T12:00:00Z', description: 'Thời gian kết thúc (định dạng ISO).' })
  @IsDateString()
  @IsOptional()
  end_time?: string;

  @ApiPropertyOptional({ example: 'Phòng khám B', description: 'Địa điểm tư vấn (áp dụng nếu mode là AT_CLINIC hoặc AT_HOME).' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 'svc002', description: 'ID dịch vụ.' })
  @IsString()
  @IsOptional()
  service_id?: string;

  @ApiPropertyOptional({
    example: 'ONLINE',
    enum: ServiceMode,
    description: 'Hình thức tư vấn: AT_HOME, AT_CLINIC, hoặc ONLINE. Phải nằm trong danh sách available_modes của dịch vụ.',
  })
  @IsEnum(ServiceMode)
  @IsOptional()
  mode?: ServiceMode;

  @ApiPropertyOptional({
    example: 'https://meet.google.com/xxx-xxxx-xxx',
    description: 'Link hội nghị trực tuyến (tùy chọn, chỉ áp dụng khi mode là ONLINE). Phải là URL hợp lệ (ví dụ: Google Meet, Zoom, Microsoft Teams).',
  })
  @IsOptional()
  @IsUrl()
  meeting_link?: string;
}