import { IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmAppointmentDto {
  @ApiPropertyOptional({ example: 'Xác nhận bởi staff', description: 'Ghi chú khi xác nhận lịch hẹn.' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: 'https://meet.google.com/xxx-xxxx-xxx',
    description: `
Link hội nghị trực tuyến.
- **Bắt buộc** khi lịch hẹn có mode là ONLINE.
- Không được cung cấp khi mode là AT_HOME hoặc AT_CLINIC.
- Phải là URL hợp lệ (ví dụ: Google Meet, Zoom, Microsoft Teams).
    `,
  })
  @IsOptional()
  @IsUrl()
  meeting_link?: string;
}