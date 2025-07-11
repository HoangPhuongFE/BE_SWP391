import { Injectable, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateScheduleDto } from '../dtos/create-schedule.dto';
import { UpdateScheduleDto } from '../dtos/update-schedule.dto';
import { Role, ServiceType } from '@prisma/client';
import { BatchCreateScheduleDto } from '../dtos/batch-create-schedule.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(consultantId: string, dto: CreateScheduleDto) {
    const { start_time, end_time, service_id } = dto;
    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Định dạng thời gian không hợp lệ');
    }

    if (start <= now) {
      throw new BadRequestException('Thời gian bắt đầu phải trong tương lai');
    }

    if (start >= end) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours > 2) {
      throw new BadRequestException('Lịch không được dài quá 2 giờ');
    }

    const service = await this.prisma.service.findUnique({
      where: { service_id, deleted_at: null },
    });
    if (!service || service.type !== ServiceType.Consultation) {
      throw new BadRequestException('Dịch vụ không tồn tại hoặc không phải tư vấn');
    }

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
      include: { service: { select: { name: true } } },
    });
  }

  async getScheduleById(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id: scheduleId, deleted_at: null },
      include: { service: { select: { name: true } } },
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

    const start = dto.start_time ? new Date(dto.start_time) : schedule.start_time;
    const end = dto.end_time ? new Date(dto.end_time) : schedule.end_time;

    if ((dto.start_time || dto.end_time) && (isNaN(start.getTime()) || isNaN(end.getTime()))) {
      throw new BadRequestException('Định dạng thời gian không hợp lệ');
    }

    if (dto.start_time || dto.end_time) {
      if (start >= end) {
        throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
      }

      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (durationHours > 2) {
        throw new BadRequestException('Lịch không được dài quá 2 giờ');
      }

      const overlappingAppointment = await this.prisma.appointment.findFirst({
        where: {
          consultant_id: schedule.consultant_id,
          start_time: { lte: end },
          end_time: { gte: start },
          status: { not: 'Cancelled' },
          appointment_id: { not: scheduleId },
        },
      });
      if (overlappingAppointment) {
        throw new BadRequestException('Thời gian trùng với lịch hẹn khác');
      }

      const overlappingSchedule = await this.prisma.schedule.findFirst({
        where: {
          consultant_id: schedule.consultant_id,
          start_time: { lte: end },
          end_time: { gte: start },
          deleted_at: null,
          schedule_id: { not: scheduleId },
        },
      });
      if (overlappingSchedule) {
        throw new BadRequestException('Thời gian trùng với lịch trống khác');
      }
    }

    if (dto.service_id) {
      const service = await this.prisma.service.findUnique({
        where: { service_id: dto.service_id, deleted_at: null },
      });
      if (!service || service.type !== ServiceType.Consultation) {
        throw new BadRequestException('Dịch vụ không tồn tại hoặc không phải tư vấn');
      }
    }

    return this.prisma.schedule.update({
      where: { schedule_id: scheduleId },
      data: {
        start_time: dto.start_time ? new Date(dto.start_time) : undefined,
        end_time: dto.end_time ? new Date(dto.end_time) : undefined,
        service_id: dto.service_id,
      },
    });
  }

 async deleteSchedule(scheduleId: string, userId: string, userRole: Role) {
  const schedule = await this.prisma.schedule.findUnique({
    where: { schedule_id: scheduleId, deleted_at: null },
    include: {  
      appointment: {
        include: {
          shipping_info: true,
          return_shipping_info: true,
          payments: true,
          test_result: true,
          status_history: true,
        },
      },
      consultant: {
        select: { user_id: true },
      },
    },
  });

  if (!schedule) {
    throw new BadRequestException('Lịch không tồn tại');
  }

  // Kiểm tra quyền xóa
  if (schedule.is_booked && userRole !== Role.Manager && userRole !== Role.Staff) {
    throw new ForbiddenException('Chỉ Manager hoặc Staff được phép xóa lịch đã được đặt');
  }

  if (!schedule.is_booked && userRole === Role.Consultant && schedule.consultant.user_id !== userId) {
    throw new ForbiddenException('Tư vấn viên chỉ được xóa lịch của chính mình');
  }

  // Bắt đầu transaction để đảm bảo tính toàn vẹn dữ liệu
  await this.prisma.$transaction(async (prisma) => {
    // Soft delete Schedule
    await prisma.schedule.update({
      where: { schedule_id: scheduleId },
      data: { deleted_at: new Date() },
    });

    // Nếu có Appointment liên quan, soft delete Appointment và các bảng liên quan
    if (schedule.appointment) {
      await prisma.appointment.update({
        where: { appointment_id: schedule.appointment.appointment_id },
        data: { 
          deleted_at: new Date(),
          status: 'Cancelled', // Cập nhật trạng thái thành Cancelled
        },
      });

      // Soft delete ShippingInfo
      if (schedule.appointment.shipping_info) {
        await prisma.shippingInfo.update({
          where: { id: schedule.appointment.shipping_info.id },
          data: { deleted_at: new Date() },
        });
      }

      // Soft delete ReturnShippingInfo
      if (schedule.appointment.return_shipping_info) {
        await prisma.returnShippingInfo.update({
          where: { id: schedule.appointment.return_shipping_info.id },
          data: { deleted_at: new Date() },
        });
      }

      // Soft delete Payments
      await prisma.payment.updateMany({
        where: { appointment_id: schedule.appointment.appointment_id },
        data: { deleted_at: new Date() },
      });

      // Soft delete TestResult
      if (schedule.appointment.test_result) {
        await prisma.testResult.update({
          where: { result_id: schedule.appointment.test_result.result_id },
          data: { deleted_at: new Date() },
        });
      }

      // Soft delete AppointmentStatusHistory
      await prisma.appointmentStatusHistory.updateMany({
        where: { appointment_id: schedule.appointment.appointment_id },
        data: { deleted_at: new Date() },
      });
    }

    // Ghi log hành động vào AuditLog
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE_SCHEDULE',
        entity_type: 'Schedule',
        entity_id: scheduleId,
        details: { message: `Schedule ${scheduleId} deleted by user ${userId} with role ${userRole}` },
        created_at: new Date(),
      },
    });
  });

  this.logger.log(`Schedule ${scheduleId} deleted by user ${userId} with role ${userRole}`);
  return { message: 'Xóa lịch thành công' };
}

  async getConsultantProfile(userId: string) {
    return this.prisma.consultantProfile.findUnique({
      where: { user_id: userId },
    });
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

  async batchCreateSchedules(consultantId: string, dto: BatchCreateScheduleDto) {
  const { start_time, end_time, duration_minutes, service_id } = dto;
  const start = new Date(start_time);
  const end = new Date(end_time);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new BadRequestException('Thời gian không hợp lệ');
  }

  if (start <= now) {
    throw new BadRequestException('Thời gian bắt đầu phải trong tương lai');
  }

  const service = await this.prisma.service.findUnique({
    where: { service_id, deleted_at: null },
  });
  if (!service || service.type !== ServiceType.Consultation) {
    throw new BadRequestException('Dịch vụ không tồn tại hoặc không phải tư vấn');
  }

  const createdSchedules: Array<Awaited<ReturnType<typeof this.prisma.schedule.create>>> = [];
  let slotStart = new Date(start);

  while (slotStart < end) {
    const slotEnd = new Date(slotStart.getTime() + duration_minutes * 60 * 1000);

    if (slotEnd > end) break;

    const isOverlapping = await this.prisma.$transaction([
      this.prisma.appointment.findFirst({
        where: {
          consultant_id: consultantId,
          start_time: { lte: slotEnd },
          end_time: { gte: slotStart },
          status: { not: 'Cancelled' },
        },
      }),
      this.prisma.schedule.findFirst({
        where: {
          consultant_id: consultantId,
          start_time: { lte: slotEnd },
          end_time: { gte: slotStart },
          deleted_at: null,
        },
      }),
    ]);

    const [overlappingAppointment, overlappingSchedule] = isOverlapping;

    if (!overlappingAppointment && !overlappingSchedule) {
      const schedule = await this.prisma.schedule.create({
        data: {
          consultant_id: consultantId,
          service_id,
          start_time: slotStart,
          end_time: slotEnd,
        },
      });
      createdSchedules.push(schedule);
    }

    slotStart = slotEnd;
  }

  return { created: createdSchedules.length, schedules: createdSchedules };
}

}