import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentType, ServiceMode } from '@prisma/client';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'con001', description: 'ID của Consultant muốn đặt lịch (tùy chọn).' })
  @IsString()
  @IsOptional()
  consultant_id?: string;

  @ApiProperty({ example: 'sch001', description: 'ID của lịch trống (schedule) mà khách muốn đặt.' })
  @IsString()
  schedule_id: string;

  @ApiProperty({ example: 'svc001', description: 'ID dịch vụ tư vấn (chỉ áp dụng cho loại Consultation).' })
  @IsString()
  service_id: string;

  @ApiProperty({ example: 'Consultation', enum: AppointmentType, description: 'Loại lịch hẹn — luôn là "Consultation" cho API này.' })
  @IsEnum(AppointmentType)
  type: AppointmentType;

  @ApiPropertyOptional({ example: 'Phòng khám A', description: 'Địa điểm tư vấn (tùy chọn, áp dụng nếu mode là AT_CLINIC hoặc AT_HOME).' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    example: 'STI-12345',
    description: `
Mã xét nghiệm (**test_code**) từ kết quả xét nghiệm đã hoàn tất, để yêu cầu được **tư vấn miễn phí**.
**Chỉ áp dụng nếu:**
- Mã xét nghiệm thuộc lịch hẹn xét nghiệm (type = 'Testing')
- Lịch hẹn xét nghiệm có trạng thái = 'Completed'
- Chưa từng sử dụng để đặt tư vấn miễn phí
- Còn hiệu lực trong vòng 30 ngày kể từ khi hoàn tất
**Cách kiểm tra trên FE**:
Gọi API: \`GET /appointments/validate-test-code/:testCode\`
Nếu trả về: \`{ "valid": true }\` ⇒ Gắn mã xét nghiệm đó vào đây để được miễn phí tư vấn
Nếu hợp lệ:
- Hệ thống sẽ đánh dấu \`is_free_consultation = true\`
- Không tạo thanh toán
- Lịch tư vấn sẽ miễn phí và chờ xác nhận từ hệ thống
Nếu không hợp lệ:
- Backend sẽ trả lỗi 400: "Mã xét nghiệm không hợp lệ hoặc đã hết hạn miễn phí"
    `,
  })
  @IsString()
  @IsOptional()
  test_code?: string;

  @ApiProperty({
    example: 'ONLINE',
    enum: ServiceMode,
    description: 'Hình thức tư vấn: AT_HOME, AT_CLINIC, hoặc ONLINE. Phải nằm trong danh sách available_modes của dịch vụ.',
  })
  @IsEnum(ServiceMode)
  mode: ServiceMode;
}