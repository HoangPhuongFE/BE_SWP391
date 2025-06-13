import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto } from '../dtos/create-appointment.dto';
import { CreateStiAppointmentDto } from '../dtos/create-stis-appointment.dto';
import { UpdateAppointmentDto } from '../dtos/update-appointment.dto';
import { UpdateAppointmentStatusDto } from '../dtos/update-appointment-status.dto';
import { GetTestResultDto } from '../dtos/get-test-result.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo lịch hẹn tư vấn hoặc xét nghiệm' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateAppointmentDto })
  async createAppointment(@Body() dto: CreateAppointmentDto, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.createAppointment({ ...dto, userId });
  }

    @Post('sti')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Đặt lịch xét nghiệm STI hoặc xét nghiệm khác' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateStiAppointmentDto })
  async createStiAppointment(
    @Req() req,
    @Body() dto: CreateStiAppointmentDto,
  ) {
    const userId = (req.user as any).userId;
    return this.appointmentService.createStiAppointment({ ...dto, userId });
  }

   @Get()
  @Roles(Role.Staff, Role.Manager)   
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem tất cả lịch hẹn (Staff/Manager/Admin)' })
  @ApiBearerAuth('access-token')
  async getAllAppointments() {
    return this.appointmentService.getAllAppointments();
  }

  @Get(':appointmentId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem chi tiết lịch hẹn theo ID' })
  @ApiBearerAuth('access-token')
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
  async updateAppointmentStatus(@Param('appointmentId') appointmentId: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.appointmentService.updateAppointmentStatus(appointmentId, dto);
  }

  @Patch(':appointmentId')
  @Roles(Role.Staff, Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật thông tin lịch hẹn' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateAppointmentDto })
  async updateAppointment(@Param('appointmentId') appointmentId: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentService.updateAppointment(appointmentId, dto);
  }

  @Delete(':appointmentId')
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xóa lịch hẹn (xóa mềm)' })
  @ApiBearerAuth('access-token')
  async deleteAppointment(@Param('appointmentId') appointmentId: string) {
    return this.appointmentService.deleteAppointment(appointmentId);
  }

  
  @Get('test-results/:testCode')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy kết quả xét nghiệm theo mã testCode' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'testCode', required: true, description: 'Mã xét nghiệm' })
  async getTestResultByCode(
    @Param('testCode') testCode: string,
    @Req() req
  ) {
    const userId = (req.user as any).userId;
    return this.appointmentService.getTestResultByCode(testCode, userId);
  }

}