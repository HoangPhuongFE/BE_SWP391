import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto } from '../dtos/create-appointment.dto';
import { CreateStiAppointmentDto } from '../dtos/create-stis-appointment.dto';
import { UpdateAppointmentDto } from '../dtos/update-appointment.dto';
import { UpdateAppointmentStatusDto } from '../dtos/update-appointment-status.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ConfirmAppointmentDto } from '../dtos/confirm-appointment.dto';
import { CreateFeedbackDto } from '../dtos/create-feedback.dto';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

  @Post()
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Tạo lịch hẹn tư vấn',
    description: `
Tạo một lịch hẹn tư vấn với Consultant. Hệ thống sẽ kiểm tra lịch trống, dịch vụ, Consultant và quyền miễn phí nếu có. Nếu hợp lệ sẽ tạo lịch hẹn miễn phí. Nếu không, hệ thống sẽ trả về link thanh toán.

Để được miễn phí, khách hàng phải hoàn tất một lịch xét nghiệm (Testing) trong vòng 30 ngày, chưa từng sử dụng quyền miễn phí từ lịch đó. Gửi ID lịch xét nghiệm thông qua test_code trong body. Hệ thống sẽ kiểm tra mã này và nếu hợp lệ, sẽ tạo lịch hẹn tư vấn miễn phí mà không cần thanh toán.`
  })
  @ApiBearerAuth('access-token')
  @ApiBody({
    type: CreateAppointmentDto,
    description: `
Body gồm:
- schedule_id: ID lịch trống (bắt buộc)
- service_id: ID dịch vụ tư vấn (bắt buộc)
- consultant_id: ID chuyên gia (tùy chọn, phải trùng với lịch)
- location: địa điểm nếu offline (tùy chọn)
- type: luôn là 'Consultation'
- test_code: mã xét nghiệm (tùy chọn, nếu có sẽ kiểm tra quyền miễn phí)`
  })
  async createAppointment(@Body() dto: CreateAppointmentDto, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.createAppointment({ ...dto, userId });
  }

  @Post('sti')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Đặt lịch xét nghiệm STI',
    description: `
Tạo một lịch hẹn xét nghiệm STI. Kiểm tra thời gian, dịch vụ, hình thức (tại nhà hoặc tại phòng khám), dung lượng ngày, và khung giờ. Tạo lịch, mã xét nghiệm, thanh toán và giao hàng nếu cần.`
  })
  @ApiBearerAuth('access-token')
  @ApiBody({
    type: CreateStiAppointmentDto,
    description: `
Body gồm:
- serviceId: ID dịch vụ xét nghiệm (bắt buộc)
- date: ngày thực hiện xét nghiệm (bắt buộc)
- session: buổi (morning/afternoon) (bắt buộc)
- location: địa điểm (bắt buộc nếu AT_CLINIC)
- selected_mode: AT_CLINIC hoặc AT_HOME (bắt buộc)
- Các thông tin giao hàng bắt buộc nếu AT_HOME:
  - contact_name
  - contact_phone
  - shipping_address
  - province, district, ward`
  })
  async createStiAppointment(@Req() req, @Body() dto: CreateStiAppointmentDto) {
    const userId = (req.user as any).userId;
    return this.appointmentService.createStiAppointment({ ...dto, userId });
  }

  @Get()
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem tất cả lịch hẹn',
    description: `
Trả về danh sách lịch hẹn chưa hủy dành cho Staff hoặc Manager. Bao gồm thông tin người dùng, dịch vụ, và lịch trống.`
  })
  @ApiBearerAuth('access-token')
  async getAllAppointments() {
    return this.appointmentService.getAllAppointments();
  }

  @Patch(':appointmentId/status')
  @Roles(Role.Staff, Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Cập nhật trạng thái lịch xét nghiệm',
    description: `
Cho phép cập nhật trạng thái lịch hẹn xét nghiệm. Hệ thống sẽ kiểm tra điều kiện chuyển trạng thái và ghi lại lịch sử.`
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn', type: String })
  @ApiBody({ type: UpdateAppointmentStatusDto })
  async updateAppointmentStatus(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @Req() req,
  ) {
    const staffId = (req.user as any).userId;
    return this.appointmentService.updateAppointmentStatus(appointmentId, dto, staffId);
  }

  @Patch(':appointmentId')
  @Roles(Role.Staff, Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Cập nhật thông tin lịch hẹn',
    description: `
Cho phép chỉnh sửa thông tin lịch hẹn như thời gian, dịch vụ, ghi chú tư vấn. Hệ thống kiểm tra trùng lặp thời gian và dịch vụ hợp lệ.`
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn', type: String })
  @ApiBody({ type: UpdateAppointmentDto })
  async updateAppointment(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.updateAppointment(appointmentId, dto);
  }

  @Delete(':appointmentId')
  @Roles(Role.Manager, Role.Staff)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xóa lịch hẹn',
    description: `
Xóa mềm lịch hẹn. Nếu có lịch trống liên quan sẽ mở lại để dùng tiếp.`
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn', type: String })
  async deleteAppointment(@Param('appointmentId') appointmentId: string) {
    return this.appointmentService.deleteAppointment(appointmentId);
  }

  @Patch(':appointmentId/confirm')
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xác nhận lịch hẹn',
    description: `
Xác nhận lịch hẹn từ Pending sang Confirmed. Hệ thống kiểm tra trạng thái thanh toán và lịch trống.`
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn', type: String })
  @ApiBody({ type: ConfirmAppointmentDto })
  async confirmAppointment(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: ConfirmAppointmentDto,
    @Req() req,
  ) {
    const staffId = req.user.userId;
    return this.appointmentService.confirmAppointment(appointmentId, dto, staffId);
  }

  @Patch(':appointmentId/feedback')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Gửi đánh giá tư vấn',
    description: `
Khách hàng gửi đánh giá sau khi hoàn tất lịch hẹn tư vấn. Hệ thống cập nhật điểm trung bình của Consultant.`
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch tư vấn', type: String })
  @ApiBody({ type: CreateFeedbackDto })
  async submitFeedback(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CreateFeedbackDto,
    @Req() req,
  ) {
    const userId = (req.user as any).userId;
    return this.appointmentService.submitFeedback(appointmentId, dto, userId);
  }


  @Get('validate-test-code/:testCode')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Kiểm tra mã xét nghiệm cho tư vấn miễn phí',
    description: `
Kiểm tra xem mã xét nghiệm (test_code) có đủ điều kiện để đặt lịch tư vấn miễn phí hay không.  
Điều kiện:  
- Mã xét nghiệm thuộc lịch hẹn xét nghiệm (type = 'Testing').  
- Lịch hẹn đã hoàn tất (status = 'Completed').  
- Chưa từng sử dụng để đặt tư vấn miễn phí.  
- Còn trong thời hạn miễn phí (thường 30 ngày kể từ khi hoàn tất).  

Frontend nên gọi API này trước khi gửi yêu cầu tạo lịch hẹn với test_code.  
Trả về:  
- { valid: true, message: 'Bạn đủ điều kiện nhận tư vấn miễn phí' } nếu hợp lệ.  
- { valid: false, message: ... } nếu không hợp lệ (mã không tồn tại, đã sử dụng, hoặc hết hạn).
    `,
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'testCode', description: 'Mã xét nghiệm từ kết quả xét nghiệm (ví dụ: STI-12345)', type: String })
  async validateTestCode(@Param('testCode') testCode: string, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.validateTestCode(testCode, userId);
  }

  @Get('my-appointments')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem lịch hẹn của tôi',
    description: `
Trả về toàn bộ lịch hẹn của người dùng bao gồm thông tin dịch vụ, Consultant, trạng thái, kết quả, và thanh toán.`
  })
  @ApiBearerAuth('access-token')
  async getMyAppointments(@Req() req) {
    const userId = (req.user as any).userId;
    if (!userId) throw new BadRequestException('Không tìm thấy userId trong token');
    return this.appointmentService.getUserAppointments(userId);
  }

  @Get('pending')
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem lịch hẹn chờ xác nhận GIÀNH CHO Staff, Manager',
    description: `
Trả về danh sách lịch hẹn đang ở trạng thái Pending dành cho Staff, Manager xác nhận.`
  })
  @ApiBearerAuth('access-token')
  async getPendingAppointments() {
    return this.appointmentService.getPendingAppointments();
  }

  @Get(':appointmentId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem chi tiết lịch hẹn',
    description: `
Trả về thông tin chi tiết lịch hẹn bao gồm lịch sử trạng thái. Áp dụng kiểm tra quyền theo vai trò: Customer, Consultant, Staff, Manager, Admin.`
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn', type: String })
  async getAppointmentById(@Param('appointmentId') appointmentId: string, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.appointmentService.getAppointmentById(appointmentId, userId, role);
  }
}