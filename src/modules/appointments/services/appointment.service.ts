// src/modules/appointments/services/appointment.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentService } from '../../payment/services/payment.service';
import { CreateAppointmentDto, UpdateAppointmentDto, CreateStiAppointmentDto } from '../dtos/create-appointment.dto';
import { CreatePaymentDto } from '../../payment/dtos/create-payment.dto';
import { UpdateAppointmentStatusDto } from '../dtos/update-appointment-status.dto';
import { GetTestResultDto } from '../dtos/get-test-result.dto';

@Injectable()
export class AppointmentService {
  updateAppointment(appointmentId: string, dto: UpdateAppointmentDto) {
    throw new Error('Method not implemented.');
  }
  deleteAppointment(appointmentId: string) {
    throw new Error('Method not implemented.');
  }
  private readonly logger = new Logger(AppointmentService.name);

  constructor(private readonly prisma: PrismaService, private readonly paymentService: PaymentService) {}

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
        consultant_id: schedule.consultant_id,
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
        service_id,
      },
    });

    await this.prisma.schedule.update({
      where: { schedule_id },
      data: { is_booked: true },
    });

    return { appointment, message: 'Đặt lịch hẹn thành công' };
  }

  async createStiAppointment(dto: CreateStiAppointmentDto & { userId: string }) {
    const { serviceId, scheduleId, location } = dto;

    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id: scheduleId, is_booked: false, deleted_at: null },
    });
    if (!schedule) {
      throw new BadRequestException('Lịch trống không tồn tại hoặc đã được đặt');
    }

    const service = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null, category: 'STI' },
    });
    if (!service) {
      throw new BadRequestException('Dịch vụ xét nghiệm STIs không tồn tại');
    }

    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        consultant_id: schedule.consultant_id,
        start_time: { lte: schedule.end_time },
        end_time: { gte: schedule.start_time },
        status: { not: 'Cancelled' },
      },
    });
    if (overlapping) {
      throw new BadRequestException('Thời gian đã bị trùng với lịch hẹn khác');
    }

    const randomSuffix = Math.floor(Math.random() * 1000);
  const orderCode = Number(`${Date.now()}${randomSuffix}`);

    const paymentDto: CreatePaymentDto = {
      orderCode,
      amount: Number(service.price),
      description: `Thanh toán xét nghiệm STIs - ${service.name}`,
      cancelUrl: 'http://your-frontend.com/cancel',
      returnUrl: 'http://your-frontend.com/success',
      buyerName: dto.userId, // Có thể lấy từ User model
    };

    const paymentResponse = await this.paymentService.createPaymentLink(paymentDto);
    const paymentLink = paymentResponse.paymentLink.checkoutUrl;

    const appointment = await this.prisma.appointment.create({
      data: {
        user_id: dto.userId,
        consultant_id: schedule.consultant_id,
        type: 'Testing',
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        status: 'Pending',
        payment_status: 'Pending',
        location,
        service_id: serviceId,
      },
    });

    await this.prisma.schedule.update({
      where: { schedule_id: scheduleId },
      data: { is_booked: true },
    });

    await this.prisma.payment.create({
      data: {
        appointment_id: appointment.appointment_id,
        user_id: dto.userId,
        amount: service.price,
        order_code: orderCode as any,
        payment_method: 'BankCard',
        
        status: 'Pending',
      },
    });

    return { appointment, paymentLink, message: 'Đặt lịch xét nghiệm thành công, vui lòng thanh toán' };
  }

  async getAllAppointments() {
    return this.prisma.appointment.findMany({ where: { deleted_at: null } });
  }

  async getAppointmentById(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: { test_result: true },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }
    return { appointment };
  }

  async updateAppointmentStatus(appointmentId: string, dto: UpdateAppointmentStatusDto) {
    const { status, notes } = dto;
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: { test_result: true },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    if (appointment.type !== 'Testing') {
      throw new BadRequestException('Chỉ áp dụng cho lịch hẹn xét nghiệm');
    }

    if (status === 'Completed' && !appointment.test_result) {
      const testResultData: any = {
        appointment_id: appointmentId,
        result_data: 'Kết quả mẫu: HIV: Âm tính', // Dữ liệu mẫu, cần thay bằng logic thực tế
        status: 'Completed',
        notes,
      };
      if (appointment.service_id) {
        testResultData.service_id = appointment.service_id;
      }
      const testResult = await this.prisma.testResult.create({
        data: testResultData,
      });

      return this.prisma.appointment.update({
        where: { appointment_id: appointmentId },
        data: { status, test_result: { connect: { result_id: testResult.result_id } } },
      });
    }

    return this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: { status, updated_at: new Date() },
    });
  }

  async getTestResult(resultId: string, dto: GetTestResultDto, userId: string) {
    const { appointmentId } = dto;
    const testResult = await this.prisma.testResult.findUnique({
      where: { result_id: resultId, deleted_at: null },
    });
    if (!testResult) {
      throw new BadRequestException('Kết quả không tồn tại');
    }

    // Kiểm tra liên kết với appointment và quyền truy cập
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: { test_result: true },
    });
    if (!appointment || appointment.test_result?.result_id !== resultId || appointment.user_id !== userId) {
      throw new BadRequestException('Không có quyền truy cập hoặc mã xét nghiệm không hợp lệ');
    }

    return { result: testResult };
  }
}