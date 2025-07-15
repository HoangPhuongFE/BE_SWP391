import { Injectable, BadRequestException, Logger, ForbiddenException, NotFoundException, Body, Req } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentService } from '../../payment/services/payment.service';
import { CreateAppointmentDto } from '../dtos/create-appointment.dto';
import { CreateStiAppointmentDto } from '../dtos/create-stis-appointment.dto';
import { UpdateAppointmentDto } from '../dtos/update-appointment.dto';
import { UpdateAppointmentStatusDto } from '../dtos/update-appointment-status.dto';
import { CreatePaymentDto } from '../../payment/dtos/create-payment.dto';
import { CreateFeedbackDto } from '../dtos/create-feedback.dto';
import { GetResultsDto } from '../dtos/get-results.dto';
import { AppointmentStatus, Role, PaymentMethod, TestResultStatus, ServiceType, FeedbackStatus, PaymentTransactionStatus, PaymentStatus, ShippingStatus, NotificationType, NotificationStatus } from '@prisma/client';
import { ConfirmAppointmentDto } from '../dtos/confirm-appointment.dto';
import { ServiceMode } from '@modules/services/dtos/create-service.dto';
import { EmailService } from '@modules/email/email.service';
import { CompleteConsultationDto } from '../dtos/complete-consultation.dto';

