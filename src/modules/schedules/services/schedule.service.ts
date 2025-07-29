import { Injectable, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateScheduleDto } from '../dtos/create-schedule.dto';
import { UpdateScheduleDto } from '../dtos/update-schedule.dto';
import { AppointmentStatus, NotificationStatus, NotificationType, Role, Service, ServiceType } from '@prisma/client';
import { BatchCreateScheduleDto } from '../dtos/batch-create-schedule.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) { }

  // API tạo lịch trống từng đợt
  async createSchedule(consultantId: string, dto: CreateScheduleDto) {
    const { start_time, end_time, service_id } = dto;
    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();

    // Kiểm tra định dạng và thời gian
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Định dạng thời gian không hợp lệ');
    }
    if (start <= now) {
      throw new BadRequestException('Thời gian bắt đầu phải trong tương lai');
    }
    if (start >= end) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }
    const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 2 tháng
    if (start.getFullYear() > now.getFullYear() || start > maxDate) {
      throw new BadRequestException('Lịch phải trong vòng 2 tháng và không trước năm sau');
    }
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours > 2) {
      throw new BadRequestException('Lịch không được dài quá 2 giờ');
    }

    // Kiểm tra Consultant
    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { consultant_id: consultantId },
    });
    if (!consultant || !consultant.is_verified) {
      throw new BadRequestException('Consultant không tồn tại hoặc chưa được xác minh');
    }

    // Kiểm tra dịch vụ
    const service = await this.prisma.service.findUnique({
      where: { service_id, deleted_at: null },
    });
    if (!service || service.type !== ServiceType.Consultation) {
      throw new BadRequestException('Dịch vụ không tồn tại hoặc không phải tư vấn');
    }

    // Kiểm tra giới hạn lịch trống mỗi ngày
    const startOfDay = new Date(start);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(start);
    endOfDay.setHours(23, 59, 59, 999);
    const dailySchedules = await this.prisma.schedule.count({
      where: {
        consultant_id: consultantId,
        start_time: { gte: startOfDay, lte: endOfDay },
        deleted_at: null,
      },
    });
    const maxSchedulesPerDay = 5;
    if (dailySchedules >= maxSchedulesPerDay) {
      throw new BadRequestException(`Vượt quá giới hạn ${maxSchedulesPerDay} lịch trống mỗi ngày`);
    }

    // Kiểm tra trùng lịch hẹn
    const overlappingAppointment = await this.prisma.appointment.findFirst({
      where: {
        consultant_id: consultantId,
        start_time: { lte: end },
        end_time: { gte: start },
        status: { not: AppointmentStatus.Cancelled },
        deleted_at: null,
      },
    });
    if (overlappingAppointment) {
      throw new BadRequestException('Thời gian trùng với lịch hẹn khác');
    }

    // Kiểm tra trùng lịch trống
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

    // Tạo lịch
    const schedule = await this.prisma.schedule.create({
      data: {
        consultant_id: consultantId,
        service_id,
        start_time: start,
        end_time: end,
      },
    });

    // Gửi thông báo
    await this.prisma.notification.create({
      data: {
        user_id: consultant.user_id,
        type: NotificationType.Email,
        title: 'Tạo lịch trống thành công',
        content: `Lịch trống từ ${start.toISOString()} đến ${end.toISOString()} cho dịch vụ ${service.name} đã được tạo.`,
        status: NotificationStatus.Pending,
      },
    });

    return {
      schedule,
      serviceName: service.name,
      message: 'Tạo lịch trống thành công',
    };
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

    // Kiểm tra lịch đã được đặt
    if (schedule.is_booked) {
      throw new BadRequestException('Lịch đã được đặt, không thể cập nhật');
    }

    const now = new Date();
    const start = dto.start_time ? new Date(dto.start_time) : schedule.start_time;
    const end = dto.end_time ? new Date(dto.end_time) : schedule.end_time;
    const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 2 tháng

    // Kiểm tra thời gian
    if ((dto.start_time || dto.end_time) && (isNaN(start.getTime()) || isNaN(end.getTime()))) {
      throw new BadRequestException('Định dạng thời gian không hợp lệ');
    }
    if (dto.start_time || dto.end_time) {
      if (start <= now) {
        throw new BadRequestException('Thời gian bắt đầu phải trong tương lai');
      }
      if (start >= end) {
        throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
      }
      if (start.getFullYear() > now.getFullYear() || start > maxDate) {
        throw new BadRequestException('Lịch phải trong vòng 2 tháng và không trước năm sau');
      }
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (durationHours > 2) {
        throw new BadRequestException('Lịch không được dài quá 2 giờ');
      }
    }

    // Kiểm tra Consultant
    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { consultant_id: schedule.consultant_id },
    });
    if (!consultant || !consultant.is_verified) {
      throw new BadRequestException('Consultant không tồn tại hoặc chưa được xác minh');
    }

    // Kiểm tra dịch vụ
    let service: Service | null = null;
    if (dto.service_id) {
      service = await this.prisma.service.findUnique({
        where: { service_id: dto.service_id, deleted_at: null },
      });
      if (!service || service.type !== ServiceType.Consultation) {
        throw new BadRequestException('Dịch vụ không tồn tại hoặc không phải tư vấn');
      }
    }

    // Kiểm tra trùng lịch hẹn
    if (dto.start_time || dto.end_time) {
      const overlappingAppointment = await this.prisma.appointment.findFirst({
        where: {
          consultant_id: schedule.consultant_id,
          start_time: { lte: end },
          end_time: { gte: start },
          status: { not: AppointmentStatus.Cancelled },
          deleted_at: null,
        },
      });
      if (overlappingAppointment) {
        throw new BadRequestException('Thời gian trùng với lịch hẹn khác');
      }

      // Kiểm tra trùng lịch trống
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

    // Kiểm tra giới hạn lịch trống mỗi ngày
    if (dto.start_time) {
      const startOfDay = new Date(start);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(start);
      endOfDay.setHours(23, 59, 59, 999);
      const dailySchedules = await this.prisma.schedule.count({
        where: {
          consultant_id: schedule.consultant_id,
          start_time: { gte: startOfDay, lte: endOfDay },
          deleted_at: null,
          schedule_id: { not: scheduleId },
        },
      });
      const maxSchedulesPerDay = 5; // Hoặc lấy từ schedule.max_appointments_per_day
      if (dailySchedules >= maxSchedulesPerDay) {
        throw new BadRequestException('Vượt quá giới hạn 5 lịch trống mỗi ngày');
      }
    }

    // Cập nhật lịch
    const updatedSchedule = await this.prisma.schedule.update({
      where: { schedule_id: scheduleId },
      data: {
        start_time: dto.start_time ? new Date(dto.start_time) : undefined,
        end_time: dto.end_time ? new Date(dto.end_time) : undefined,
        service_id: dto.service_id,
      },
    });

    // Gửi thông báo
    if (consultant) {
      const currentService = service || (await this.prisma.service.findUnique({
        where: { service_id: updatedSchedule.service_id },
      }));
      await this.prisma.notification.create({
        data: {
          user_id: consultant.user_id,
          type: NotificationType.Email,
          title: 'Cập nhật lịch trống thành công',
          content: `Lịch trống ${scheduleId} đã được cập nhật cho dịch vụ ${currentService?.name || 'không đổi'} từ ${start.toISOString()} đến ${end.toISOString()}.`,
          status: NotificationStatus.Pending,
        },
      });
    }

    // Lấy tên dịch vụ hiện tại nếu không cập nhật service_id
    const serviceName = service ? service.name : (await this.prisma.service.findUnique({
      where: { service_id: updatedSchedule.service_id },
    }))?.name;

    return {
      schedule: updatedSchedule,
      serviceName: serviceName || 'Không xác định',
      message: 'Cập nhật lịch trống thành công',
    };
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
    return this.prisma.consultantProfile.findFirst({
      where: { user_id: userId },
    });
  }

  async getScheduleWithConsultant(scheduleId: string) {
    return this.prisma.schedule.findUnique({
      where: { schedule_id: scheduleId, deleted_at: null },
      include: { consultant: true },
    });
  }

  async getConsultantProfileById(consultantId: string) {
    return this.prisma.consultantProfile.findUnique({
      where: { consultant_id: consultantId },
    });
  }

  // API tạo hàng loạt lịch trống
  async batchCreateSchedules(consultantId: string, dto: BatchCreateScheduleDto) {
    const { start_time, end_time, duration_minutes, service_id } = dto;
    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();
    const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 2 tháng

    // Kiểm tra thời gian
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('Thời gian không hợp lệ');
    }
    if (start <= now || start > maxDate || start.getFullYear() > now.getFullYear()) {
      throw new BadRequestException('Thời gian phải trong tương lai, trong 2 tháng, và không trước năm sau');
    }
    if (duration_minutes < 15 || duration_minutes > 120) {
      throw new BadRequestException('Thời lượng slot phải từ 15 đến 120 phút');
    }

    // Kiểm tra Consultant
    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { consultant_id: consultantId },
    });
    if (!consultant || !consultant.is_verified) {
      throw new BadRequestException('Consultant không tồn tại hoặc chưa được xác minh');
    }

    // Kiểm tra dịch vụ
    const service = await this.prisma.service.findUnique({
      where: { service_id, deleted_at: null },
    });
    if (!service || service.type !== ServiceType.Consultation) {
      throw new BadRequestException('Dịch vụ không tồn tại hoặc không phải tư vấn');
    }

    // Kiểm tra giới hạn lịch trống mỗi ngày
    const startOfDay = new Date(start);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(start);
    endOfDay.setHours(23, 59, 59, 999);
    const dailySchedules = await this.prisma.schedule.count({
      where: {
        consultant_id: consultantId,
        start_time: { gte: startOfDay, lte: endOfDay },
        deleted_at: null,
      },
    });
    const maxSchedulesPerDay = 5; // Hoặc lấy từ service.max_appointments_per_day
    const totalSlots = Math.floor((end.getTime() - start.getTime()) / (duration_minutes * 60 * 1000));
    if (dailySchedules + totalSlots > maxSchedulesPerDay) {
      throw new BadRequestException(`Số lịch trống vượt quá giới hạn ${maxSchedulesPerDay} mỗi ngày`);
    }

    // Kiểm tra trùng lặp toàn bộ khoảng thời gian
    const isOverlapping = await this.prisma.$transaction([
      this.prisma.appointment.findFirst({
        where: {
          consultant_id: consultantId,
          start_time: { lte: end },
          end_time: { gte: start },
          status: { not: AppointmentStatus.Cancelled },
          deleted_at: null,
        },
      }),
      this.prisma.schedule.findFirst({
        where: {
          consultant_id: consultantId,
          start_time: { lte: end },
          end_time: { gte: start },
          deleted_at: null,
        },
      }),
    ]);
    const [overlappingAppointment, overlappingSchedule] = isOverlapping;
    if (overlappingAppointment || overlappingSchedule) {
      throw new BadRequestException('Khoảng thời gian trùng với lịch hẹn hoặc lịch trống khác');
    }

    // Tạo các lịch trống
    const createdSchedules: Array<Awaited<ReturnType<typeof this.prisma.schedule.create>>> = [];
    let slotStart = new Date(start);

    while (slotStart < end) {
      const slotEnd = new Date(slotStart.getTime() + duration_minutes * 60 * 1000);
      if (slotEnd > end) break;

      const schedule = await this.prisma.schedule.create({
        data: {
          consultant_id: consultantId,
          service_id,
          start_time: slotStart,
          end_time: slotEnd,
        },
      });
      createdSchedules.push(schedule);
      slotStart = slotEnd;
    }

    // Gửi thông báo
    if (createdSchedules.length > 0) {
      await this.prisma.notification.create({
        data: {
          user_id: consultant.user_id,
          type: NotificationType.Email,
          title: 'Tạo hàng loạt lịch trống thành công',
          content: `Đã tạo ${createdSchedules.length} lịch trống cho dịch vụ ${service.name} từ ${start.toISOString()} đến ${end.toISOString()}.`,
          status: NotificationStatus.Pending,
        },
      });
    }

    return {
      created: createdSchedules.length,
      schedules: createdSchedules,
      serviceName: service.name,
      message: createdSchedules.length > 0 ? 'Tạo hàng loạt lịch trống thành công' : 'Không tạo được lịch do thời gian không hợp lệ',
    };
  }

}