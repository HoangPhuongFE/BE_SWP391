import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ScheduleService } from '../services/schedule.service';
import { CreateScheduleDto } from '../dtos/create-schedule.dto';
import { UpdateScheduleDto } from '../dtos/update-schedule.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Schedules')
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo lịch trống cho Consultant' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateScheduleDto })
  async createSchedule(@Body() dto: CreateScheduleDto, @Req() req) {
    const userId = (req.user as any).userId;
    const consultant = await this.scheduleService.getConsultantProfile(userId);
    if (!consultant) {
      throw new BadRequestException('Không tìm thấy hồ sơ Consultant');
    }
    return this.scheduleService.createSchedule(consultant.consultant_id, dto);
  }

  @Get()
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Consultant xem tất cả lịch trống của chính mình' })
  @ApiBearerAuth('access-token')
  async getAllSchedules(@Req() req) {
    const userId = (req.user as any).userId;
    const consultant = await this.scheduleService.getConsultantProfile(userId);
    if (!consultant) {
      throw new BadRequestException('Không tìm thấy hồ sơ Consultant');
    }
    return this.scheduleService.getAllSchedules(consultant.consultant_id);
  }

  @Get(':scheduleId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem chi tiết lịch trống theo ID' })
  @ApiBearerAuth('access-token')
  async getScheduleById(@Param('scheduleId') scheduleId: string, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    
    const schedule = await this.scheduleService.getScheduleWithConsultant(scheduleId);
    if (!schedule) {
      throw new BadRequestException('Lịch không tồn tại');
    }
    
    // Consultant chỉ xem lịch của chính họ, Manager có thể xem bất kỳ lịch nào
    if (role === Role.Consultant) {
      const consultant = await this.scheduleService.getConsultantProfile(userId);
      if (!consultant || schedule.consultant_id !== consultant.consultant_id) {
        throw new BadRequestException('Không có quyền xem lịch này');
      }
    } else if (role !== Role.Manager) {
      throw new BadRequestException('Không có quyền xem lịch này');
    }
    
    return { schedule };
  }

  @Get('consultants/:consultantId')
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Manager xem tất cả lịch trống của một Consultant' })
  @ApiBearerAuth('access-token')
  async getConsultantSchedules(@Param('consultantId') consultantId: string) {
    const consultant = await this.scheduleService.getConsultantProfileById(consultantId);
    if (!consultant) {
      throw new BadRequestException('Không tìm thấy hồ sơ Consultant');
    }
    return this.scheduleService.getAllSchedules(consultantId);
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