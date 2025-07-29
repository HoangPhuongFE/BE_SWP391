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
import { AppointmentStatus, Role, PaymentMethod, TestResultStatus, ServiceType, FeedbackStatus, PaymentTransactionStatus, PaymentStatus, ShippingStatus, NotificationType, NotificationStatus, AppointmentType } from '@prisma/client';
import { ConfirmAppointmentDto } from '../dtos/confirm-appointment.dto';
import { ServiceMode } from '@modules/services/dtos/create-service.dto';
import { EmailService } from '@modules/email/email.service';
import { CompleteConsultationDto } from '../dtos/complete-consultation.dto';
import { HttpService } from '@nestjs/axios';
import { ShippingService } from '@modules/shipping/services/shipping.service';

@Injectable()
export class AppointmentService {



  [x: string]: any;
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly emailService: EmailService,
    private readonly httpService: HttpService,
    private readonly shippingService: ShippingService,

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
    this.logger.warn(`Định dạng ngày không hợp lệ: date=${date}`);
    throw new BadRequestException('Định dạng ngày phải là YYYY-MM-DD');
  }

  // Kiểm tra ngày hợp lệ và giới hạn thời gian
  const now = new Date();
  const appointmentDate = new Date(date);
  if (isNaN(appointmentDate.getTime())) {
    this.logger.warn(`Ngày không hợp lệ: date=${date}`);
    throw new BadRequestException('Ngày không hợp lệ');
  }
  const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 2 tháng
  if (appointmentDate.getFullYear() > now.getFullYear()) {
    this.logger.warn(`Ngày vượt quá năm hiện tại: date=${date}`);
    throw new BadRequestException('Không thể đặt lịch trước năm sau');
  }
  if (appointmentDate < now || appointmentDate > maxDate) {
    this.logger.warn(`Ngày ngoài phạm vi cho phép: date=${date}, now=${now}, maxDate=${maxDate}`);
    throw new BadRequestException('Lịch hẹn phải trong vòng 2 tháng từ hiện tại và không sớm hơn hôm nay');
  }

  // Kiểm tra dịch vụ
  const svc = await this.prisma.service.findUnique({
    where: { service_id: serviceId, deleted_at: null, is_active: true },
    select: {
      service_id: true,
      name: true,
      price: true,
      type: true,
      testing_hours: true,
      daily_capacity: true,
      available_modes: true,
      return_address: true,
      return_phone: true,
    },
  });
  if (!svc || svc.type !== ServiceType.Testing || !svc.testing_hours || !svc.daily_capacity) {
    this.logger.warn(`Dịch vụ không hợp lệ hoặc chưa cấu hình: serviceId=${serviceId}`);
    throw new BadRequestException('Dịch vụ không hợp lệ hoặc chưa được cấu hình');
  }

  // Kiểm tra mode
  const modes: ServiceMode[] = Array.isArray(svc.available_modes)
    ? svc.available_modes
    : typeof svc.available_modes === 'string'
      ? JSON.parse(svc.available_modes)
      : [];
  if (!modes.includes(selected_mode as ServiceMode)) {
    this.logger.warn(`Hình thức ${selected_mode} không được hỗ trợ bởi dịch vụ ${serviceId}`);
    throw new BadRequestException('Dịch vụ không hỗ trợ hình thức đã chọn');
  }

  // Kiểm tra buổi
  const testingHours = svc.testing_hours as Record<string, { start: string; end: string }>;
  if (!testingHours[session]) {
    this.logger.warn(`Buổi ${session} không được hỗ trợ bởi dịch vụ ${serviceId}`);
    throw new BadRequestException(`Buổi ${session} không hỗ trợ`);
  }

  // Kiểm tra thông tin giao hàng nếu AT_HOME
  let districtId = '';
  let wardCode = '';
  if (selected_mode === ServiceMode.AT_HOME) {
    if (!contact_name || contact_name.length < 2 || contact_name.length > 100) {
      this.logger.warn(`Tên liên hệ không hợp lệ: contact_name=${contact_name}`);
      throw new BadRequestException('Tên liên hệ phải từ 2 đến 100 ký tự');
    }
    if (!contact_phone || !/^\d{10,11}$/.test(contact_phone)) {
      this.logger.warn(`Số điện thoại không hợp lệ: contact_phone=${contact_phone}`);
      throw new BadRequestException('Số điện thoại phải có 10-11 chữ số');
    }
    if (!shipping_address || shipping_address.length < 10 || shipping_address.length > 200) {
      this.logger.warn(`Địa chỉ giao hàng không hợp lệ: shipping_address=${shipping_address}`);
      throw new BadRequestException('Địa chỉ giao hàng phải từ 10 đến 200 ký tự');
    }
    if (!province || !district || !ward || province.length > 50 || district.length > 50 || ward.length > 50) {
      this.logger.warn(`Thông tin địa chỉ không hợp lệ: province=${province}, district=${district}, ward=${ward}`);
      throw new BadRequestException('Tỉnh, quận, phường phải hợp lệ và dưới 50 ký tự');
    }

    const districtKey = district.toLowerCase().trim();
    districtId = this.districtMapping[districtKey];
    if (!districtId) {
      this.logger.warn(`Quận/huyện không hợp lệ: district=${district}`);
      throw new BadRequestException('Quận/huyện không hợp lệ');
    }

    const wardKey = ward.toLowerCase().trim();
    wardCode = this.wardMapping[districtId]?.[wardKey];
    if (!wardCode) {
      this.logger.warn(`Phường/xã không hợp lệ: ward=${ward}`);
      throw new BadRequestException('Phường/xã không hợp lệ');
    }
  }

  // Kiểm tra giới hạn lịch hẹn mỗi ngày cho user
  const startOfDay = new Date(appointmentDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(appointmentDate.setHours(23, 59, 59, 999));
  const userAppointments = await this.prisma.appointment.count({
    where: {
      user_id: userId,
      start_time: { gte: startOfDay, lte: endOfDay },
      status: { not: AppointmentStatus.Cancelled },
      payment_status: PaymentStatus.Paid,
      deleted_at: null,
    },
  });
  if (userAppointments >= 2) {
    this.logger.warn(`Người dùng đã đặt tối đa 2 lịch hẹn trong ngày: userId=${userId}, date=${startOfDay}`);
    throw new BadRequestException('Bạn chỉ có thể đặt 2 lịch xét nghiệm mỗi ngày');
  }

  // Kiểm tra số lượng lịch hẹn chưa thanh toán
  const pendingAppointments = await this.prisma.appointment.count({
    where: {
      user_id: userId,
      service_id: serviceId,
      payment_status: PaymentStatus.Pending,
      status: { not: AppointmentStatus.Cancelled },
      deleted_at: null,
    },
  });
  if (pendingAppointments >= 3) {
    this.logger.warn(`Quá nhiều lịch hẹn chưa thanh toán: userId=${userId}, serviceId=${serviceId}`);
    throw new BadRequestException('Bạn có quá nhiều lịch hẹn chưa thanh toán cho dịch vụ này');
  }

  // Kiểm tra dung lượng ngày
  const existingAppointments = await this.prisma.appointment.count({
    where: {
      service_id: serviceId,
      start_time: { gte: startOfDay, lte: endOfDay },
      status: { not: AppointmentStatus.Cancelled },
      payment_status: PaymentStatus.Paid, // Chỉ tính lịch đã thanh toán
    },
  });
  if (existingAppointments >= svc.daily_capacity) {
    this.logger.warn(`Dung lượng ngày đã đầy: serviceId=${serviceId}, date=${startOfDay}`);
    throw new BadRequestException('Dung lượng ngày đã đầy');
  }

  // Kiểm tra dung lượng buổi
  const sessionCapacity = Math.floor(svc.daily_capacity / Object.keys(testingHours).length);
  const sessionStartTime = new Date(startOfDay);
  sessionStartTime.setHours(parseInt(testingHours[session].start.split(':')[0]), parseInt(testingHours[session].start.split(':')[1]));
  const sessionEndTime = new Date(startOfDay);
  sessionEndTime.setHours(parseInt(testingHours[session].end.split(':')[0]), parseInt(testingHours[session].end.split(':')[1]));
  const sessionAppointments = await this.prisma.appointment.count({
    where: {
      service_id: serviceId,
      start_time: { gte: sessionStartTime, lte: sessionEndTime },
      status: { not: AppointmentStatus.Cancelled },
      payment_status: PaymentStatus.Paid, // Chỉ tính lịch đã thanh toán
    },
  });
  if (sessionAppointments >= sessionCapacity) {
    this.logger.warn(`Buổi ${session} đã đầy: serviceId=${serviceId}, sessionStartTime=${sessionStartTime}`);
    throw new BadRequestException(`Buổi ${session} đã đầy`);
  }

  // Kiểm tra trùng thời gian
  const userOverlap = await this.prisma.appointment.findFirst({
    where: {
      user_id: userId,
      service_id: serviceId,
      start_time: { gte: startOfDay, lte: endOfDay },
      status: { not: AppointmentStatus.Cancelled },
      payment_status: PaymentStatus.Paid, // Chỉ tính lịch đã thanh toán
      deleted_at: null,
    },
  });
  if (userOverlap) {
    this.logger.warn(`Trùng lịch hẹn: userId=${userId}, serviceId=${serviceId}, date=${startOfDay}`);
    throw new BadRequestException('Bạn đã có lịch hẹn trong ngày này cho dịch vụ này');
  }

  // Tính giờ bắt đầu - kết thúc
  const sessionHours = testingHours[session];
  const startHour = parseInt(sessionHours.start.split(':')[0]);
  const startMinute = parseInt(sessionHours.start.split(':')[1]);
  const slotDuration = 30;
  const slotStartMinutes = startMinute + sessionAppointments * slotDuration; // Dùng sessionAppointments thay vì existingAppointments
  const startTime = new Date(appointmentDate);
  startTime.setHours(startHour, slotStartMinutes, 0, 0);
  const endTime = new Date(startTime);
  endTime.setMinutes(startTime.getMinutes() + slotDuration);

  // Kiểm tra thời gian
  if (endTime > sessionEndTime) {
    this.logger.warn(`Thời gian hẹn vượt khung giờ: endTime=${endTime}, sessionEndTime=${sessionEndTime}`);
    throw new BadRequestException('Thời gian hẹn vượt quá khung giờ của buổi');
  }

  // Transaction: Tạo appointment, payment, test result, shipping info
  let ghnOrder: any = null;
  let shippingInfoId: string | null = null;
  let orderCode: number | undefined;
  const [appt, payment, testResult] = await this.prisma.$transaction(async (tx) => {
    // Tạo appointment
    const appt = await tx.appointment.create({
      data: {
        user_id: userId,
        type: AppointmentType.Testing,
        start_time: startTime,
        end_time: endTime,
        status: AppointmentStatus.Pending,
        payment_status: PaymentStatus.Pending,
        location: selected_mode === ServiceMode.AT_CLINIC ? location : null,
        service_id: serviceId,
        mode: selected_mode as ServiceMode,
      },
    });

    // Tạo orderCode duy nhất
    for (let i = 0; i < 5; i++) {
      const cand = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
      if (!(await tx.payment.findUnique({ where: { order_code: cand } }))) {
        orderCode = cand;
        break;
      }
    }
    if (!orderCode) {
      this.logger.error(`Không thể tạo orderCode cho appointment: ${appt.appointment_id}`);
      throw new BadRequestException('Tạo mã thanh toán thất bại');
    }

    // Tạo payment
    const payment = await tx.payment.create({
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

    // Tạo test result
    const testResult = await tx.testResult.create({
      data: {
        appointment_id: appt.appointment_id,
        service_id: serviceId,
        result_data: 'Pending',
        status: TestResultStatus.Pending,
        test_code: await this.generateUniqueTestCode(category),
      },
    });

    // Tạo shipping info nếu AT_HOME
    if (selected_mode === ServiceMode.AT_HOME) {
      const shippingInfo = await tx.shippingInfo.create({
        data: {
          appointment_id: appt.appointment_id,
          provider: 'GHN',
          shipping_status: ShippingStatus.Pending,
          contact_name: contact_name!,
          contact_phone: contact_phone!,
          shipping_address: shipping_address!,
          province: province!,
          district: districtId!,
          ward: wardCode!,
        },
      });
      shippingInfoId = shippingInfo.id;
    }

    // Ghi lịch sử trạng thái
    await tx.appointmentStatusHistory.create({
      data: {
        appointment_id: appt.appointment_id,
        status: AppointmentStatus.Pending,
        notes: 'Tạo lịch hẹn xét nghiệm',
        changed_by: userId,
      },
    });

    await tx.testResultStatusHistory.create({
      data: {
        result_id: testResult.result_id,
        status: TestResultStatus.Pending,
        notes: 'Kết quả khởi tạo',
        changed_by: userId,
      },
    });

    return [appt, payment, testResult];
  });

  // Tạo payment link
  const user = await this.prisma.user.findUnique({
    where: { user_id: userId },
    select: { email: true, full_name: true, phone_number: true },
  });
  if (!user) {
    this.logger.error(`Không tìm thấy user: userId=${userId}`);
    throw new BadRequestException('Người dùng không tồn tại');
  }

  const payDto: CreatePaymentDto = {
    orderCode: orderCode!,
    amount: Number(svc.price),
    description: `XN ${svc.name}`.substring(0, 25),
    cancelUrl: `${process.env.FRONTEND_URL_LOCAL}/cancel`,
    returnUrl: `${process.env.FRONTEND_URL_LOCAL}/success`,
    buyerName: user.full_name || userId,
    buyerEmail: user.email,
    buyerPhone: user.phone_number ?? undefined,
    paymentMethod: PaymentMethod.BankCard,
    appointmentId: appt.appointment_id,
  };
  let paymentLink: string;
  try {
    const result = await this.paymentService.createPaymentLink(userId, payDto);
    paymentLink = result.paymentLink;
  } catch (error) {
    this.logger.error(`Tạo liên kết thanh toán thất bại cho appointment: ${appt.appointment_id}, error: ${error.message}`);
    throw new BadRequestException('Tạo liên kết thanh toán thất bại');
  }

  // Tạo đơn GHN nếu AT_HOME
  if (selected_mode === ServiceMode.AT_HOME && shippingInfoId) {
    try {
      ghnOrder = await this.shippingService.createOrderForAppointment(appt.appointment_id);
      await this.prisma.shippingInfo.update({
        where: { id: shippingInfoId },
        data: {
          provider_order_code: ghnOrder.order_code,
          shipping_status: ShippingStatus.Shipped,
          expected_delivery_time: ghnOrder.expected_delivery_time ? new Date(ghnOrder.expected_delivery_time) : undefined,
          label_url: ghnOrder.label || null,
        },
      });
    } catch (error) {
      this.logger.error(`Lỗi tạo đơn GHN cho appointment: ${appt.appointment_id}, error: ${error.message}`);
      // Log lỗi nhưng không ném lỗi
    }
  }

  // Gửi thông báo
  const emailContent = `Lịch hẹn xét nghiệm của bạn (mã ${appt.appointment_id}) đã được tạo. Mã xét nghiệm: ${testResult.test_code}. Vui lòng thanh toán trong 30 phút để xác nhận.${
    ghnOrder ? ` Mã đơn GHN: ${ghnOrder.order_code}.` : ''
  }`;
  try {
    if (user.email) {
      await this.emailService.sendEmail(user.email, 'Đặt lịch xét nghiệm thành công', emailContent);
      await this.prisma.notification.create({
        data: {
          user_id: userId,
          type: NotificationType.Email,
          title: 'Đặt lịch xét nghiệm thành công',
          content: emailContent,
          status: NotificationStatus.Pending,
        },
      });
    }
    await this.prisma.notification.create({
      data: {
        user_id: userId,
        type: NotificationType.Email,
        title: 'Hướng dẫn chuẩn bị xét nghiệm STI',
        content: `Để đảm bảo kết quả xét nghiệm chính xác, vui lòng nhịn ăn 4-6 giờ trước khi lấy mẫu (nếu tại phòng khám) hoặc chuẩn bị mẫu theo hướng dẫn trong bộ xét nghiệm tại nhà.`,
        status: NotificationStatus.Pending,
      },
    });
  } catch (error) {
    this.logger.error(`Gửi email thất bại cho appointment: ${appt.appointment_id}, error: ${error.message}`);
  }

  this.logger.log(`Tạo lịch xét nghiệm thành công: appointment_id=${appt.appointment_id}, userId=${userId}`);
  return {
    appointment: appt,
    paymentLink,
    orderCode,
    testCode: testResult.test_code,
    ghnOrderCode: ghnOrder?.order_code || null,
    message: 'Đặt lịch xét nghiệm thành công',
    return_address: svc.return_address,
    return_phone: svc.return_phone,
    preparationGuide: 'Nhịn ăn 4-6 giờ trước khi lấy mẫu (tại phòng khám) hoặc làm theo hướng dẫn bộ xét nghiệm tại nhà.',
  };
}




  async createAppointment(dto: CreateAppointmentDto & { userId: string }) {
  const { consultant_id, schedule_id, service_id, type, location, userId, test_code, mode } = dto;

  // Kiểm tra dịch vụ
  const svc = await this.prisma.service.findUnique({
    where: { service_id, deleted_at: null, is_active: true },
    select: { service_id: true, name: true, price: true, type: true, available_modes: true },
  });
  if (!svc || svc.type !== ServiceType.Consultation) {
    this.logger.warn(`Dịch vụ không hợp lệ hoặc không hoạt động: service_id=${service_id}`);
    throw new BadRequestException('Dịch vụ không hợp lệ hoặc không hoạt động');
  }

  // Kiểm tra mode
  const availableModes: ServiceMode[] = Array.isArray(svc.available_modes)
    ? svc.available_modes
    : typeof svc.available_modes === 'string'
      ? JSON.parse(svc.available_modes)
      : [];
  if (!availableModes.includes(mode as ServiceMode)) {
    this.logger.warn(`Hình thức ${mode} không được hỗ trợ bởi dịch vụ ${service_id}`);
    throw new BadRequestException('Hình thức tư vấn không được hỗ trợ bởi dịch vụ này');
  }

  // Kiểm tra lịch trình
  const schedule = await this.prisma.schedule.findUnique({
    where: { schedule_id, is_booked: false, deleted_at: null },
    select: {
      schedule_id: true,
      consultant_id: true,
      start_time: true,
      end_time: true,
      max_appointments_per_day: true,
      consultant: {
        select: {
          is_verified: true,
          specialization: true,
          user: { select: { user_id: true, email: true, full_name: true } }, 
        },
      },
    },
  });
  if (!schedule) {
    this.logger.warn(`Lịch trống không tồn tại hoặc đã được đặt: schedule_id=${schedule_id}`);
    throw new BadRequestException('Lịch trống không tồn tại hoặc đã được đặt');
  }

  // Kiểm tra consultant
  if (consultant_id && consultant_id !== schedule.consultant_id) {
    this.logger.warn(`Consultant không khớp với lịch trình: consultant_id=${consultant_id}, schedule_id=${schedule_id}`);
    throw new BadRequestException('Consultant không hợp lệ cho lịch trình này');
  }
  if (!schedule.consultant.is_verified) {
    this.logger.warn(`Consultant chưa được xác minh: consultant_id=${consultant_id}`);
    throw new BadRequestException('Consultant chưa được xác minh');
  }

  // Kiểm tra thời gian hợp lệ
  const now = new Date();
  const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); 
  if (schedule.start_time.getFullYear() > now.getFullYear()) {
    this.logger.warn(`Ngày đặt lịch vượt quá năm hiện tại: start_time=${schedule.start_time}`);
    throw new BadRequestException('Không thể đặt lịch trước năm sau');
  }
  if (schedule.start_time < now || schedule.start_time > maxDate) {
    this.logger.warn(`Thời gian lịch hẹn không hợp lệ: start_time=${schedule.start_time}, maxDate=${maxDate}`);
    throw new BadRequestException('Lịch hẹn phải trong vòng 2 tháng từ hiện tại và không sớm hơn hôm nay');
  }

  // Kiểm tra giới hạn lịch hẹn mỗi ngày cho user
  const startOfDay = new Date(schedule.start_time);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(schedule.start_time);
  endOfDay.setHours(23, 59, 59, 999);
  const userAppointments = await this.prisma.appointment.count({
    where: {
      user_id: userId,
      start_time: { gte: startOfDay, lte: endOfDay },
      status: { not: AppointmentStatus.Cancelled },
      payment_status: PaymentStatus.Paid,
      deleted_at: null,
    },
  });
  if (userAppointments >= 2) {
    this.logger.warn(`Người dùng đã đặt tối đa 2 lịch hẹn trong ngày: userId=${userId}, date=${startOfDay}`);
    throw new BadRequestException('Bạn chỉ có thể đặt tối đa 2 lịch hẹn mỗi ngày');
  }

  // Kiểm tra giới hạn lịch hẹn của consultant
  const consultantAppointments = await this.prisma.appointment.count({
    where: {
      consultant_id: schedule.consultant_id,
      start_time: { gte: startOfDay, lte: endOfDay },
      status: { not: AppointmentStatus.Cancelled },
      payment_status: PaymentStatus.Paid,
      deleted_at: null,
    },
  });
  const maxAppointments = schedule.max_appointments_per_day ?? 5;
  if (consultantAppointments >= maxAppointments) {
    this.logger.warn(`Consultant đã đầy lịch hẹn trong ngày: consultant_id=${schedule.consultant_id}, date=${startOfDay}`);
    throw new BadRequestException('Consultant đã đầy lịch hẹn trong ngày này');
  }

  // Kiểm tra trùng lịch của consultant
  const consultantOverlap = await this.prisma.appointment.findFirst({
    where: {
      consultant_id: schedule.consultant_id,
      start_time: { lte: schedule.end_time },
      end_time: { gte: schedule.start_time },
      status: { not: AppointmentStatus.Cancelled },
      payment_status: PaymentStatus.Paid,
      deleted_at: null,
    },
  });
  if (consultantOverlap) {
    this.logger.warn(`Trùng lịch consultant: consultant_id=${schedule.consultant_id}, time=${schedule.start_time}`);
    throw new BadRequestException('Thời gian trùng với lịch hẹn khác của consultant');
  }

  // Kiểm tra trùng lịch của user
  const userOverlap = await this.prisma.appointment.findFirst({
    where: {
      user_id: userId,
      service_id,
      start_time: { lte: schedule.end_time },
      end_time: { gte: schedule.start_time },
      status: { not: AppointmentStatus.Cancelled },
      payment_status: PaymentStatus.Paid,
      deleted_at: null,
    },
  });
  if (userOverlap) {
    this.logger.warn(`Trùng lịch user: userId=${userId}, service_id=${service_id}, time=${schedule.start_time}`);
    throw new BadRequestException('Bạn đã có lịch hẹn trùng thời gian cho dịch vụ này');
  }

  // Kiểm tra số lượng lịch hẹn chưa thanh toán
  const pendingAppointments = await this.prisma.appointment.count({
    where: {
      user_id: userId,
      service_id,
      payment_status: PaymentStatus.Pending,
      status: { not: AppointmentStatus.Cancelled },
      deleted_at: null,
    },
  });
  if (pendingAppointments >= 3) {
    this.logger.warn(`Quá nhiều lịch hẹn chưa thanh toán: userId=${userId}, service_id=${service_id}`);
    throw new BadRequestException('Bạn có quá nhiều lịch hẹn chưa thanh toán cho dịch vụ này');
  }

  // Kiểm tra tư vấn miễn phí với test_code
  let isFreeConsultation = false;
  let paymentAmount = Number(svc.price);
  let related_appointment_id: string | undefined;
  if (test_code) {
    const testResult = await this.prisma.testResult.findUnique({
      where: { test_code },
      include: {
        appointment: {
          select: {
            appointment_id: true, 
            user_id: true,
            type: true,
            status: true,
            deleted_at: true,
            free_consultation_valid_until: true,
          },
        },
      },
    });
    if (!testResult || !testResult.appointment) {
      this.logger.warn(`Mã xét nghiệm không hợp lệ: test_code=${test_code}`);
      throw new BadRequestException('Mã xét nghiệm không hợp lệ');
    }
    const relatedAppt = testResult.appointment;
    if (
      relatedAppt.user_id === userId &&
      relatedAppt.type === AppointmentType.Testing &&
      relatedAppt.status === AppointmentStatus.Completed &&
      !relatedAppt.deleted_at &&
      relatedAppt.free_consultation_valid_until &&
      new Date() <= relatedAppt.free_consultation_valid_until
    ) {
      const freeConsults = await this.prisma.appointment.count({
        where: { related_appointment_id: relatedAppt.appointment_id, is_free_consultation: true, deleted_at: null },
      });
      if (freeConsults < 1) {
        isFreeConsultation = true;
        paymentAmount = 0;
        related_appointment_id = relatedAppt.appointment_id;
      } else {
        this.logger.warn(`Mã xét nghiệm đã được sử dụng cho tư vấn miễn phí: test_code=${test_code}`);
        throw new BadRequestException('Mã xét nghiệm đã được sử dụng cho tư vấn miễn phí');
      }
    } else {
      this.logger.warn(`Mã xét nghiệm không hợp lệ hoặc hết hạn: test_code=${test_code}`);
      throw new BadRequestException('Mã xét nghiệm không hợp lệ hoặc đã hết hạn miễn phí');
    }
  }

  // Transaction: Tạo appointment và các bản ghi liên quan
  return this.prisma.$transaction(async (tx) => {
    // Tạo appointment
    const appt = await tx.appointment.create({
      data: {
        user_id: userId,
        consultant_id,
        type: AppointmentType.Consultation,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        status: AppointmentStatus.Pending,
        payment_status: isFreeConsultation ? PaymentStatus.Paid : PaymentStatus.Pending,
        location: mode === ServiceMode.ONLINE ? null : location,
        service_id,
        schedule_id,
        is_free_consultation: isFreeConsultation,
        related_appointment_id,
        mode,
      },
    });

    // Đặt is_booked: true chỉ khi tư vấn miễn phí
    if (isFreeConsultation) {
      await tx.schedule.update({
        where: { schedule_id },
        data: { is_booked: true },
      });
    }

    // Ghi lịch sử trạng thái
    await tx.appointmentStatusHistory.create({
      data: {
        appointment_id: appt.appointment_id,
        status: AppointmentStatus.Pending,
        notes: isFreeConsultation ? `Tạo lịch hẹn tư vấn miễn phí (${mode})` : `Tạo lịch hẹn tư vấn (${mode})`,
        changed_by: userId,
      },
    });

    // Ghi audit log
    await tx.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE_APPOINTMENT',
        entity_type: 'Appointment',
        entity_id: appt.appointment_id,
        details: { mode, isFreeConsultation, service_id, consultant_id },
      },
    });

    // Tạo payment nếu không miễn phí
    let paymentLink: string | undefined;
    let orderCode: number | undefined;
    if (!isFreeConsultation) {
      // Tạo orderCode duy nhất
      for (let i = 0; i < 5; i++) {
        const cand = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
        if (!(await tx.payment.findUnique({ where: { order_code: cand } }))) {
          orderCode = cand;
          break;
        }
      }
      if (!orderCode) {
        this.logger.error(`Không thể tạo orderCode cho appointment: ${appt.appointment_id}`);
        throw new BadRequestException('Tạo mã thanh toán thất bại');
      }

      // Tạo bản ghi Payment
      await tx.payment.create({
        data: {
          appointment_id: appt.appointment_id,
          user_id: userId,
          amount: paymentAmount,
          payment_method: PaymentMethod.BankCard,
          status: PaymentTransactionStatus.Pending,
          order_code: orderCode,
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      // Lấy thông tin user để tạo payment link
      const user = await tx.user.findUnique({
        where: { user_id: userId },
        select: { email: true, full_name: true, phone_number: true },
      });
      if (!user) {
        this.logger.error(`Không tìm thấy user: userId=${userId}`);
        throw new BadRequestException('Người dùng không tồn tại');
      }

      // Tạo payment link với PayOS
      const payDto: CreatePaymentDto = {
        orderCode,
        amount: paymentAmount,
        description: `Hẹn ${svc.name}`.substring(0, 25),
        cancelUrl: `${process.env.FRONTEND_URL_LOCAL}`,
        returnUrl: `${process.env.FRONTEND_URL_LOCAL}`,
        buyerName: user.full_name || userId,
        buyerEmail: user.email,
        buyerPhone: user.phone_number ?? undefined, 
        paymentMethod: PaymentMethod.BankCard,
        appointmentId: appt.appointment_id,
      };

      try {
        const result = await this.paymentService.createPaymentLink(userId, payDto);
        paymentLink = result.paymentLink;
      } catch (error) {
        this.logger.error(`Tạo liên kết thanh toán thất bại cho appointment: ${appt.appointment_id}, error: ${error.message}`);
        throw new BadRequestException('Tạo liên kết thanh toán thất bại');
      }
    }

    // Gửi thông báo email
    const emailContent = `Lịch hẹn tư vấn của bạn (mã ${appt.appointment_id}) đã được tạo. ${
      isFreeConsultation ? 'Đã xác nhận vì đây là tư vấn miễn phí.' : 'Vui lòng thanh toán trong 30 phút để xác nhận.'
    }`;
    try {
      const user = await tx.user.findUnique({
        where: { user_id: userId },
        select: { email: true, full_name: true },
      });
      const consultant = consultant_id ? schedule.consultant : null;

      if (user?.email) {
        await this.emailService.sendEmail(user.email, 'Lịch hẹn tư vấn đã được tạo', emailContent);
        await tx.notification.create({
          data: {
            user_id: userId,
            type: NotificationType.Email,
            title: 'Lịch hẹn tư vấn đã được tạo',
            content: emailContent,
            status: NotificationStatus.Pending,
          },
        });
      }
      if (consultant?.user?.email) {
        await tx.notification.create({
          data: {
            user_id: consultant.user.user_id, // Use user_id from select
            type: NotificationType.Email,
            title: 'Lịch hẹn tư vấn mới',
            content: `Lịch hẹn tư vấn mới (mã ${appt.appointment_id}) đã được tạo cho bạn.`,
            status: NotificationStatus.Pending,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Gửi email thất bại cho appointment: ${appt.appointment_id}, error: ${error.message}`);
      // Không ném lỗi để tránh làm gián đoạn
    }

    this.logger.log(`Tạo lịch hẹn thành công: appointment_id=${appt.appointment_id}, userId=${userId}, isFreeConsultation=${isFreeConsultation}`);
    return {
      appointment: appt,
      paymentLink,
      orderCode,
      message: isFreeConsultation
        ? 'Đặt lịch tư vấn miễn phí thành công, đã xác nhận'
        : 'Đặt lịch tư vấn thành công, vui lòng thanh toán trong 30 phút',
    };
  });
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
      include: {
        service: true,
        consultant: { include: { user: { select: { email: true, full_name: true } } } },
        user: { select: { email: true, full_name: true } },
      },
    });
    if (!appointment) throw new BadRequestException('Lịch hẹn không tồn tại');

    if (dto.consultation_notes && appointment.type !== 'Consultation') {
      throw new BadRequestException('Ghi chú tư vấn chỉ áp dụng cho lịch hẹn tư vấn');
    }

    // Kiểm tra dịch vụ
    const serviceId = dto.service_id || appointment.service_id;
    const svc = await this.prisma.service.findUnique({
      where: { service_id: serviceId ?? undefined, deleted_at: null },
    });
    if (!svc) throw new BadRequestException('Dịch vụ không tồn tại');

    // Kiểm tra mode
    const availableModes: ServiceMode[] = Array.isArray(svc.available_modes)
      ? svc.available_modes
      : typeof svc.available_modes === 'string'
        ? JSON.parse(svc.available_modes)
        : [];
    if (dto.mode && !availableModes.includes(dto.mode as unknown as ServiceMode)) {
      throw new BadRequestException('Hình thức tư vấn không được hỗ trợ bởi dịch vụ này');
    }

    // Kiểm tra meeting_link
    const effectiveMode = dto.mode || appointment.mode;
    if (effectiveMode === ServiceMode.ONLINE && dto.meeting_link && !dto.meeting_link.startsWith('https://meet.google.com')) {
      throw new BadRequestException('Link Google Meet không hợp lệ');
    }
    if (effectiveMode !== ServiceMode.ONLINE && dto.meeting_link) {
      throw new BadRequestException('Link Google Meet chỉ áp dụng cho mode ONLINE');
    }

    // Kiểm tra thời gian
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
      if (overlapping) throw new BadRequestException('Thời gian trùng với lịch hẹn khác');
    }

    // Cập nhật lịch hẹn
    const updatedAppointment = await this.prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: {
        ...dto,
        start_time: dto.start_time ? new Date(dto.start_time) : undefined,
        end_time: dto.end_time ? new Date(dto.end_time) : undefined,
        mode: dto.mode,
        meeting_link: effectiveMode === ServiceMode.ONLINE ? dto.meeting_link : null,
        location: effectiveMode === ServiceMode.ONLINE ? null : dto.location,
        updated_at: new Date(),
      },
    });

    // Ghi log và thông báo
    if (dto.mode || dto.meeting_link) {
      await this.prisma.auditLog.create({
        data: {
          user_id: 'system', // Hoặc lấy userId từ request nếu có
          action: 'UPDATE_APPOINTMENT',
          entity_type: 'Appointment',
          entity_id: appointmentId,
          details: { mode: dto.mode, meeting_link: dto.meeting_link },
        },
      });

      if (dto.meeting_link || dto.mode === ServiceMode.ONLINE) {
        const emailContent = `Lịch hẹn tư vấn (mã ${appointmentId}) đã được cập nhật. ${effectiveMode === ServiceMode.ONLINE && updatedAppointment.meeting_link
          ? `Tham gia qua Google Meet: ${updatedAppointment.meeting_link}`
          : `Hình thức: ${effectiveMode}`
          }`;
        try {
          await this.emailService.sendEmail(
            appointment.user.email,
            'Lịch hẹn tư vấn đã được cập nhật',
            emailContent,
          );
          if (appointment.consultant) {
            await this.emailService.sendEmail(
              appointment.consultant.user.email,
              'Lịch hẹn tư vấn đã được cập nhật',
              emailContent,
            );
          }
          await this.prisma.notification.create({
            data: {
              user_id: appointment.user_id,
              type: NotificationType.Email,
              title: 'Lịch hẹn tư vấn đã được cập nhật',
              content: emailContent,
              status: NotificationStatus.Pending,
            },
          });
          if (appointment.consultant) {
            await this.prisma.notification.create({
              data: {
                user_id: appointment.consultant.user_id,
                type: NotificationType.Email,
                title: 'Lịch hẹn tư vấn đã được cập nhật',
                content: emailContent,
                status: NotificationStatus.Pending,
              },
            });
          }
        } catch (error) {
          this.logger.error(`Gửi email thất bại: ${error.message}`);
        }
      }
    }

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
        where: { test_code: testCode, deleted_at: null },
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
      include: {
        test_result: true,
        feedback: {
          select: {
            feedback_id: true,
            rating: true,
            comment: true,
            is_public: true,
            is_anonymous: true,
            created_at: true,
            user: { select: { full_name: true } },
          },
        },
      },
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
      feedbacks: appointment.feedback || [],
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
    const { notes, meeting_link } = dto;

    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
      include: {
        test_result: true,
        schedule: true,
        service: true,
        user: { select: { email: true, full_name: true } },
        consultant: { include: { user: { select: { email: true, full_name: true } } } },
      },
    });
    if (!appointment) throw new BadRequestException('Lịch hẹn không tồn tại');
    if (appointment.status !== AppointmentStatus.Pending) throw new BadRequestException('Lịch hẹn không ở trạng thái Pending');
    if (appointment.payment_status !== 'Paid' && !appointment.is_free_consultation) {
      throw new BadRequestException('Lịch hẹn chưa được thanh toán');
    }
    if (appointment.type === 'Consultation' && !appointment.schedule) {
      throw new BadRequestException('Lịch hẹn tư vấn phải có lịch trống hợp lệ');
    }

    // Kiểm tra meeting_link
    if (appointment.mode === ServiceMode.ONLINE && !meeting_link) {
      throw new BadRequestException('Link hội nghị trực tuyến là bắt buộc cho mode ONLINE');
    }
    if (appointment.mode !== ServiceMode.ONLINE && meeting_link) {
      throw new BadRequestException('Link hội nghị trực tuyến chỉ áp dụng cho mode ONLINE');
    }

    const updatedAppointment = await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { appointment_id: appointmentId },
        data: {
          status: AppointmentStatus.Confirmed,
          meeting_link: appointment.mode === ServiceMode.ONLINE ? meeting_link : null,
          location: appointment.mode === ServiceMode.ONLINE ? null : appointment.location,
          updated_at: new Date(),
        },
      }),
      this.prisma.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          status: AppointmentStatus.Confirmed,
          notes: notes || `Xác nhận lịch hẹn (${appointment.mode}${meeting_link ? `, link: ${meeting_link}` : ''})`,
          changed_by: staffId,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          user_id: staffId,
          action: 'CONFIRM_APPOINTMENT',
          entity_type: 'Appointment',
          entity_id: appointmentId,
          details: { status: AppointmentStatus.Confirmed, notes, meeting_link },
        },
      }),
      ...(appointment.mode === ServiceMode.ONLINE
        ? [
          this.prisma.notification.create({
            data: {
              user_id: appointment.user_id,
              type: NotificationType.Email,
              title: 'Lịch hẹn tư vấn đã được xác nhận',
              content: `Lịch hẹn của bạn (mã ${appointmentId}) đã được xác nhận. Tham gia qua link: ${meeting_link}`,
              status: NotificationStatus.Pending,
            },
          }),
          ...(appointment.consultant
            ? [
              this.prisma.notification.create({
                data: {
                  user_id: appointment.consultant.user_id,
                  type: NotificationType.Email,
                  title: 'Lịch hẹn tư vấn đã được xác nhận',
                  content: `Lịch hẹn (mã ${appointmentId}) với khách hàng ${appointment.user.full_name} đã được xác nhận. Tham gia qua link: ${meeting_link}`,
                  status: NotificationStatus.Pending,
                },
              }),
            ]
            : []),
        ]
        : []),
    ]);

    // Gửi email thông báo
    if (appointment.mode === ServiceMode.ONLINE) {
      const emailContent = `Lịch hẹn tư vấn (mã ${appointmentId}) đã được xác nhận. Tham gia qua link: ${meeting_link}`;
      try {
        await this.emailService.sendEmail(
          appointment.user.email,
          'Lịch hẹn tư vấn đã được xác nhận',
          emailContent,
        );
        if (appointment.consultant) {
          await this.emailService.sendEmail(
            appointment.consultant.user.email,
            'Lịch hẹn tư vấn đã được xác nhận',
            emailContent,
          );
        }
      } catch (error) {
        this.logger.error(`Gửi email thất bại: ${error.message}`);
      }
    }

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
    if (!appointment || appointment.type !== 'Consultation') {
      throw new BadRequestException('Lịch hẹn không hợp lệ');
    }
    if (appointment.status !== AppointmentStatus.Completed) {
      throw new BadRequestException('Lịch hẹn chưa hoàn thành');
    }
    if (!appointment.consultant_id) {
      throw new BadRequestException('Lịch hẹn không có tư vấn viên');
    }

    const existingFeedback = await this.prisma.feedback.findFirst({
      where: { appointment_id: appointmentId, user_id: userId },
    });

    let feedback;
    if (existingFeedback) {
      feedback = await this.prisma.feedback.update({
        where: { feedback_id: existingFeedback.feedback_id },
        data: {
          rating: dto.rating,
          comment: dto.comment,
          status: FeedbackStatus.Approved,
          service_id: appointment.service_id, // Thêm service_id khi cập nhật
          updated_at: new Date(),
        },
      });
    } else {
      feedback = await this.prisma.feedback.create({
        data: {
          user_id: userId,
          appointment_id: appointmentId,
          consultant_id: appointment.consultant_id,
          service_id: appointment.service_id,
          rating: dto.rating,
          comment: dto.comment,
          is_public: true,
          is_anonymous: false,
          status: FeedbackStatus.Approved,
        },
      });
    }

    // Ghi log hành động
    await this.prisma.auditLog.create({
      data: {
        user_id: userId,
        action: existingFeedback ? 'UPDATE_FEEDBACK' : 'CREATE_FEEDBACK',
        entity_type: 'Feedback',
        entity_id: feedback.feedback_id,
        details: { rating: dto.rating, comment: dto.comment, service_id: appointment.service_id },
      },
    });

    // Cập nhật điểm trung bình cho consultant
    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { consultant_id: appointment.consultant_id },
    });
    if (consultant) {
      const feedbacks = await this.prisma.feedback.findMany({
        where: { consultant_id: consultant.consultant_id, status: FeedbackStatus.Approved },
      });
      const avgRating = feedbacks.length
        ? Number((feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(2))
        : 0;
      await this.prisma.consultantProfile.update({
        where: { consultant_id: consultant.consultant_id },
        data: { average_rating: avgRating },
      });
    }

    return { feedback, message: existingFeedback ? 'Cập nhật feedback thành công' : 'Gửi feedback thành công' };
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
        meeting_link: appt.meeting_link,
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
        status: appt.status,
        meeting_link: appt.meeting_link,
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
      where: { test_code: testCode, deleted_at: null },
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
    if (appointment.status !== AppointmentStatus.Confirmed) {
      throw new BadRequestException('Lịch hẹn phải ở trạng thái Confirmed để bắt đầu');
    }

    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { user_id: userId },
    });
    if (!consultant || appointment.consultant_id !== consultant.consultant_id) {
      throw new ForbiddenException('Bạn không có quyền bắt đầu buổi tư vấn này');
    }

    let notificationStatus: NotificationStatus = NotificationStatus.Pending;
    try {
      await this.emailService.sendEmail(
        appointment.user.email,
        'Buổi tư vấn đã bắt đầu',
        `Buổi tư vấn của bạn (mã ${appointmentId}) với tư vấn viên ${appointment.consultant?.user.full_name || 'Không xác định'} cho dịch vụ ${appointment.service?.name || 'Không xác định'} đã bắt đầu vào ${new Date().toISOString()}.`,
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
          status: AppointmentStatus.InProgress,
          updated_at: new Date(),
        },
      }),
      this.prisma.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          status: AppointmentStatus.InProgress,
          notes: 'Buổi tư vấn đã bắt đầu',
          changed_by: userId,
          changed_at: new Date(),
        },
      }),
      this.prisma.notification.create({
        data: {
          user_id: appointment.user_id,
          type: NotificationType.Email,
          title: 'Buổi tư vấn đã bắt đầu',
          content: `Buổi tư vấn của bạn với mã ${appointmentId} đã bắt đầu.`,
          status: notificationStatus,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          user_id: userId,
          action: 'START_CONSULTATION',
          entity_type: 'Appointment',
          entity_id: appointmentId,
          details: { status: AppointmentStatus.InProgress },
        },
      }),
    ]);

    this.logger.log(`Buổi tư vấn ${appointmentId} đã bắt đầu bởi Consultant ${userId}`);
    return {
      appointment: updatedAppointment[0],
      serviceName: appointment.service?.name || 'Không xác định',
      consultantName: appointment.consultant?.user.full_name || 'Không xác định',
      message: 'Bắt đầu buổi tư vấn thành công',
    };
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


  async getConsultantAppointments(userId: string) {
    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { user_id: userId, deleted_at: null },
    });
    if (!consultant) {
      throw new NotFoundException('Không tìm thấy hồ sơ Consultant');
    }

    const appointments = await this.prisma.appointment.findMany({
      where: {
        consultant_id: consultant.consultant_id,
        deleted_at: null,
        status: { not: AppointmentStatus.Cancelled },
      },
      include: {
        user: { select: { user_id: true, full_name: true, email: true, phone_number: true } },
        service: { select: { service_id: true, name: true, category: true } },
        schedule: { select: { schedule_id: true, start_time: true, end_time: true } },
        feedback: {
          select: {
            feedback_id: true,
            rating: true,
            comment: true,
            is_public: true,
            is_anonymous: true,
            created_at: true,
            user: { select: { full_name: true } },
          },
        },
      },
      orderBy: { start_time: 'asc' },
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
        meeting_link: appt.meeting_link,
        user: {
          user_id: appt.user.user_id,
          full_name: appt.user.full_name,
          email: appt.user.email,
          phone_number: appt.user.phone_number,
        },
        service: appt.service,
        schedule: appt.schedule,
        feedback: appt.feedback || [],
      })),
      total: appointments.length,
      message: appointments.length > 0 ? 'Lấy danh sách lịch hẹn thành công' : 'Không có lịch hẹn nào',
    };
  }
}

