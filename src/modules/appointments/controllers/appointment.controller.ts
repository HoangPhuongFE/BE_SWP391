import { Controller, Post, Get, Patch, Delete, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
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
    description: 'Cho phép khách hàng đặt lịch tư vấn với Consultant dựa trên lịch trống có sẵn. Xác thực lịch trống, dịch vụ, và Consultant trước khi tạo. Hỗ trợ tư vấn miễn phí nếu liên kết với lịch hẹn xét nghiệm hợp lệ (hoàn tất, chưa sử dụng miễn phí, trong thời hạn). Tạo liên kết thanh toán nếu không miễn phí.'
  })
  @ApiBearerAuth('access-token')
  @ApiBody({
    type: CreateAppointmentDto,
    description: 'Thông tin tạo lịch hẹn tư vấn, bao gồm ID lịch trống, ID dịch vụ, ID Consultant (tùy chọn), địa điểm, loại hình (online/offline), và ID lịch hẹn xét nghiệm liên quan (nếu có).'
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
    description: 'Cho phép khách hàng đặt lịch xét nghiệm STI bằng cách chọn ngày, buổi (sáng/chiều), và hình thức (tại phòng khám hoặc tại nhà). Kiểm tra dung lượng ngày, khung giờ hợp lệ, và dịch vụ xét nghiệm. Tạo mã xét nghiệm, liên kết thanh toán, và thông tin giao hàng (bắt buộc nếu tại nhà).'
  })
  @ApiBearerAuth('access-token')
  @ApiBody({
    type: CreateStiAppointmentDto,
    description: `
    Thông tin tạo lịch xét nghiệm STI, bao gồm:
    - serviceId: ID dịch vụ xét nghiệm (string, bắt buộc).
    - date: Ngày xét nghiệm (string, định dạng ISO, bắt buộc).
    - session: Buổi xét nghiệm (enum: 'morning' hoặc 'afternoon', bắt buộc).
    - location: Địa điểm xét nghiệm (string, bắt buộc nếu selected_mode là AT_CLINIC, ví dụ: ID phòng khám).
    - selected_mode: Hình thức xét nghiệm (enum: 'AT_CLINIC' hoặc 'AT_HOME', bắt buộc).
    - category: Danh mục xét nghiệm (string, mặc định 'STI', tùy chọn).
    - Nếu selected_mode là AT_HOME, thêm các trường bắt buộc:
      "contact_name": "Nguyen Van A",
      "contact_phone": "0909123456",
      "shipping_address": "123 Nguyen Van A, Q1",
      "province": "TP.HCM",
      "district": "Quận 1",
      "ward": "Phường 1"
  `
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
    description: 'Trả về danh sách tất cả lịch hẹn (trừ trạng thái Cancelled) dành cho Staff hoặc Manager. Bao gồm thông tin người dùng, dịch vụ, và lịch trống (nếu có), sắp xếp theo thời gian bắt đầu.'
  })
  @ApiBearerAuth('access-token')
  async getAllAppointments() {
    return this.appointmentService.getAllAppointments();
  }

  @Patch(':appointmentId/status')
  @Roles(Role.Staff, Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Cập nhật trạng thái lịch hẹn xét nghiệm',
    description: 'Cho phép Staff, Manager, hoặc Admin cập nhật trạng thái lịch hẹn xét nghiệm (ví dụ: Confirmed → SampleCollected → Completed). Kiểm tra chuyển đổi trạng thái hợp lệ, trạng thái giao hàng (nếu tại nhà), và cập nhật kết quả xét nghiệm (nếu có). Ghi lịch sử trạng thái và thông báo cho khách hàng.'
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID của lịch hẹn xét nghiệm cần cập nhật trạng thái', type: String })
  @ApiBody({
    type: UpdateAppointmentStatusDto,
    description: 'Thông tin cập nhật trạng thái, bao gồm trạng thái mới (Pending, Confirmed, SampleCollected, Completed, Cancelled), ghi chú, ngày thu mẫu, chi tiết kết quả xét nghiệm, và ngày kết quả.'
  })
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
    description: 'Cho phép Staff, Manager, hoặc Admin chỉnh sửa thông tin lịch hẹn, như thời gian, dịch vụ, hoặc ghi chú tư vấn. Kiểm tra thời gian không trùng lặp với lịch hẹn khác và dịch vụ hợp lệ trước khi cập nhật.'
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID của lịch hẹn cần cập nhật thông tin', type: String })
  @ApiBody({
    type: UpdateAppointmentDto,
    description: 'Thông tin cập nhật, bao gồm thời gian bắt đầu, thời gian kết thúc, ID dịch vụ, và ghi chú tư vấn (chỉ áp dụng cho lịch hẹn tư vấn).'
  })
  async updateAppointment(@Param('appointmentId') appointmentId: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentService.updateAppointment(appointmentId, dto);
  }

  @Delete(':appointmentId')
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xóa lịch hẹn (xóa mềm)',
    description: 'Cho phép Manager hoặc Admin xóa mềm lịch hẹn, đánh dấu deleted_at và mở lại lịch trống liên quan (nếu có) để sử dụng lại.'
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID của lịch hẹn cần xóa', type: String })
  async deleteAppointment(@Param('appointmentId') appointmentId: string) {
    return this.appointmentService.deleteAppointment(appointmentId);
  }

  @Get('test-results/:testCode')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem kết quả xét nghiệm theo mã',
    description: 'Cho phép khách hàng tra cứu kết quả xét nghiệm bằng mã testCode. Trả về chi tiết kết quả, lịch sử trạng thái, thông tin lịch hẹn, và thông báo nếu kết quả bất thường. Ghi lại thời điểm xem và audit log.'
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'testCode', required: true, description: 'Mã xét nghiệm để tra cứu kết quả', type: String })
  async getTestResult(@Param('testCode') testCode: string, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.getTestResult(testCode, userId);
  }

  @Patch(':appointmentId/confirm')
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xác nhận lịch hẹn',
    description: 'Cho phép Staff hoặc Manager xác nhận lịch hẹn từ trạng thái Pending sang Confirmed. Kiểm tra trạng thái thanh toán (đã thanh toán hoặc miễn phí) và lịch trống hợp lệ (đối với tư vấn) trước khi xác nhận.'
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID của lịch hẹn cần xác nhận', type: String })
  @ApiBody({
    type: ConfirmAppointmentDto,
    description: 'Thông tin xác nhận, bao gồm ghi chú (tùy chọn).'
  })
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
    summary: 'Gửi đánh giá cho buổi tư vấn',
    description: 'Cho phép khách hàng gửi đánh giá (rating) và bình luận cho lịch hẹn tư vấn sau khi hoàn tất. Cập nhật điểm trung bình của Consultant dựa trên các đánh giá đã được phê duyệt.'
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID của lịch hẹn tư vấn để gửi đánh giá', type: String })
  @ApiBody({
    type: CreateFeedbackDto,
    description: 'Thông tin đánh giá, bao gồm điểm (rating) từ 1-5 và bình luận.'
  })
  async submitFeedback(@Param('appointmentId') appointmentId: string, @Body() dto: CreateFeedbackDto, @Req() req) {
    const userId = (req.user as any).userId;
    const result = await this.appointmentService.submitFeedback(appointmentId, dto, userId);
    return result;
  }

  @Get('validate-related/:appointmentId')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Kiểm tra tư vấn miễn phí',
    description: 'Kiểm tra xem khách hàng có đủ điều kiện nhận tư vấn miễn phí dựa trên lịch hẹn xét nghiệm hoàn tất, chưa sử dụng miễn phí, và trong thời hạn (30 ngày kể từ khi xét nghiệm hoàn tất).'
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID của lịch hẹn xét nghiệm để kiểm tra điều kiện tư vấn miễn phí', type: String })
  async validateRelatedAppointment(@Param('appointmentId') appointmentId: string, @Req() req) {
    const userId = (req.user as any).userId;
    const result = await this.appointmentService.validateRelatedAppointment(appointmentId, userId);
    return result;
  }

  @Get('my-appointments')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem lịch hẹn của khách hàng',
    description: 'Trả về danh sách tất cả lịch hẹn của khách hàng, bao gồm thông tin dịch vụ, Consultant, mã xét nghiệm, trạng thái kết quả, và thông tin giao hàng (nếu tại nhà). Sắp xếp theo thời gian bắt đầu (mới nhất trước).'
  })
  @ApiBearerAuth('access-token')
  async getMyAppointments(@Req() req) {
    console.log('Request user:', req.user);
    const userId = (req.user as any).userId;
    if (!userId) throw new BadRequestException('Không tìm thấy userId trong token');
    return this.appointmentService.getUserAppointments(userId);
  }

  @Get('pending')
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem lịch hẹn cần xác nhận',
    description: 'Trả về danh sách các lịch hẹn ở trạng thái Pending để Staff hoặc Manager xem và xác nhận. Bao gồm thông tin người dùng, dịch vụ, và thông tin giao hàng (nếu tại nhà), sắp xếp theo thời gian tạo.'
  })
  @ApiBearerAuth('access-token')
  async getPendingAppointments() {
    return this.appointmentService.getPendingAppointments();
  }

  @Get(':appointmentId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem chi tiết lịch hẹn',
    description: 'Trả về thông tin chi tiết của một lịch hẹn dựa trên ID, bao gồm lịch sử trạng thái. Chỉ khách hàng sở hữu, Consultant liên quan, Staff, Manager, hoặc Admin có quyền truy cập, với kiểm tra quyền tương ứng.'
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID của lịch hẹn để xem chi tiết', type: String })
  async getAppointmentById(@Param('appointmentId') appointmentId: string, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.appointmentService.getAppointmentById(appointmentId, userId, role);
  }
}