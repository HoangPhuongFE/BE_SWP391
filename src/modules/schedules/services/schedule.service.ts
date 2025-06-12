// src/modules/schedules/services/schedule.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateScheduleDto, } from '../dtos/create-schedule.dto';
import { UpdateScheduleDto } from '../dtos/update-schedule.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(consultantId: string, dto: CreateScheduleDto) {
  const { start_time, end_time, service_id } = dto;
  const start = new Date(start_time);
  const end = new Date(end_time);
  const now = new Date();

  // Kiểm tra định dạng thời gian
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestException('Định dạng thời gian không hợp lệ');
  }

  // Kiểm tra thời gian trong tương lai
  if (start <= now) {
    throw new BadRequestException('Thời gian bắt đầu phải trong tương lai');
  }

  // Kiểm tra end_time sau start_time
  if (start >= end) {
    throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
  }

  // Kiểm tra độ dài lịch (tối đa 4 giờ)
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (durationHours > 4) {
    throw new BadRequestException('Lịch không được dài quá 4 giờ');
  }

  // Kiểm tra dịch vụ
  const service = await this.prisma.service.findUnique({
    where: { service_id, deleted_at: null },
  });
  if (!service) {
    throw new BadRequestException('Dịch vụ không tồn tại');
  }

  // Kiểm tra trùng với lịch hẹn
  const overlappingAppointment = await this.prisma.appointment.findFirst({
    where: {
      consultant_id: consultantId,
      start_time: { lte: end },
      end_time: { gte: start },
      status: { not: 'Cancelled' },
    },
  });
  if (overlappingAppointment) {
    throw new BadRequestException('Thời gian trùng với lịch hẹn khác');
  }

  // Kiểm tra trùng với lịch trống khác
  const overlappingSchedule = await this.prisma.schedule.findFirst({
    where: {
      consultant_id: consultantId,
      start_time: { lte: end },
      end_time: { gte: start },
      deleted_at: null,
    },
  });
  if (overlappingSchedule) {
    throw new BadRequestException('Thời gian trùng với lịch trống khác');
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
  async getConsultantProfileById(consultantId: string) {
  return this.prisma.consultantProfile.findUnique({
    where: { consultant_id: consultantId },
  });
}
}