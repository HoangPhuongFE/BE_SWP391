// src/modules/appointments/controllers/appointment.controller.ts
import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../dtos/create-appointment.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo lịch hẹn' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateAppointmentDto })
  async createAppointment(@Body() dto: CreateAppointmentDto, @Req() req) {
    const userId = (req.user as any).userId; // Lấy từ token
    return this.appointmentService.createAppointment({ ...dto, userId });
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
}