// src/modules/appointments/services/appointment.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../dtos/create-appointment.dto';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createAppointment(dto: CreateAppointmentDto & { userId: string }) {
    const { consultant_id, schedule_id, service_id, type, status, payment_status, location, userId } = dto;

    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id, is_booked: false, deleted_at: null },
    });
    if (!schedule) {
      throw new BadRequestException('Lịch trống không tồn tại hoặc đã được đặt');
    }

    const service = await this.prisma.service.findUnique({
      where: { service_id, deleted_at: null },
    });
    if (!service) {
      throw new BadRequestException('Dịch vụ không tồn tại');
    }

    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        consultant_id,
        start_time: { lte: schedule.end_time },
        end_time: { gte: schedule.start_time },
        status: { not: 'Cancelled' },
      },
    });
    if (overlapping) {
      throw new BadRequestException('Thời gian đã bị trùng với lịch hẹn khác');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        user_id: userId,
        consultant_id,
        type,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        status,
        payment_status,
        location,
        service_id, // Sử dụng service_id trực tiếp
      },
    });

    await this.prisma.schedule.update({
      where: { schedule_id },
      data: { is_booked: true },
    });

    return { appointment, message: 'Đặt lịch hẹn thành công' };
  }

  async getAllAppointments() {
    return this.prisma.appointment.findMany({ where: { deleted_at: null } });
  }

  async getAppointmentById(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }
    return { appointment };
  }

  async updateAppointment(appointmentId: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    if (dto.status && dto.status !== appointment.status) {
      const overlapping = await this.prisma.appointment.findFirst({
        where: {
          consultant_id: appointment.consultant_id,
          appointment_id: { not: appointmentId },
          start_time: { lte: appointment.end_time },
          end_time: { gte: appointment.start_time },
          status: { not: 'Cancelled' },
        },
      });
      if (overlapping) {
        throw new BadRequestException('Thời gian đã bị trùng với lịch hẹn khác');
      }
    }

    return this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: dto,
    });
  }

  async deleteAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    return this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: { deleted_at: new Date() },
    });
  }
}