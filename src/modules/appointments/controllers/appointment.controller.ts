// src/modules/appointments/controllers/appointment.controller.ts
import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto, UpdateAppointmentDto, CreateStiAppointmentDto  } from '../dtos/create-appointment.dto';
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
  @ApiOperation({ summary: 'Tạo lịch hẹn chung' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateAppointmentDto })
  async createAppointment(@Body() dto: CreateAppointmentDto, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.createAppointment({ ...dto, userId });
  }

  @Post('sti')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Đặt lịch xét nghiệm STIs' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateStiAppointmentDto })
  async createStiAppointment(@Body() dto: CreateStiAppointmentDto, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.createStiAppointment({ ...dto, userId });
  }

  @Get()
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem tất cả lịch hẹn' })
  @ApiBearerAuth('access-token')
  async getAllAppointments() {
    return this.appointmentService.getAllAppointments();
  }

  @Get(':appointmentId')
  @ApiOperation({ summary: 'Xem chi tiết lịch hẹn theo ID' })
  @ApiBearerAuth('access-token')
  async getAppointmentById(@Param('appointmentId') appointmentId: string) {
    return this.appointmentService.getAppointmentById(appointmentId);
  }

  @Patch(':appointmentId/status')
  @Roles(Role.Staff, Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật trạng thái xét nghiệm' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateAppointmentStatusDto })
  async updateAppointmentStatus(@Param('appointmentId') appointmentId: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.appointmentService.updateAppointmentStatus(appointmentId, dto);
  }

  @Patch(':appointmentId')
  @Roles(Role.Staff, Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật lịch hẹn' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateAppointmentDto })
  async updateAppointment(@Param('appointmentId') appointmentId: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentService.updateAppointment(appointmentId, dto);
  }

  @Delete(':appointmentId')
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xóa lịch hẹn' })
  @ApiBearerAuth('access-token')
  async deleteAppointment(@Param('appointmentId') appointmentId: string) {
    return this.appointmentService.deleteAppointment(appointmentId);
  }

  @Get('/test-results/:resultId')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Nhận kết quả xét nghiệm' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'appointmentId', required: true })
  async getTestResult(@Param('resultId') resultId: string, @Query() dto: GetTestResultDto, @Req() req) {
    const userId = (req.user as any).userId;
    return this.appointmentService.getTestResult(resultId, dto, userId);
  }
}