@Injectable()
export class AppointmentService {
  [x: string]: any;
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly emailService: EmailService,
  ) { }

  private generateTestCode(category: string): string {
    const prefix = (category || 'TEST').slice(0, 3).toUpperCase();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${random}`;
  }

  private validateStatusTransition(current: AppointmentStatus, next: AppointmentStatus): boolean {
    const validTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      Pending: [AppointmentStatus.Confirmed, AppointmentStatus.Cancelled],
      Confirmed: [AppointmentStatus.SampleCollected, AppointmentStatus.Cancelled],
      InProgress: [AppointmentStatus.SampleCollected, AppointmentStatus.Cancelled],
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
    const { consultant_id, schedule_id, service_id, type, location, userId, test_code } = dto;

    // Kiểm tra thời gian hợp lệ
    const now = new Date();
    const schedule = await this.prisma.schedule.findUnique({
      where: { schedule_id, is_booked: false, deleted_at: null },
    });
    if (!schedule) throw new BadRequestException('Lịch trống không tồn tại hoặc đã được đặt');

    // Kiểm tra năm và khoảng thời gian
    const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 2 tháng
    if (schedule.start_time.getFullYear() > now.getFullYear()) {
      throw new BadRequestException('Không thể đặt lịch trước năm sau');
    }
    if (schedule.start_time < now || schedule.start_time > maxDate) {
      throw new BadRequestException('Lịch hẹn phải trong vòng 2 tháng từ hiện tại và không sớm hơn hôm nay');
    }

    // Kiểm tra dịch vụ
    const svc = await this.prisma.service.findUnique({
      where: { service_id, deleted_at: null },
    });
    if (!svc || svc.type !== ServiceType.Consultation) throw new BadRequestException('Dịch vụ không hợp lệ');

    // Kiểm tra tư vấn viên (nếu có)
    if (consultant_id) {
      const consultant = await this.prisma.consultantProfile.findUnique({ where: { consultant_id } });
      if (!consultant || consultant.consultant_id !== schedule.consultant_id) throw new BadRequestException('Consultant không hợp lệ');
    }

    // Kiểm tra trùng lịch với consultant
    const overlap = await this.prisma.appointment.findFirst({
      where: {
        consultant_id: schedule.consultant_id,
        start_time: { lte: schedule.end_time },
        end_time: { gte: schedule.start_time },
        status: { not: 'Cancelled' },
      },
    });
    if (overlap) throw new BadRequestException('Thời gian trùng lịch hẹn khác');

    // Kiểm tra trùng lịch của người dùng với cùng dịch vụ
    const userOverlap = await this.prisma.appointment.findFirst({
      where: {
        user_id: userId,
        service_id,
        start_time: { lte: schedule.end_time },
        end_time: { gte: schedule.start_time },
        status: { not: 'Cancelled' },
        deleted_at: null,
      },
    });
    if (userOverlap) throw new BadRequestException('Bạn đã có lịch hẹn trùng thời gian cho dịch vụ này');

    // Kiểm tra số lượng lịch hẹn chưa thanh toán
    const pendingAppointments = await this.prisma.appointment.count({
      where: {
        user_id: userId,
        service_id,
        payment_status: PaymentStatus.Pending,
        status: { not: 'Cancelled' },
        deleted_at: null,
      },
    });
    if (pendingAppointments >= 3) throw new BadRequestException('Bạn có quá nhiều lịch hẹn chưa thanh toán cho dịch vụ này');

    // Kiểm tra tư vấn miễn phí với test_code
    let isFreeConsultation = false;
    let paymentAmount = Number(svc.price);
    let related_appointment_id: string | undefined;
    if (test_code) {
      const testResult = await this.prisma.testResult.findUnique({
        where: { test_code },
        include: { appointment: true },
      });
      if (!testResult || !testResult.appointment) {
        throw new BadRequestException('Mã xét nghiệm không hợp lệ');
      }
      const relatedAppt = testResult.appointment;
      if (
        relatedAppt.user_id === userId &&
        relatedAppt.type === 'Testing' &&
        relatedAppt.status === 'Completed' &&
        !relatedAppt.deleted_at
      ) {
        const freeConsults = await this.prisma.appointment.count({
          where: { related_appointment_id: relatedAppt.appointment_id, is_free_consultation: true, deleted_at: null },
        });
        if (freeConsults < 1 && relatedAppt.free_consultation_valid_until && new Date() <= relatedAppt.free_consultation_valid_until) {
          isFreeConsultation = true;
          paymentAmount = 0;
          related_appointment_id = relatedAppt.appointment_id;
        } else {
          throw new BadRequestException('Mã xét nghiệm không hợp lệ hoặc đã hết hạn miễn phí');
        }
      } else {
        throw new BadRequestException('Mã xét nghiệm không hợp lệ');
      }
    }

    // Tạo lịch hẹn
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
        related_appointment_id,
      },
    });

    // Ghi lịch sử trạng thái
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointment_id: appt.appointment_id,
        status: 'Pending',
        notes: isFreeConsultation ? 'Tạo lịch hẹn tư vấn miễn phí' : 'Tạo lịch hẹn tư vấn',
        changed_by: userId,
      },
    });

    // Cập nhật trạng thái lịch
    await this.prisma.schedule.update({ where: { schedule_id }, data: { is_booked: true } });

    // Tạo thanh toán nếu không miễn phí
    if (!isFreeConsultation) {
      let orderCode: number | null = null;
      for (let i = 0; i < 5; i++) {
        const cand = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
        if (!await this.prisma.payment.findUnique({ where: { order_code: cand } })) {
          orderCode = cand;
          break;
        }
      }
      if (!orderCode) throw new BadRequestException('Tạo mã thanh toán thất bại');

      // Tạo bản ghi Payment trước
      await this.prisma.payment.create({
        data: {
          appointment_id: appt.appointment_id,
          user_id: userId,
          amount: paymentAmount,
          payment_method: PaymentMethod.BankCard,
          status: PaymentTransactionStatus.Pending,
          order_code: orderCode,
          expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 phút
        },
      });

      const payDto: CreatePaymentDto = {
        orderCode,
        amount: paymentAmount,
        description: `Hẹn ${svc.name}`.substring(0, 25),
        cancelUrl: `${process.env.FRONTEND_URL}/cancel`,
        returnUrl: `${process.env.FRONTEND_URL}/success`,
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
    const {
      serviceId,
      date,
      session,
      location,
      category = 'STI',
      selected_mode,
      userId,
      contact_name,
      contact_phone,
      shipping_address,
      province,
      district,
      ward,
    } = dto;

    // Kiểm tra định dạng ngày
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException('Định dạng ngày phải là YYYY-MM-DD');
    }

    // Kiểm tra ngày hợp lệ và giới hạn thời gian
    const now = new Date();
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 2 tháng
    if (appointmentDate.getFullYear() > now.getFullYear()) {
      throw new BadRequestException('Không thể đặt lịch trước năm sau');
    }
    if (appointmentDate < now || appointmentDate > maxDate) {
      throw new BadRequestException('Lịch hẹn phải trong vòng 2 tháng từ hiện tại và không sớm hơn hôm nay');
    }

    // Kiểm tra số lượng lịch hẹn chưa thanh toán
    const pendingAppointments = await this.prisma.appointment.count({
      where: {
        user_id: userId,
        service_id: serviceId,
        payment_status: PaymentStatus.Pending,
        status: { not: 'Cancelled' },
        deleted_at: null,
      },
    });
    if (pendingAppointments >= 3) {
      throw new BadRequestException('Bạn có quá nhiều lịch hẹn chưa thanh toán cho dịch vụ này');
    }

    // Kiểm tra giới hạn lịch hẹn mỗi ngày
    const startOfDay = new Date(appointmentDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(appointmentDate.setHours(23, 59, 59, 999));
    const userAppointments = await this.prisma.appointment.count({
      where: {
        user_id: userId,
        start_time: { gte: startOfDay, lte: endOfDay },
        status: { not: 'Cancelled' },
        deleted_at: null,
      },
    });
    if (userAppointments > 0) {
      throw new BadRequestException('Bạn chỉ có thể đặt 1 lịch xét nghiệm mỗi ngày');
    }

    // Kiểm tra dịch vụ
    const svc = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null },
    });
    if (!svc || svc.type !== ServiceType.Testing || !svc.testing_hours || !svc.daily_capacity) {
      throw new BadRequestException('Dịch vụ không hợp lệ hoặc chưa được cấu hình');
    }

    // Kiểm tra mode
    const modes = (svc.available_modes as ServiceMode[]) ?? [];
    if (!modes.includes(selected_mode)) {
      throw new BadRequestException('Dịch vụ không hỗ trợ hình thức đã chọn');
    }

    // Kiểm tra buổi
    const testingHours = svc.testing_hours as Record<string, { start: string; end: string }>;
    if (!testingHours[session]) {
      throw new BadRequestException(`Buổi ${session} không hỗ trợ`);
    }

    // Kiểm tra dung lượng ngày và buổi
    const existingAppointments = await this.prisma.appointment.count({
      where: {
        service_id: serviceId,
        start_time: { gte: startOfDay, lte: endOfDay },
        status: { not: 'Cancelled' },
      },
    });
    if (existingAppointments >= svc.daily_capacity) {
      throw new BadRequestException('Dung lượng ngày đã đầy');
    }

    const sessionCapacity = Math.floor(svc.daily_capacity / Object.keys(testingHours).length);
    const sessionStartTime = new Date(startOfDay.setHours(parseInt(testingHours[session].start.split(':')[0])));
    const sessionAppointments = await this.prisma.appointment.count({
      where: {
        service_id: serviceId,
        start_time: { gte: startOfDay, lte: endOfDay },
        status: { not: 'Cancelled' },
        AND: [{ start_time: { gte: sessionStartTime } }],
      },
    });
    if (sessionAppointments >= sessionCapacity) {
      throw new BadRequestException(`Buổi ${session} đã đầy`);
    }

    // Kiểm tra trùng thời gian của người dùng với cùng dịch vụ
    const userOverlap = await this.prisma.appointment.findFirst({
      where: {
        user_id: userId,
        service_id: serviceId,
        start_time: { gte: startOfDay, lte: endOfDay },
        status: { not: 'Cancelled' },
        deleted_at: null,
      },
    });
    if (userOverlap) {
      throw new BadRequestException('Bạn đã có lịch hẹn trong ngày này cho dịch vụ này');
    }

    // Kiểm tra thông tin giao hàng nếu AT_HOME
    if (selected_mode === ServiceMode.AT_HOME) {
      if (!contact_phone || !contact_phone.match(/^\+84\d{9}$/)) {
        throw new BadRequestException('Số điện thoại phải là +84 theo sau 9 chữ số');
      }
      if (!shipping_address || shipping_address.length < 10 || shipping_address.length > 200) {
        throw new BadRequestException('Địa chỉ giao hàng phải từ 10 đến 200 ký tự');
      }
      if (!province || !district || !ward || province.length > 50 || district.length > 50 || ward.length > 50) {
        throw new BadRequestException('Tỉnh, quận, phường phải hợp lệ và dưới 50 ký tự');
      }
    }

    // Tính giờ bắt đầu - kết thúc
    const sessionHours = testingHours[session];
    const startHour = parseInt(sessionHours.start.split(':')[0]);
    const startMinute = parseInt(sessionHours.start.split(':')[1]);
    const sessionEndHour = parseInt(sessionHours.end.split(':')[0]);
    const sessionEndMinute = parseInt(sessionHours.end.split(':')[1]);
    const slotDuration = 30;
    const slotsUsed = existingAppointments % Math.floor(svc.daily_capacity / 2);
    const slotStartMinutes = startMinute + slotsUsed * slotDuration;
    const startTime = new Date(appointmentDate);
    startTime.setHours(startHour, slotStartMinutes, 0, 0);
    const endTime = new Date(startTime);
    endTime.setMinutes(startTime.getMinutes() + slotDuration);

    // Kiểm tra thời gian trong khung giờ buổi
    const sessionEndTime = new Date(appointmentDate);
    sessionEndTime.setHours(sessionEndHour, sessionEndMinute, 0, 0);
    if (endTime > sessionEndTime) {
      throw new BadRequestException('Thời gian hẹn vượt quá khung giờ của buổi');
    }

    // Tạo appointment
    const appt = await this.prisma.appointment.create({
      data: {
        user_id: userId,
        type: 'Testing',
        start_time: startTime,
        end_time: endTime,
        status: 'Pending',
        payment_status: PaymentStatus.Pending,
        location: selected_mode === ServiceMode.AT_CLINIC ? location : null,
        service_id: serviceId,
        mode: selected_mode,
      },
    });

    // Tạo orderCode
    let orderCode: number | null = null;
    const triedCodes = new Set();
    for (let i = 0; i < 5; i++) {
      const cand = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
      if (!triedCodes.has(cand) && !(await this.prisma.payment.findUnique({ where: { order_code: cand } }))) {
        orderCode = cand;
        break;
      }
      triedCodes.add(cand);
    }
    if (!orderCode) throw new BadRequestException('Tạo mã thanh toán thất bại');

    // Tạo payment
    const payment = await this.prisma.payment.create({
      data: {
        appointment_id: appt.appointment_id,
        user_id: userId,
        amount: Number(svc.price),
        payment_method: PaymentMethod.BankCard,
        status: PaymentTransactionStatus.Pending,
        order_code: orderCode,
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Tạo payment link
    const payDto: CreatePaymentDto = {
      orderCode,
      amount: Number(svc.price),
      description: `XN ${svc.name}`.substring(0, 25),
      cancelUrl: '{env.FRONTEND_URL}/cancel',
      returnUrl: '{env.FRONTEND_URL}/success',
      buyerName: userId,
      paymentMethod: PaymentMethod.BankCard,
      appointmentId: appt.appointment_id,
    };
    const { paymentLink } = await this.paymentService.createPaymentLink(userId, payDto).catch((error) => {
      this.logger.error('Tạo liên kết thanh toán thất bại:', error);
      throw new BadRequestException('Tạo liên kết thanh toán thất bại');
    });

    // Transaction: Tạo test result và shipping info
    const [testResult] = await this.prisma.$transaction(async (tx) => {
      const testResult = await tx.testResult.create({
        data: {
          appointment_id: appt.appointment_id,
          service_id: serviceId,
          result_data: 'Pending',
          status: TestResultStatus.Pending,
          test_code: await this.generateUniqueTestCode(category),
        },
      });

      if (selected_mode === ServiceMode.AT_HOME) {
        await tx.shippingInfo.create({
          data: {
            appointment_id: appt.appointment_id,
            provider: 'GHN',
            shipping_status: ShippingStatus.Pending,
            contact_name: contact_name!,
            contact_phone: contact_phone!,
            shipping_address: shipping_address!,
            province: province!,
            district: district!,
            ward: ward!,
          },
        });
      }

      return [testResult];
    });

    // Tạo lịch sử & thông báo
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointment_id: appt.appointment_id,
        status: AppointmentStatus.Pending,
        notes: 'Tạo lịch hẹn xét nghiệm',
        changed_by: userId,
      },
    });

    await this.prisma.testResultStatusHistory.create({
      data: {
        result_id: testResult.result_id,
        status: TestResultStatus.Pending,
        notes: 'Kết quả khởi tạo',
        changed_by: userId,
      },
    });

    // Thông báo nhắc nhở thanh toán
    await this.prisma.notification.create({
      data: {
        user_id: userId,
        type: NotificationType.Email,
        title: 'Đặt lịch xét nghiệm thành công',
        content: `Lịch hẹn xét nghiệm của bạn đã được tạo. Mã xét nghiệm: ${testResult.test_code}. Vui lòng thanh toán trong 30 phút để xác nhận. Xét nghiệm STI cần được thực hiện sớm để bảo vệ sức khỏe.`,
        status: NotificationStatus.Pending,
      },
    });

    // Thông báo hướng dẫn chuẩn bị xét nghiệm
    await this.prisma.notification.create({
      data: {
        user_id: userId,
        type: NotificationType.Email,
        title: 'Hướng dẫn chuẩn bị xét nghiệm STI',
        content: `Để đảm bảo kết quả xét nghiệm chính xác, vui lòng nhịn ăn 4-6 giờ trước khi lấy mẫu (nếu tại phòng khám) hoặc chuẩn bị mẫu theo hướng dẫn trong bộ xét nghiệm tại nhà.`,
        status: NotificationStatus.Pending,
      },
    });

    this.logger.log(`Tạo lịch xét nghiệm ${appt.appointment_id} bởi user ${userId}`);

    return {
      appointment: appt,
      paymentLink,
      testCode: testResult.test_code,
      message: 'Đặt lịch xét nghiệm thành công',
      return_address: svc.return_address,
      return_phone: svc.return_phone,
      preparationGuide: 'Nhịn ăn 4-6 giờ trước khi lấy mẫu (tại phòng khám) hoặc làm theo hướng dẫn bộ xét nghiệm tại nhà.',
    };
  }

  // Hàm tạo testCode duy nhất
  private async generateUniqueTestCode(category: string): Promise<string> {
    const maxAttempts = 5;
    const triedTestCodes = new Set();
    for (let i = 0; i < maxAttempts; i++) {
      const cand = this.generateTestCode(category);
      if (!triedTestCodes.has(cand) && !(await this.prisma.testResult.findFirst({ where: { test_code: cand } }))) {
        return cand;
      }
      triedTestCodes.add(cand);
    }
    throw new BadRequestException('Tạo mã xét nghiệm thất bại');
  }





  async updateAppointmentStatus(appointmentId: string, dto: UpdateAppointmentStatusDto, staffId: string) {
    const { status, notes, sampleCollectedDate, testResultDetails, resultDate } = dto;

    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: {
        test_result: true,
        user: true,
        service: true,
        return_shipping_info: true, // Sử dụng ReturnShippingInfo
      },
    });
    if (!appointment) throw new BadRequestException('Lịch hẹn không tồn tại');
    if (appointment.type !== 'Testing') throw new BadRequestException('Chỉ áp dụng cho lịch hẹn xét nghiệm');
    if (status === AppointmentStatus.SampleCollected && appointment.status !== AppointmentStatus.Confirmed) {
      throw new BadRequestException('Lịch hẹn phải được xác nhận trước khi lấy mẫu');
    }
    if (!this.validateStatusTransition(appointment.status, status)) {
      throw new BadRequestException(`Không thể chuyển từ ${appointment.status} sang ${status}`);
    }
    if (
      status === AppointmentStatus.SampleCollected &&
      appointment.mode === ServiceMode.AT_HOME &&
      (!appointment.return_shipping_info || appointment.return_shipping_info.shipping_status !== 'ReturnedToLab')
    ) {
      throw new BadRequestException('Mẫu chưa được nhận tại phòng lab (không có thông tin trả mẫu hoặc trạng thái không phải ReturnedToLab)');
    }

    let testResultUpdate: any = {};
    let appointmentUpdate: any = {
      status,
      sample_collected_date: status === AppointmentStatus.SampleCollected ? sampleCollectedDate || new Date() : undefined,
      updated_at: new Date(),
    };

    if (status === AppointmentStatus.SampleCollected) {
      if (!appointment.test_result) throw new BadRequestException('Không tìm thấy kết quả xét nghiệm');
      if (!this.validateTestResultStatusTransition(appointment.test_result.status, TestResultStatus.Processing)) {
        throw new BadRequestException(`Không thể chuyển TestResult từ ${appointment.test_result.status} sang Processing`);
      }
      testResultUpdate = { status: TestResultStatus.Processing, updated_at: new Date() };
    } else if (status === AppointmentStatus.Completed) {
      if (!appointment.test_result) throw new BadRequestException('Không tìm thấy kết quả xét nghiệm');
      if (!this.validateTestResultStatusTransition(appointment.test_result.status, TestResultStatus.Completed)) {
        throw new BadRequestException(`Không thể chuyển TestResult từ ${appointment.test_result.status} sang Completed`);
      }
      const isAbnormal = testResultDetails ? Object.values(testResultDetails).some((v) => v.toLowerCase().includes('positive')) : false;
      testResultUpdate = {
        status: TestResultStatus.Completed,
        result_data: testResultDetails ? JSON.stringify(testResultDetails) : notes || 'Negative',
        is_abnormal: isAbnormal,
        notes,
        updated_at: resultDate ? new Date(resultDate) : new Date(),
      };
      appointmentUpdate.free_consultation_valid_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const [updatedAppointment] = await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { appointment_id: appointmentId },
        data: appointmentUpdate,
      }),
      ...(testResultUpdate.status
        ? [
          this.prisma.testResult.update({
            where: { result_id: appointment.test_result!.result_id },
            data: testResultUpdate,
          }),
          this.prisma.testResultStatusHistory.create({
            data: {
              result_id: appointment.test_result!.result_id,
              status: testResultUpdate.status,
              notes: notes || `Cập nhật trạng thái TestResult sang ${testResultUpdate.status}`,
              changed_by: staffId,
            },
          }),
        ]
        : []),
      this.prisma.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          status,
          notes: notes || `Cập nhật trạng thái sang ${status}`,
          changed_by: staffId,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          user_id: staffId,
          action: 'UPDATE_APPOINTMENT_STATUS',
          entity_type: 'Appointment',
          entity_id: appointmentId,
          details: { status, notes },
        },
      }),
      ...(status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed
        ? [
          this.prisma.notification.create({
            data: {
              user_id: appointment.user_id,
              type: 'Email',
              title: status === AppointmentStatus.SampleCollected ? 'Mẫu xét nghiệm đã được thu thập' : 'Kết quả xét nghiệm sẵn sàng',
              content:
                status === AppointmentStatus.SampleCollected
                  ? 'Mẫu xét nghiệm của bạn đã được thu thập và đang được xử lý.'
                  : `Kết quả xét nghiệm của bạn đã có. Vui lòng xem tại mã ${appointment.test_result?.test_code}.`,
              status: 'Pending',
            },
          }),
        ]
        : []),
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
      include: {
        test_result: true,
        payments: true,
        shipping_info: true,
        return_shipping_info: true,
        status_history: true,
      },
    });

    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    // Soft-delete Appointment
    const updatedAppointment = await this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: { deleted_at: new Date() },
    });

    // Soft-delete AppointmentStatusHistory
    await this.prisma.appointmentStatusHistory.updateMany({
      where: { appointment_id: appointmentId },
      data: { deleted_at: new Date() },
    });

    // Soft-delete TestResult nếu tồn tại
    if (appointment.test_result) {
      await this.prisma.testResult.update({
        where: { result_id: appointment.test_result.result_id },
        data: { deleted_at: new Date() },
      });

      // Soft-delete TestResultStatusHistory
      await this.prisma.testResultStatusHistory.updateMany({
        where: { result_id: appointment.test_result.result_id },
        data: { deleted_at: new Date() },
      });
    }

    // Soft-delete Payments
    await this.prisma.payment.updateMany({
      where: { appointment_id: appointmentId },
      data: { deleted_at: new Date() },
    });

    // Soft-delete ShippingInfo nếu tồn tại
    if (appointment.shipping_info) {
      await this.prisma.shippingInfo.update({
        where: { id: appointment.shipping_info.id },
        data: { deleted_at: new Date() },
      });
    }

    // Soft-delete ReturnShippingInfo nếu tồn tại
    if (appointment.return_shipping_info) {
      await this.prisma.returnShippingInfo.update({
        where: { id: appointment.return_shipping_info.id },
        data: { deleted_at: new Date() },
      });
    }

    // Mở lại Schedule nếu có
    if (appointment.schedule_id) {
      await this.prisma.schedule.update({
        where: { schedule_id: appointment.schedule_id },
        data: { is_booked: false },
      });
    }

    return { appointment: updatedAppointment, message: 'Xóa lịch hẹn thành công' };
  }

  async getTestResult(testCode: string, userId: string) {
    const result = await this.prisma.$transaction(async (prisma) => {
      // 1. Tìm kết quả
      const testResult = await prisma.testResult.findUnique({
        where: { test_code: testCode },
        include: {
          appointment: {
            include: {
              service: { select: { service_id: true, name: true, category: true } },
              shipping_info: true,
            },
          },
          service: { select: { service_id: true, name: true, category: true } },
        },
      });

      if (!testResult) {
        throw new NotFoundException('Không tìm thấy mã xét nghiệm');
      }

      if (testResult.appointment.user_id !== userId) {
        throw new ForbiddenException('Bạn không có quyền xem kết quả này');
      }

      // 2. Kết quả chưa có => trả về sớm, không lỗi
      if (testResult.status !== TestResultStatus.Completed) {
        return {
          available: false,
          test_code: testCode,
          status: testResult.status,
          message: 'Kết quả xét nghiệm chưa sẵn sàng',
        };
      }

      // 3. Đã có kết quả => lấy thêm thông tin
      const [appointmentStatusHistory, testResultStatusHistory, user] = await Promise.all([
        prisma.appointmentStatusHistory.findMany({
          where: { appointment_id: testResult.appointment_id },
          orderBy: { changed_at: 'asc' },
          select: {
            status: true,
            notes: true,
            changed_at: true,
            changed_by_user: { select: { full_name: true } },
          },
        }),
        prisma.testResultStatusHistory.findMany({
          where: { result_id: testResult.result_id },
          orderBy: { changed_at: 'asc' },
          select: {
            status: true,
            notes: true,
            changed_at: true,
            changed_by_user: { select: { full_name: true } },
          },
        }),
        prisma.user.findUnique({
          where: { user_id: userId },
          select: { full_name: true, email: true, phone_number: true },
        }),
      ]);

      // 4. Ghi nhận xem nếu chưa có
      if (!testResult.viewed_at) {
        await prisma.testResult.update({
          where: { result_id: testResult.result_id },
          data: { viewed_at: new Date() },
        });
      }

      // 5. Audit log
      await prisma.auditLog.create({
        data: {
          user_id: userId,
          action: 'VIEW_TEST_RESULT',
          entity_type: 'TestResult',
          entity_id: testResult.result_id,
          details: { test_code: testCode },
        },
      });

      // 6. Thông báo nếu bất thường
      if (testResult.is_abnormal) {
        await prisma.notification.create({
          data: {
            user_id: userId,
            type: 'Email',
            title: 'Kết quả xét nghiệm bất thường',
            content: 'Kết quả xét nghiệm của bạn có dấu hiệu bất thường. Vui lòng đặt lịch tư vấn để được hỗ trợ.',
            status: 'Pending',
          },
        });
      }

      return {
        available: true,
        appointment: {
          ...testResult.appointment,
          shipping_info: testResult.appointment.shipping_info || null,
        },
        testResult: {
          result_id: testResult.result_id,
          test_code: testResult.test_code,
          result_data: testResult.result_data,
          status: 'Có kết quả',
          is_abnormal: testResult.is_abnormal,
          notes: testResult.notes,
          updated_at: testResult.updated_at,
          viewed_at: testResult.viewed_at,
          service: testResult.service,
        },
        appointmentStatusHistory,
        testResultStatusHistory,
        basic_info: {
          full_name: user?.full_name || 'Không xác định',
          email: user?.email,
          phone_number: user?.phone_number,
        },
        message: 'Lấy kết quả xét nghiệm thành công',
      };
    });

    // Ghi log ngoài transaction
    if (result.available) {
      this.logger.log(`Khách hàng ${userId} xem kết quả xét nghiệm ${testCode}`);
    }

    return result;
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




  async validateTestCode(testCode: string, userId: string) {
    const testResult = await this.prisma.testResult.findUnique({
      where: { test_code: testCode },
      include: { appointment: true },
    });

    if (!testResult || !testResult.appointment) {
      return { valid: false, message: 'Mã xét nghiệm không tồn tại' };
    }

    const appointment = testResult.appointment;
    if (appointment.user_id !== userId) {
      return { valid: false, message: 'Mã xét nghiệm không thuộc về bạn' };
    }
    if (appointment.type !== 'Testing') {
      return { valid: false, message: 'Mã xét nghiệm không liên quan đến lịch xét nghiệm' };
    }
    if (appointment.status !== 'Completed') {
      return { valid: false, message: 'Lịch xét nghiệm chưa hoàn tất' };
    }
    if (appointment.deleted_at) {
      return { valid: false, message: 'Lịch xét nghiệm đã bị xóa' };
    }

    const freeConsults = await this.prisma.appointment.count({
      where: {
        related_appointment_id: appointment.appointment_id,
        is_free_consultation: true,
        deleted_at: null,
      },
    });

    if (freeConsults >= 1) {
      return { valid: false, message: 'Mã xét nghiệm đã được sử dụng cho tư vấn miễn phí' };
    }

    if (appointment.free_consultation_valid_until && new Date() > appointment.free_consultation_valid_until) {
      return { valid: false, message: 'Mã xét nghiệm đã hết hạn tư vấn miễn phí' };
    }

    return { valid: true, message: 'Bạn đủ điều kiện nhận tư vấn miễn phí' };
  }


  async getUserAppointments(userId: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      include: {
        service: { select: { service_id: true, name: true, category: true } },
        consultant: { include: { user: { select: { full_name: true } } } },
        test_result: { select: { test_code: true, status: true, is_abnormal: true } },
        shipping_info: true,
        payments: {
          select: {
            amount: true,
            payment_method: true,
            status: true,
            created_at: true,
          },
        },
      },
      orderBy: { start_time: 'desc' },
    });

    return {
      appointments: appointments.map((appt) => ({
        appointment_id: appt.appointment_id,
        type: appt.type,
        start_time: appt.start_time,
        end_time: appt.end_time,
        status: appt.status,
        payment_status: appt.payment_status,
        location: appt.location,
        mode: appt.mode,
        service: appt.service,
        consultant_name: appt.consultant?.user?.full_name || null,
        test_code: appt.test_result?.test_code || null,
        test_result_status: appt.test_result?.status || null,
        is_abnormal: appt.test_result?.is_abnormal || false,
        shipping_info: appt.mode === 'AT_HOME' ? appt.shipping_info : null,
        payments: appt.payments.map((pay) => ({
          amount: pay.amount,
          payment_method: pay.payment_method,
          status: pay.status,
          created_at: pay.created_at,
        })) ?? [],
      })),
      message: 'Lấy danh sách lịch hẹn thành công',
    };
  }
  async getPendingAppointments() {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.Pending,
        deleted_at: null,
      },
      include: {
        user: { select: { user_id: true, full_name: true, email: true, phone_number: true } },
        service: { select: { service_id: true, name: true, category: true } },
        shipping_info: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return {
      appointments: appointments.map((appt) => ({
        appointment_id: appt.appointment_id,
        type: appt.type,
        start_time: appt.start_time,
        end_time: appt.end_time,
        payment_status: appt.payment_status,
        location: appt.location,
        mode: appt.mode,
        user: {
          user_id: appt.user.user_id,
          full_name: appt.user.full_name,
          email: appt.user.email,
          phone_number: appt.user.phone_number,
        },
        service: appt.service,
        shipping_info: appt.mode === ServiceMode.AT_HOME ? appt.shipping_info : null,
      })),
      total: appointments.length,
      message:
        appointments.length > 0
          ? 'Lấy danh sách lịch hẹn cần xác nhận thành công'
          : 'Không có lịch hẹn nào cần xác nhận',
    };
  }

  async getResults(body: GetResultsDto) {
    const { testCode, fullName } = body;

    // Find test result by testCode
    const testResult = await this.prisma.testResult.findUnique({
      where: { test_code: testCode },
      include: {
        appointment: {
          include: {
            service: { select: { service_id: true, name: true, category: true } },
            consultant: { include: { user: { select: { full_name: true } } } },
            shipping_info: true,
            payments: { select: { amount: true, payment_method: true, status: true, created_at: true } },
            user: { select: { full_name: true, email: true, phone_number: true } },
          },
        },
      },
    });

    // Check if test result exists
    if (!testResult) {
      throw new NotFoundException('Mã xét nghiệm không tồn tại');
    }

    // Verify fullName matches the user associated with the appointment
    if (testResult.appointment.user.full_name !== fullName) {
      throw new ForbiddenException('Tên không khớp với thông tin người dùng');
    }

    // Fetch appointment status history
    const appointmentStatusHistory = await this.prisma.appointmentStatusHistory.findMany({
      where: { appointment_id: testResult.appointment.appointment_id },
      orderBy: { changed_at: 'asc' },
      select: { status: true, notes: true, changed_at: true, changed_by_user: { select: { full_name: true } } },
    });

    // Prepare test result data
    let testResultData: {
      result_id: string;
      test_code: string;
      result_data: string;
      status: typeof TestResultStatus[keyof typeof TestResultStatus];
      is_abnormal: boolean;
      notes: string | null;
      updated_at: Date;
      viewed_at: Date | null;
    } | null = {
      result_id: testResult.result_id,
      test_code: testResult.test_code,
      result_data: testResult.status === TestResultStatus.Completed ? testResult.result_data : 'Pending',
      status: testResult.status,
      is_abnormal: testResult.is_abnormal,
      notes: testResult.notes,
      updated_at: testResult.updated_at,
      viewed_at: testResult.viewed_at,
    };

    // Fetch test result status history
    const testResultStatusHistory = await this.prisma.testResultStatusHistory.findMany({
      where: { result_id: testResult.result_id },
      orderBy: { changed_at: 'asc' },
      select: { status: true, notes: true, changed_at: true, changed_by_user: { select: { full_name: true } } },
    });

    // Update viewed_at if result is completed and not yet viewed
    if (testResult.status === TestResultStatus.Completed && !testResult.viewed_at) {
      await this.prisma.testResult.update({
        where: { result_id: testResult.result_id },
        data: { viewed_at: new Date() },
      });
    }

    // Log the view action (use appointment's user_id for audit log)
    await this.prisma.auditLog.create({
      data: {
        user_id: testResult.appointment.user_id,
        action: 'VIEW_TEST_RESULT',
        entity_type: 'TestResult',
        entity_id: testResult.result_id,
        details: { testCode },
      },
    });

    // Return response
    return {
      appointment: {
        appointment_id: testResult.appointment.appointment_id,
        type: testResult.appointment.type,
        start_time: testResult.appointment.start_time,
        end_time: testResult.appointment.end_time,
        status: testResult.appointment.status,
        payment_status: testResult.appointment.payment_status,
        location: testResult.appointment.location,
        mode: testResult.appointment.mode,
        service: testResult.appointment.service,
        consultant_name: testResult.appointment.consultant?.user?.full_name || null,
        shipping_info: testResult.appointment.mode === ServiceMode.AT_HOME ? testResult.appointment.shipping_info : null,
        payments: testResult.appointment.payments,
      },
      testResult: testResultData,
      appointmentStatusHistory,
      testResultStatusHistory,
      basic_info: {
        full_name: testResult.appointment.user.full_name,
        email: testResult.appointment.user.email,
        phone_number: testResult.appointment.user.phone_number,
      },
      message: testResultData.status === TestResultStatus.Completed
        ? 'Lấy kết quả xét nghiệm và thông tin lịch hẹn thành công'
        : 'Kết quả xét nghiệm chưa sẵn sàng',
    };
  }


  async startConsultation(appointmentId: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: { consultant: true },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }
    if (appointment.type !== 'Consultation') {
      throw new BadRequestException('Chỉ áp dụng cho lịch hẹn tư vấn');
    }
    if (appointment.status !== AppointmentStatus.Confirmed) {
      throw new BadRequestException('Lịch hẹn phải ở trạng thái Confirmed');
    }
    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { user_id: userId },
    });
    if (!consultant || appointment.consultant_id !== consultant.consultant_id) {
      throw new ForbiddenException('Bạn không có quyền xác nhận buổi tư vấn này');
    }

    const updatedAppointment = await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { appointment_id: appointmentId },
        data: { status: AppointmentStatus.InProgress, updated_at: new Date() },
      }),
      this.prisma.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          status: AppointmentStatus.InProgress,
          notes: 'Buổi tư vấn đã bắt đầu',
          changed_by: userId,
        },
      }),
      this.prisma.notification.create({
        data: {
          user_id: appointment.user_id,
          type: NotificationType.Email,
          title: 'Buổi tư vấn đã bắt đầu',
          content: `Buổi tư vấn của bạn với mã ${appointmentId} đã bắt đầu vào ${new Date().toISOString()}.`,
          status: NotificationStatus.Pending,
        },
      }),
    ]);

    this.logger.log(`Buổi tư vấn ${appointmentId} được xác nhận bắt đầu bởi Consultant ${userId}`);
    return { appointment: updatedAppointment[0], message: 'Xác nhận buổi tư vấn bắt đầu thành công' };
  }


  async completeConsultation(appointmentId: string, dto: CompleteConsultationDto, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: {
        consultant: { include: { user: { select: { full_name: true, email: true } } } },
        user: { select: { email: true, full_name: true } },
        service: { select: { name: true } },
      },
    });
    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }
    if (appointment.type !== 'Consultation') {
      throw new BadRequestException('Chỉ áp dụng cho lịch hẹn tư vấn');
    }
    if (appointment.status !== AppointmentStatus.InProgress) {
      throw new BadRequestException('Lịch hẹn phải ở trạng thái InProgress');
    }
    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { user_id: userId },
    });
    if (!consultant || appointment.consultant_id !== consultant.consultant_id) {
      throw new ForbiddenException('Bạn không có quyền xác nhận hoàn tất buổi tư vấn này');
    }

    let notificationStatus: NotificationStatus = NotificationStatus.Pending;
    try {
      // Gửi email thông báo
      await this.emailService.sendEmail(
        appointment.user.email,
        'Buổi tư vấn đã hoàn tất',
        `Buổi tư vấn của bạn (mã ${appointmentId}) với tư vấn viên ${appointment.consultant?.user.full_name || 'Không xác định'} cho dịch vụ ${appointment.service?.name || 'Không xác định'} đã hoàn tất vào ${new Date().toISOString()}. Ghi chú: ${dto.consultation_notes || 'Không có ghi chú'}. Vui lòng vào web tư vấn viên  gửi feedback để giúp chúng tôi cải thiện dịch vụ.`,
      );
      notificationStatus = NotificationStatus.Sent;
    } catch (error) {
      this.logger.error(`Gửi email thất bại cho ${appointment.user.email}:`, error);
      notificationStatus = NotificationStatus.Failed;
    }

    const updatedAppointment = await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { appointment_id: appointmentId },
        data: {
          status: AppointmentStatus.Completed,
          consultation_notes: dto.consultation_notes,
          updated_at: new Date(),
        },
      }),
      this.prisma.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          status: AppointmentStatus.Completed,
          notes: dto.consultation_notes || 'Buổi tư vấn đã hoàn tất',
          changed_by: userId,
        },
      }),
      this.prisma.notification.create({
        data: {
          user_id: appointment.user_id,
          type: NotificationType.Email,
          title: 'Buổi tư vấn đã hoàn tất',
          content: `Buổi tư vấn của bạn (mã ${appointmentId}) với tư vấn viên ${appointment.consultant?.user.full_name || 'Không xác định'} đã hoàn tất. Vui lòng gửi feedback để giúp chúng tôi cải thiện dịch vụ.`,
          status: notificationStatus,
        },
      }),
    ]);

    this.logger.log(`Buổi tư vấn ${appointmentId} được xác nhận hoàn tất bởi Consultant ${userId}`);
    return {
      appointment: updatedAppointment[0],
      serviceName: appointment.service?.name || 'Không xác định',
      consultantName: appointment.consultant?.user.full_name || 'Không xác định',
      message: 'Xác nhận buổi tư vấn hoàn tất thành công',
    };
  }
}