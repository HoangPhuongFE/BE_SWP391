import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentService } from '../../payment/services/payment.service';
import { CreateAppointmentDto } from '../dtos/create-appointment.dto';
import { CreateStiAppointmentDto } from '../dtos/create-stis-appointment.dto';
import { UpdateAppointmentDto } from '../dtos/update-appointment.dto';
import { PaymentMethod } from '@prisma/client';
import { UpdateAppointmentStatusDto } from '../dtos/update-appointment-status.dto';
import { GetTestResultDto } from '../dtos/get-test-result.dto';
import { Role } from '@prisma/client';
import { CreatePaymentDto } from '@modules/payment/dtos/create-payment.dto';

// Hàm tạo testCode
const generateTestCode = (category: string) => {
  const prefix = (category || 'TEST').slice(0, 3).toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${random}`; // Ví dụ: STI123
};

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) { }

 
 
 async createAppointment(dto: CreateAppointmentDto & { userId: string }) {
    const { consultant_id, schedule_id, service_id, type, location, userId } = dto;

    // 1) Validate schedule, service, overlap…
    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id, is_booked: false, deleted_at: null },
    });
    if (!schedule) throw new BadRequestException('Lịch trống không tồn tại hoặc đã được đặt');

    const overlap = await this.prisma.appointment.findFirst({
      where: {
        consultant_id: schedule.consultant_id,
        start_time: { lte: schedule.end_time },
        end_time:   { gte: schedule.start_time },
        status:     { not: 'Cancelled' },
      },
    });
    if (overlap) throw new BadRequestException('Thời gian trùng lịch hẹn khác');

    const svc = await this.prisma.service.findUnique({
      where: { service_id, deleted_at: null },
    });
    if (!svc) throw new BadRequestException('Dịch vụ không tồn tại');

    // 2) Tạo appointment (Pending)
    const appt = await this.prisma.appointment.create({
      data: {
        user_id:            userId,
        consultant_id,
        type,
        start_time:         schedule.start_time,
        end_time:           schedule.end_time,
        status:             'Pending',
        payment_status:     'Pending',
        location,
        service_id,
        schedule_id,
        is_free_consultation: false,
      },
    });

    // 3) Sinh orderCode duy nhất
    let orderCode: number|null = null;
    for (let i=0; i<3; i++) {
      const cand = Number(`${Date.now()%100000}${Math.floor(Math.random()*1000)}`.padStart(8,'0'));
      if (!await this.prisma.payment.findUnique({ where: { order_code: cand } })) {
        orderCode = cand; break;
      }
    }
    if (!orderCode) throw new BadRequestException('Tạo mã thanh toán thất bại');

    // 4) Tạo DTO và gọi PaymentService
    const payDto: CreatePaymentDto = {
      orderCode,
      amount:        Number(svc.price),
      description:   `Hẹn ${svc.name}`.substring(0,25),
      cancelUrl:     'https://your-frontend/.../cancel',
      returnUrl:     'https://your-frontend/.../success',
      buyerName:     userId,
      paymentMethod: PaymentMethod.BankCard,
      appointmentId: appt.appointment_id,
    };
    const { paymentLink } = await this.paymentService.createPaymentLink(userId, payDto);

    return { appointment: appt, paymentLink, message: 'Đặt lịch thành công, vui lòng thanh toán' };
  }

  async createStiAppointment(dto: CreateStiAppointmentDto & { userId: string }) {
    const { serviceId, scheduleId, location, category, userId } = dto;

    // 1) Validate schedule & service
    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id: scheduleId, is_booked: false, deleted_at: null },
    });
    if (!schedule) throw new BadRequestException('Lịch trống không tồn tại hoặc đã được đặt');

    const svc = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null },
    });
    if (!svc) throw new BadRequestException('Dịch vụ xét nghiệm không tồn tại');

    const overlap = await this.prisma.appointment.findFirst({
      where: {
        consultant_id: schedule.consultant_id,
        start_time: { lte: schedule.end_time },
        end_time:   { gte: schedule.start_time },
        status:     { not: 'Cancelled' },
      },
    });
    if (overlap) throw new BadRequestException('Thời gian trùng lịch hẹn khác');

    // 2) Tạo appointment
    const appt = await this.prisma.appointment.create({
      data: {
        user_id:            userId,
        consultant_id:      schedule.consultant_id,
        type:               'Testing',
        start_time:         schedule.start_time,
        end_time:           schedule.end_time,
        status:             'Pending',
        payment_status:     'Pending',
        location,
        service_id:         serviceId,
        schedule_id:        scheduleId,
        is_free_consultation: false,
      },
    });

    // 3) Đánh dấu schedule booked
    await this.prisma.schedule.update({
      where: { schedule_id: scheduleId },
      data: { is_booked: true },
    });

    // 4) Sinh orderCode
    let orderCode: number|null = null;
    for (let i=0; i<3; i++) {
      const cand = Number(`${Date.now()%100000}${Math.floor(Math.random()*1000)}`.padStart(8,'0'));
      if (!await this.prisma.payment.findUnique({ where: { order_code: cand } })) {
        orderCode = cand; break;
      }
    }
    if (!orderCode) throw new BadRequestException('Tạo mã thanh toán thất bại');

    // 5) Tạo link + lưu Payment
    const payDto: CreatePaymentDto = {
      orderCode,
      amount:        Number(svc.price),
      description:   `XN ${svc.name}`.substring(0,25),
      cancelUrl:     'https://your-frontend/.../cancel',
      returnUrl:     'https://your-frontend/.../success',
      buyerName:     userId,
      paymentMethod: PaymentMethod.BankCard,
      appointmentId: appt.appointment_id,
    };
    const { paymentLink } = await this.paymentService.createPaymentLink(userId, payDto);

    // 6) Sinh testCode và lưu TestResult
    let testCode: string|null = null;
    for (let i=0; i<3; i++) {
      const cand = generateTestCode(category || svc.category || 'TEST');
      if (!await this.prisma.testResult.findFirst({ where: { test_code: cand } })) {
        testCode = cand; break;
      }
    }
    if (!testCode) throw new BadRequestException('Tạo mã xét nghiệm thất bại');

    await this.prisma.testResult.create({
      data: {
        appointment_id: appt.appointment_id,
        service_id:     serviceId,
        result_data:    'Pending',
        status:         'Pending',
        test_code:      testCode,
      },
    });

    return { appointment: appt, paymentLink, testCode, message: 'Đặt lịch xét nghiệm thành công, vui lòng thanh toán' };
  }

  async getAllAppointments() {
    const appointments = await this.prisma.appointment.findMany({ where: { deleted_at: null } });
    return { appointments, message: 'Lấy danh sách lịch hẹn thành công' };
  }

  async getAppointmentById(appointmentId: string, userId: string, role: Role) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: { test_result: true },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    // Kiểm tra quyền truy cập
    if (role === Role.Customer && appointment.user_id !== userId) {
      throw new BadRequestException('Không có quyền xem lịch hẹn này');
    }
    if (role === Role.Consultant) {
      const consultant = await this.prisma.consultantProfile.findUnique({
        where: { user_id: userId },
      });
      if (!consultant || appointment.consultant_id !== consultant.consultant_id) {
        throw new BadRequestException('Không có quyền xem lịch hẹn này');
      }
    }

    return { appointment, message: 'Lấy chi tiết lịch hẹn thành công' };
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
      const isAbnormal = notes?.includes('Positive') || notes?.includes('Abnormal') || notes?.includes('High');
      const testResultData: any = {
        appointment_id: appointmentId,
        result_data: isAbnormal ? 'Positive' : 'Negative', // Logic mẫu
        status: 'Completed',
        notes,
        is_abnormal: isAbnormal,
      };
      if (appointment.service_id) {
        testResultData.service_id = appointment.service_id;
      }
      const testResult = await this.prisma.testResult.create({
        data: testResultData,
      });

      const updatedAppointment = await this.prisma.appointment.update({
        where: { appointment_id: appointmentId },
        data: { status, test_result: { connect: { result_id: testResult.result_id } } },
      });

      return { appointment: updatedAppointment, message: 'Cập nhật trạng thái lịch hẹn thành công' };
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: { status, updated_at: new Date() },
    });

    return { appointment: updatedAppointment, message: 'Cập nhật trạng thái lịch hẹn thành công' };
  }

  async updateAppointment(appointmentId: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    // Validate thời gian nếu có
    if (dto.start_time || dto.end_time) {
      const start = dto.start_time ? new Date(dto.start_time) : appointment.start_time;
      const end = dto.end_time ? new Date(dto.end_time) : appointment.end_time;

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException('Định dạng thời gian không hợp lệ');
      }

      if (start >= end) {
        throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
      }

      const overlapping = await this.prisma.appointment.findFirst({
        where: {
          consultant_id: appointment.consultant_id,
          start_time: { lte: end },
          end_time: { gte: start },
          status: { not: 'Cancelled' },
          appointment_id: { not: appointmentId },
        },
      });
      if (overlapping) {
        throw new BadRequestException('Thời gian trùng với lịch hẹn khác');
      }
    }

    // Validate dịch vụ nếu có
    if (dto.service_id) {
      const service = await this.prisma.service.findUnique({
        where: { service_id: dto.service_id, deleted_at: null },
      });
      if (!service) {
        throw new BadRequestException('Dịch vụ không tồn tại');
      }
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: {
        ...dto,
        start_time: dto.start_time ? new Date(dto.start_time) : undefined,
        end_time: dto.end_time ? new Date(dto.end_time) : undefined,
        updated_at: new Date(),
      },
    });

    return { appointment: updatedAppointment, message: 'Cập nhật lịch hẹn thành công' };
  }

  async deleteAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: { deleted_at: new Date() },
    });

    if (appointment.schedule_id) {
      await this.prisma.schedule.update({
        where: { schedule_id: appointment.schedule_id },
        data: { is_booked: false },
      });
    }

    return { appointment: updatedAppointment, message: 'Xóa lịch hẹn thành công' };
  }

  async getTestResult(resultId: string, dto: GetTestResultDto, userId: string) {
    const { appointmentId, testCode } = dto;

    const testResult = await this.prisma.testResult.findFirst({
      where: {
        OR: [
          { result_id: resultId, deleted_at: null },
          { test_code: testCode, deleted_at: null },
        ],
      },
    });
    if (!testResult) {
      throw new BadRequestException('Kết quả xét nghiệm không tồn tại');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: { test_result: true },
    });
    if (
      !appointment ||
      (appointment.test_result?.result_id !== testResult.result_id && appointment.test_result?.test_code !== testCode) ||
      appointment.user_id !== userId
    ) {
      throw new BadRequestException('Không có quyền truy cập hoặc mã xét nghiệm không hợp lệ');
    }

    return { result: testResult, message: 'Lấy kết quả xét nghiệm thành công' };
  }
}