import { Controller, Post, Get, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Tạo lịch hẹn tư vấn' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateAppointmentDto })
  async createAppointment(@Body() dto: CreateAppointmentDto, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.createAppointment({ ...dto, userId });
  }

  @Post('sti')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Đặt lịch xét nghiệm (customer chọn ngày và buổi)' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateStiAppointmentDto })
  async createStiAppointment(@Req() req, @Body() dto: CreateStiAppointmentDto) {
    const userId = (req.user as any).userId;
    return this.appointmentService.createStiAppointment({ ...dto, userId });
  }

  @Get()
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem tất cả lịch hẹn (Staff/Manager)' })
  @ApiBearerAuth('access-token')
  async getAllAppointments() {
    return this.appointmentService.getAllAppointments();
  }

  @Get(':appointmentId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem chi tiết lịch hẹn theo ID' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn' })
  async getAppointmentById(@Param('appointmentId') appointmentId: string, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.appointmentService.getAppointmentById(appointmentId, userId, role);
  }

  @Patch(':appointmentId/status')
  @Roles(Role.Staff, Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật trạng thái lịch hẹn (chủ yếu cho xét nghiệm)' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateAppointmentStatusDto })
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn' })
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
  @ApiOperation({ summary: 'Cập nhật thông tin lịch hẹn' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateAppointmentDto })
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn' })
  async updateAppointment(@Param('appointmentId') appointmentId: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentService.updateAppointment(appointmentId, dto);
  }

  @Delete(':appointmentId')
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xóa lịch hẹn (xóa mềm)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn' })
  async deleteAppointment(@Param('appointmentId') appointmentId: string) {
    return this.appointmentService.deleteAppointment(appointmentId);
  }

  @Get('test-results/:testCode')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy kết quả xét nghiệm theo mã testCode' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'testCode', required: true, description: 'Mã xét nghiệm' })
  async getTestResult(@Param('testCode') testCode: string, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.getTestResult(testCode, userId);
  }

  @Patch(':appointmentId/confirm')
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Staff xác nhận đơn lịch hẹn (Pending → Confirmed)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn' })
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
  @ApiOperation({ summary: 'Gửi feedback và rating cho buổi tư vấn' })
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn tư vấn' })
  @ApiBody({ type: CreateFeedbackDto })
  async submitFeedback(@Param('appointmentId') appointmentId: string, @Body() dto: CreateFeedbackDto, @Req() req) {
    const userId = (req.user as any).userId;
    const result = await this.appointmentService.submitFeedback(appointmentId, dto, userId);
    return result;
  }


  @Get('validate-related/:appointmentId')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Kiểm tra điều kiện miễn phí tư vấn dựa trên ID xét nghiệm' })
  async validateRelatedAppointment(@Param('appointmentId') appointmentId: string, @Req() req) {
    const userId = (req.user as any).userId;
    const result = await this.appointmentService.validateRelatedAppointment(appointmentId, userId);
    return result;
  }

  @Get('my-appointments')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem toàn bộ lịch hẹn của khách hàng' })
  @ApiBearerAuth('access-token')
  async getMyAppointments(@Req() req) {
    const userId = req.user.userId;
    return this.appointmentService.getUserAppointments(userId);
  }

  @Get('pending')
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn cần xác nhận (Staff/Manager)' })
  @ApiBearerAuth('access-token')
  async getPendingAppointments() {
    return this.appointmentService.getPendingAppointments();
  }
}