import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentService } from '../../payment/services/payment.service';
import { CreateAppointmentDto } from '../dtos/create-appointment.dto';
import { CreateStiAppointmentDto, TestingSession } from '../dtos/create-stis-appointment.dto';
import { UpdateAppointmentDto } from '../dtos/update-appointment.dto';
import { UpdateAppointmentStatusDto } from '../dtos/update-appointment-status.dto';
import { CreatePaymentDto } from '../../payment/dtos/create-payment.dto';
import { CreateFeedbackDto } from '../dtos/create-feedback.dto';
import { AppointmentStatus, Role, PaymentMethod, TestResultStatus, ServiceType, FeedbackStatus } from '@prisma/client';
import { ConfirmAppointmentDto } from '../dtos/confirm-appointment.dto';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  private generateTestCode(category: string): string {
    const prefix = (category || 'TEST').slice(0, 3).toUpperCase();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${random}`;
  }

  private validateStatusTransition(current: AppointmentStatus, next: AppointmentStatus): boolean {
    const validTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      Pending: [AppointmentStatus.Confirmed, AppointmentStatus.Cancelled],
      Confirmed: [AppointmentStatus.SampleCollected, AppointmentStatus.Cancelled],
      SampleCollected: [AppointmentStatus.Completed, AppointmentStatus.Cancelled],
      Completed: [],
      Cancelled: [],
    };
    return validTransitions[current].includes(next);
  }

  private validateTestResultStatusTransition(
    current: TestResultStatus,
    next: TestResultStatus,
  ): boolean {
    const validTransitions: Record<TestResultStatus, TestResultStatus[]> = {
      Pending: [TestResultStatus.Processing],
      Processing: [TestResultStatus.Completed],
      Completed: [],
    };
    return validTransitions[current].includes(next);
  }

  async createAppointment(dto: CreateAppointmentDto & { userId: string }) {
  const { consultant_id, schedule_id, service_id, type, location, userId, related_appointment_id } = dto;

  const schedule = await this.prisma.schedule.findUnique({
    where: { schedule_id, is_booked: false, deleted_at: null },
  });
  if (!schedule) throw new BadRequestException('Lịch trống không tồn tại hoặc đã được đặt');

  const svc = await this.prisma.service.findUnique({
    where: { service_id, deleted_at: null },
  });
  if (!svc || svc.type !== ServiceType.Consultation) throw new BadRequestException('Dịch vụ không hợp lệ');

  if (consultant_id) {
    const consultant = await this.prisma.consultantProfile.findUnique({ where: { consultant_id } });
    if (!consultant || consultant.consultant_id !== schedule.consultant_id) throw new BadRequestException('Consultant không hợp lệ');
  }

  const overlap = await this.prisma.appointment.findFirst({
    where: { consultant_id: schedule.consultant_id, start_time: { lte: schedule.end_time }, end_time: { gte: schedule.start_time }, status: { not: 'Cancelled' } },
  });
  if (overlap) throw new BadRequestException('Thời gian trùng lịch hẹn khác');

  let isFreeConsultation = false;
  let paymentAmount = Number(svc.price);
  if (related_appointment_id) {
    const relatedAppt = await this.prisma.appointment.findUnique({ where: { appointment_id: related_appointment_id } });
    if (relatedAppt && relatedAppt.user_id === userId && relatedAppt.type === 'Testing' && relatedAppt.status === 'Completed' && !relatedAppt.deleted_at) {
      const freeConsults = await this.prisma.appointment.count({
        where: { related_appointment_id, is_free_consultation: true, deleted_at: null },
      });
      if (freeConsults < 1 && relatedAppt.free_consultation_valid_until && new Date() <= relatedAppt.free_consultation_valid_until) {
        isFreeConsultation = true;
        paymentAmount = 0;
      } else {
        throw new BadRequestException('ID xét nghiệm không hợp lệ hoặc đã hết hạn miễn phí');
      }
    } else {
      throw new BadRequestException('ID xét nghiệm không hợp lệ');
    }
  }

  const appt = await this.prisma.appointment.create({
    data: {
      user_id: userId,
      consultant_id,
      type: 'Consultation',
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      status: 'Pending',
      payment_status: isFreeConsultation ? 'Paid' : 'Pending',
      location,
      service_id,
      schedule_id,
      is_free_consultation: isFreeConsultation,
    },
  });

  await this.prisma.appointmentStatusHistory.create({
    data: {
      appointment_id: appt.appointment_id,
      status: 'Pending',
      notes: isFreeConsultation ? 'Tạo lịch hẹn tư vấn miễn phí' : 'Tạo lịch hẹn tư vấn',
      changed_by: userId,
    },
  });

  await this.prisma.schedule.update({ where: { schedule_id }, data: { is_booked: true } });

  if (!isFreeConsultation) {
    let orderCode: number | null = null;
    for (let i = 0; i < 3; i++) {
      const cand = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
      if (!await this.prisma.payment.findUnique({ where: { order_code: cand } })) {
        orderCode = cand;
        break;
      }
    }
    if (!orderCode) throw new BadRequestException('Tạo mã thanh toán thất bại');

    const payDto: CreatePaymentDto = {
      orderCode,
      amount: paymentAmount,
      description: `Hẹn ${svc.name}`.substring(0, 25),
      cancelUrl: 'https://your-frontend/.../cancel',
      returnUrl: 'https://your-frontend/.../success',
      buyerName: userId,
      paymentMethod: PaymentMethod.BankCard,
      appointmentId: appt.appointment_id,
    };
    const { paymentLink } = await this.paymentService.createPaymentLink(userId, payDto);

    return { appointment: appt, paymentLink, message: 'Đặt lịch tư vấn thành công, vui lòng thanh toán' };
  }

  return { appointment: appt, message: 'Đặt lịch tư vấn miễn phí thành công, chờ xác nhận' };
}

async createStiAppointment(dto: CreateStiAppointmentDto & { userId: string }) {
  const { serviceId, date, session, location, category = 'STI', userId } = dto;

  const appointmentDate = new Date(date);
  if (isNaN(appointmentDate.getTime())) throw new BadRequestException('Ngày không hợp lệ');
  if (appointmentDate < new Date()) throw new BadRequestException('Ngày phải trong tương lai');

  const svc = await this.prisma.service.findUnique({ where: { service_id: serviceId, deleted_at: null } });
  if (!svc || svc.type !== ServiceType.Testing) throw new BadRequestException('Dịch vụ không hợp lệ');
  if (!svc.testing_hours || !svc.daily_capacity) throw new BadRequestException('Dịch vụ chưa được cấu hình');

  const isHomeTest = svc.name.toLowerCase().includes('cơ bản');

  if (!isHomeTest && !location) {
    throw new BadRequestException('Địa điểm xét nghiệm tại viện là bắt buộc cho Gói toàn diện');
  }

  const testingHours = svc.testing_hours as { morning?: { start: string; end: string }; afternoon?: { start: string; end: string } };
  if (!testingHours[session]) throw new BadRequestException(`Buổi ${session} không hỗ trợ`);

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingAppointments = await this.prisma.appointment.count({
    where: { service_id: serviceId, start_time: { gte: startOfDay, lte: endOfDay }, status: { not: 'Cancelled' } },
  });
  if (existingAppointments >= svc.daily_capacity) throw new BadRequestException('Dung lượng đã đầy');

  const sessionHours = testingHours[session];
  const startHour = parseInt(sessionHours.start.split(':')[0]);
  const startMinute = parseInt(sessionHours.start.split(':')[1]);
  const slotDuration = 30;
  const slotsUsed = existingAppointments % Math.floor(svc.daily_capacity / 2);
  const slotStartMinutes = startMinute + slotsUsed * slotDuration;

  const startTime = new Date(appointmentDate);
  startTime.setHours(startHour, slotStartMinutes, 0, 0);
  const endTime = new Date(startTime);
  endTime.setMinutes(startTime.getMinutes() + slotDuration);

  const appt = await this.prisma.appointment.create({
    data: {
      user_id: userId,
      type: 'Testing',
      start_time: startTime,
      end_time: endTime,
      status: 'Pending',
      payment_status: 'Pending',
      location: isHomeTest ? null : location,
      service_id: serviceId,
    },
  });

  await this.prisma.appointmentStatusHistory.create({
    data: { appointment_id: appt.appointment_id, status: 'Pending', notes: 'Tạo lịch hẹn xét nghiệm', changed_by: userId },
  });

  let orderCode: number | null = null;
  for (let i = 0; i < 3; i++) {
    const cand = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
    if (!await this.prisma.payment.findUnique({ where: { order_code: cand } })) {
      orderCode = cand;
      break;
    }
  }
  if (!orderCode) throw new BadRequestException('Tạo mã thanh toán thất bại');

  const payDto: CreatePaymentDto = {
    orderCode,
    amount: Number(svc.price),
    description: `XN ${svc.name}`.substring(0, 25),
    cancelUrl: 'https://your-frontend/.../cancel',
    returnUrl: 'https://your-frontend/.../success',
    buyerName: userId,
    paymentMethod: PaymentMethod.BankCard,
    appointmentId: appt.appointment_id,
  };
  const { paymentLink } = await this.paymentService.createPaymentLink(userId, payDto);

  let testCode: string | null = null;
  for (let i = 0; i < 3; i++) {
    const cand = this.generateTestCode(category);
    if (!await this.prisma.testResult.findFirst({ where: { test_code: cand } })) {
      testCode = cand;
      break;
    }
  }
  if (!testCode) throw new BadRequestException('Tạo mã xét nghiệm thất bại');

  const testResult = await this.prisma.testResult.create({
    data: { appointment_id: appt.appointment_id, service_id: serviceId, result_data: 'Pending', status: 'Pending', test_code: testCode },
  });

  await this.prisma.testResultStatusHistory.create({
    data: { result_id: testResult.result_id, status: 'Pending', notes: 'Kết quả xét nghiệm được khởi tạo', changed_by: userId },
  });

  this.logger.log(`Tạo lịch xét nghiệm ${appt.appointment_id} bởi user ${userId}`);

  return { 
    appointment: appt, 
    paymentLink, 
    testCode, 
    message: 'Đặt lịch xét nghiệm thành công', 
    return_address: svc.return_address, 
    return_phone: svc.return_phone 
  };
}




 
async updateAppointmentStatus(appointmentId: string, dto: UpdateAppointmentStatusDto, staffId: string) {
  const { status, notes, sampleCollectedDate, testResultDetails, resultDate } = dto;

  const appointment = await this.prisma.appointment.findUnique({
    where: { appointment_id: appointmentId, deleted_at: null },
    include: { test_result: true, user: true, service: true },
  });
  if (!appointment) throw new BadRequestException('Lịch hẹn không tồn tại');
  if (appointment.type !== 'Testing') throw new BadRequestException('Chỉ áp dụng cho lịch hẹn xét nghiệm');
  if (status === AppointmentStatus.SampleCollected && appointment.status !== AppointmentStatus.Confirmed) {
    throw new BadRequestException('Lịch hẹn phải được xác nhận trước khi lấy mẫu');
  }
  if (!this.validateStatusTransition(appointment.status, status)) {
    throw new BadRequestException(`Không thể chuyển từ ${appointment.status} sang ${status}`);
  }

  let testResultUpdate: any = {};
  if (status === AppointmentStatus.SampleCollected) {
    if (!appointment.test_result) throw new BadRequestException('Không tìm thấy kết quả xét nghiệm');
    if (!this.validateTestResultStatusTransition(appointment.test_result.status, TestResultStatus.Processing)) {
      throw new BadRequestException(`Không thể chuyển TestResult từ ${appointment.test_result.status} sang Processing`);
    }
    testResultUpdate = { status: TestResultStatus.Processing, updated_at: new Date() };
    await this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: { sample_collected_date: sampleCollectedDate || new Date() },
    });
  } else if (status === AppointmentStatus.Completed) {
    if (!appointment.test_result) throw new BadRequestException('Không tìm thấy kết quả xét nghiệm');
    if (!this.validateTestResultStatusTransition(appointment.test_result.status, TestResultStatus.Completed)) {
      throw new BadRequestException(`Không thể chuyển TestResult từ ${appointment.test_result.status} sang Completed`);
    }
    const isAbnormal = testResultDetails ? Object.values(testResultDetails).some(v => v.toLowerCase().includes('positive')) : false;
    testResultUpdate = {
      status: TestResultStatus.Completed,
      result_data: testResultDetails ? JSON.stringify(testResultDetails) : notes || 'Negative',
      isAbnormal,
      notes,
      updated_at: new Date(),
    };
  }

  const [updatedAppointment] = await this.prisma.$transaction([
    this.prisma.appointment.update({ where: { appointment_id: appointmentId }, data: { status, updated_at: new Date() } }),
    ...(testResultUpdate.status ? [
      this.prisma.testResult.update({ where: { result_id: appointment.test_result!.result_id }, data: testResultUpdate }),
      this.prisma.testResultStatusHistory.create({
        data: { result_id: appointment.test_result!.result_id, status: testResultUpdate.status, notes: notes || `Cập nhật trạng thái TestResult sang ${testResultUpdate.status}`, changed_by: staffId },
      }),
    ] : []),
    this.prisma.appointmentStatusHistory.create({
      data: { appointment_id: appointmentId, status, notes: notes || `Cập nhật trạng thái sang ${status}`, changed_by: staffId },
    }),
  ]);

  this.logger.log(`Cập nhật trạng thái lịch hẹn ${appointmentId} sang ${status} bởi staff ${staffId}`);
  return { appointment: updatedAppointment, message: 'Cập nhật trạng thái thành công' };
}

  async updateAppointment(appointmentId: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    if (dto.consultation_notes && appointment.type !== 'Consultation') {
      throw new BadRequestException('Ghi chú tư vấn chỉ áp dụng cho lịch hẹn tư vấn');
    }

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

 async getTestResult(testCode: string, userId: string) {
  const testResult = await this.prisma.testResult.findUnique({
    where: { test_code: testCode },
    include: {
      appointment: {
        select: {
          appointment_id: true,
          user_id: true,
          type: true,
          start_time: true,
          end_time: true,
          status: true,
          service: { select: { service_id: true, name: true, category: true } },
        },
      },
      service: { select: { service_id: true, name: true, category: true } },
    },
  });

  if (!testResult) {
    throw new BadRequestException('Mã xét nghiệm không hợp lệ');
  }
  if (testResult.appointment.user_id !== userId) {
    throw new BadRequestException('Bạn không có quyền xem kết quả này');
  }

  const appointmentStatusHistory = await this.prisma.appointmentStatusHistory.findMany({
    where: { appointment_id: testResult.appointment_id },
    orderBy: { changed_at: 'asc' },
    select: {
      status: true,
      notes: true,
      changed_at: true,
      changed_by_user: { select: { full_name: true } },
    },
  });

  const testResultStatusHistory = await this.prisma.testResultStatusHistory.findMany({
    where: { result_id: testResult.result_id },
    orderBy: { changed_at: 'asc' },
    select: {
      status: true,
      notes: true,
      changed_at: true,
      changed_by_user: { select: { full_name: true } },
    },
  });

  let statusDisplay: string;
  switch (testResult.status) {
    case TestResultStatus.Pending:
      statusDisplay = 'Chưa xử lý';
      break;
    case TestResultStatus.Processing:
      statusDisplay = testResult.appointment.status === AppointmentStatus.SampleCollected ? 'Lấy mẫu' : 'Đang xét nghiệm';
      break;
    case TestResultStatus.Completed:
      statusDisplay = 'Có kết quả';
      break;
    default:
      statusDisplay = 'Không xác định';
  }

  const user = await this.prisma.user.findUnique({
    where: { user_id: userId },
    select: { full_name: true, email: true, phone_number: true },
  });

  this.logger.log(`Khách hàng ${userId} xem kết quả xét nghiệm ${testCode}`);
  return {
    appointment: testResult.appointment,
    testResult: {
      result_id: testResult.result_id,
      test_code: testResult.test_code,
      result_data: testResult.result_data,
      status: statusDisplay,
      is_abnormal: testResult.is_abnormal,
      notes: testResult.notes,
      updated_at: testResult.updated_at,
      service: testResult.service,
    },
    appointmentStatusHistory,
    testResultStatusHistory,
    basic_info: {
      full_name: user?.full_name,
      email: user?.email,
      phone_number: user?.phone_number,
    },
    message: 'Lấy kết quả xét nghiệm thành công',
  };
}

  async getAppointmentById(appointmentId: string, userId: string, role: Role) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: { test_result: true },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

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

    const appointmentStatusHistory = await this.prisma.appointmentStatusHistory.findMany({
      where: { appointment_id: appointmentId },
      orderBy: { changed_at: 'asc' },
      select: {
        status: true,
        notes: true,
        changed_at: true,
        changed_by_user: { select: { full_name: true } },
      },
    });

    this.logger.log(`Xem chi tiết lịch hẹn ${appointmentId} bởi ${userId}`);
    return {
      appointment,
      appointmentStatusHistory,
      message: 'Lấy chi tiết lịch hẹn thành công',
    };
  }

  async getAllAppointments() {
    const appointments = await this.prisma.appointment.findMany({
      where: { deleted_at: null, status: { not: 'Cancelled' } },
      include: {
        user: { select: { user_id: true, full_name: true, email: true } },
        service: { select: { service_id: true, name: true, category: true } },
        schedule: { select: { schedule_id: true, start_time: true, end_time: true } },
      },
      orderBy: { start_time: 'asc' },
    });
    return { appointments, message: 'Lấy danh sách lịch hẹn thành công' };
  }

  async confirmAppointment(appointmentId: string, dto: ConfirmAppointmentDto, staffId: string) {
  const appointment = await this.prisma.appointment.findUnique({
    where: { appointment_id: appointmentId, deleted_at: null },
    include: { test_result: true, schedule: true },
  });
  if (!appointment) {
    throw new BadRequestException('Lịch hẹn không tồn tại');
  }
  if (appointment.status !== AppointmentStatus.Pending) {
    throw new BadRequestException('Lịch hẹn không ở trạng thái Pending');
  }
  if (appointment.payment_status !== 'Paid' && !appointment.is_free_consultation) {
    throw new BadRequestException('Lịch hẹn chưa được thanh toán');
  }
  if (appointment.type === 'Consultation' && !appointment.schedule) {
    throw new BadRequestException('Lịch hẹn tư vấn phải có lịch trống hợp lệ');
  }

  const updatedAppointment = await this.prisma.$transaction([
    this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: { status: AppointmentStatus.Confirmed, updated_at: new Date() },
    }),
    this.prisma.appointmentStatusHistory.create({
      data: {
        appointment_id: appointmentId,
        status: AppointmentStatus.Confirmed,
        notes: dto.notes || 'Xác nhận lịch hẹn',
        changed_by: staffId,
      },
    }),
  ]);

  this.logger.log(`Xác nhận lịch hẹn ${appointmentId} bởi staff ${staffId}`);
  return {
    appointment: updatedAppointment[0],
    message: 'Xác nhận đơn thành công',
  };
}
async submitFeedback(appointmentId: string, dto: CreateFeedbackDto, userId: string) {
  const appointment = await this.prisma.appointment.findUnique({
    where: { appointment_id: appointmentId, user_id: userId, deleted_at: null },
  });
  if (!appointment || appointment.type !== 'Consultation') throw new BadRequestException('Lịch hẹn không hợp lệ');

  const feedback = await this.prisma.feedback.create({
    data: {
      user_id: userId,
      appointment_id: appointmentId,
      rating: dto.rating,
      comment: dto.comment,
      status: FeedbackStatus.Pending,
    },
  });

  const consultant = appointment.consultant_id ? await this.prisma.consultantProfile.findUnique({ where: { consultant_id: appointment.consultant_id } }) : null;
  if (consultant) {
    const feedbacks = await this.prisma.feedback.findMany({ where: { consultant_id: consultant.consultant_id, status: FeedbackStatus.Approved } });
    const avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / (feedbacks.length + 1) || 0;
    await this.prisma.consultantProfile.update({ where: { consultant_id: consultant.consultant_id }, data: { average_rating: avgRating } });
  }

  return { feedback, message: 'Gửi feedback thành công' };
}

async validateRelatedAppointment(appointmentId: string, userId: string) {
  const appointment = await this.prisma.appointment.findUnique({
    where: { appointment_id: appointmentId, deleted_at: null },
  });
  if (!appointment || appointment.user_id !== userId || appointment.type !== 'Testing' || appointment.status !== 'Completed') {
    return { valid: false, message: 'ID xét nghiệm không hợp lệ' };
  }
  const freeConsults = await this.prisma.appointment.count({
    where: { related_appointment_id: appointmentId, is_free_consultation: true, deleted_at: null },
  });
  if (freeConsults >= 1 || (appointment.free_consultation_valid_until && new Date() > appointment.free_consultation_valid_until)) {
    return { valid: false, message: 'Đã sử dụng miễn phí hoặc hết hạn' };
  }
  return { valid: true, message: 'Bạn đủ điều kiện miễn phí tư vấn' };
}




}