// src/modules/schedules/controllers/schedule.controller.ts
import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ScheduleService } from '../services/schedule.service';
import { CreateScheduleDto, UpdateScheduleDto } from '../dtos/create-schedule.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Schedules')
@Controller('consultants/:consultantId/schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo lịch trống cho Consultant' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateScheduleDto })
  async createSchedule(@Param('consultantId') consultantId: string, @Body() dto: CreateScheduleDto, @Req() req) {
    const userId = (req.user as any).userId;
    const consultant = await this.scheduleService.getConsultantProfile(userId);
    if (!consultant || consultant.consultant_id !== consultantId) {
      throw new BadRequestException('Không có quyền tạo lịch cho Consultant này');
    }
    return this.scheduleService.createSchedule(consultantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Xem tất cả lịch trống của Consultant' })
  @ApiBearerAuth('access-token')
  async getAllSchedules(@Param('consultantId') consultantId: string) {
    return this.scheduleService.getAllSchedules(consultantId);
  }

  @Get(':scheduleId')
  @ApiOperation({ summary: 'Xem chi tiết lịch trống theo ID' })
  @ApiBearerAuth('access-token')
  async getScheduleById(@Param('scheduleId') scheduleId: string) {
    return this.scheduleService.getScheduleById(scheduleId);
  }

  @Patch(':scheduleId')
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật lịch trống' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateScheduleDto })
  async updateSchedule(@Param('scheduleId') scheduleId: string, @Body() dto: UpdateScheduleDto, @Req() req) {
    const userId = (req.user as any).userId;
    const schedule = await this.scheduleService.getScheduleWithConsultant(scheduleId);
    if (!schedule || schedule.consultant.user_id !== userId) {
      throw new BadRequestException('Không có quyền cập nhật lịch này');
    }
    return this.scheduleService.updateSchedule(scheduleId, dto);
  }

  @Delete(':scheduleId')
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xóa lịch trống' })
  @ApiBearerAuth('access-token')
  async deleteSchedule(@Param('scheduleId') scheduleId: string, @Req() req) {
    const userId = (req.user as any).userId;
    const schedule = await this.scheduleService.getScheduleWithConsultant(scheduleId);
    if (!schedule || schedule.consultant.user_id !== userId) {
      throw new BadRequestException('Không có quyền xóa lịch này');
    }
    return this.scheduleService.deleteSchedule(scheduleId);
  }
}