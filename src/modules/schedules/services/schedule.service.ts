// src/modules/schedules/services/schedule.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateScheduleDto, UpdateScheduleDto } from '../dtos/create-schedule.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(consultantId: string, dto: CreateScheduleDto) {
    const { start_time, end_time, service_id } = dto;
    const start = new Date(start_time);
    const end = new Date(end_time);

    if (start >= end) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    const service = await this.prisma.service.findUnique({
      where: { service_id, deleted_at: null },
    });
    if (!service) {
      throw new BadRequestException('Dịch vụ không tồn tại');
    }

    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        consultant_id: consultantId,
        start_time: { lte: end },
        end_time: { gte: start },
        status: { not: 'Cancelled' },
      },
    });
    if (overlapping) {
      throw new BadRequestException('Thời gian đã bị trùng với lịch hẹn khác');
    }

    return this.prisma.schedule.create({
      data: {
        consultant_id: consultantId,
        service_id,
        start_time: start,
        end_time: end,
      },
    });
  }

  async getAllSchedules(consultantId: string) {
    return this.prisma.schedule.findMany({
      where: { consultant_id: consultantId, deleted_at: null },
    });
  }

  async getScheduleById(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id: scheduleId, deleted_at: null },
    });
    if (!schedule) {
      throw new BadRequestException('Lịch không tồn tại');
    }
    return { schedule };
  }

  async updateSchedule(scheduleId: string, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id: scheduleId, deleted_at: null },
    });
    if (!schedule) {
      throw new BadRequestException('Lịch không tồn tại');
    }

    if (dto.start_time && dto.end_time) {
      const start = new Date(dto.start_time);
      const end = new Date(dto.end_time);
      if (start >= end) {
        throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
      }
      const overlapping = await this.prisma.appointment.findFirst({
        where: {
          consultant_id: schedule.consultant_id,
          start_time: { lte: end },
          end_time: { gte: start },
          status: { not: 'Cancelled' },
          appointment_id: { not: scheduleId }, // Loại trừ chính nó
        },
      });
      if (overlapping) {
        throw new BadRequestException('Thời gian đã bị trùng với lịch hẹn khác');
      }
    }

    if (dto.service_id) {
      const service = await this.prisma.service.findUnique({
        where: { service_id: dto.service_id, deleted_at: null },
      });
      if (!service) {
        throw new BadRequestException('Dịch vụ không tồn tại');
      }
    }

    return this.prisma.schedule.update({
      where: { schedule_id: scheduleId },
      data: dto,
    });
  }

  async deleteSchedule(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id: scheduleId, deleted_at: null },
    });
    if (!schedule) {
      throw new BadRequestException('Lịch không tồn tại');
    }
    if (schedule.is_booked) {
      throw new BadRequestException('Không thể xóa lịch đã được đặt');
    }

    return this.prisma.schedule.update({
      where: { schedule_id: scheduleId },
      data: { deleted_at: new Date() },
    });
  }

  async getConsultantProfile(userId: string) {
    return this.prisma.consultantProfile.findUnique({ where: { user_id: userId } });
  }

  async getScheduleWithConsultant(scheduleId: string) {
    return this.prisma.schedule.findUnique({
      where: { schedule_id: scheduleId },
      include: { consultant: true },
    });
  }
}