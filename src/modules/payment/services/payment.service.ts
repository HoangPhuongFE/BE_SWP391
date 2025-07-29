import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import PayOS from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { AppointmentStatus, NotificationStatus, NotificationType, PaymentStatus, PaymentTransactionStatus } from '@prisma/client';

@Injectable()
export class PaymentService {
  [x: string]: any;
  private readonly logger = new Logger(PaymentService.name);
  private readonly payos: PayOS;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const clientId = this.config.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.config.get<string>('PAYOS_API_KEY');
    const ckKey = this.config.get<string>('PAYOS_CHECKSUM_KEY');
    if (!clientId || !apiKey || !ckKey) {
      throw new BadRequestException('Thiếu cấu hình PayOS');
    }
    this.payos = new PayOS(clientId, apiKey, ckKey);
  }

  /** Tạo link thanh toán */
  async createPaymentLink(userId: string, dto: CreatePaymentDto) {
    // Kiểm tra đầu vào cơ bản
    if (!dto.appointmentId) {
      this.logger.warn('Thiếu appointmentId trong DTO');
      throw new BadRequestException('Thiếu thông tin lịch hẹn');
    }

    // Kiểm tra appointment_id có tồn tại không
    const appointmentExists = await this.prisma.appointment.findUnique({
      where: { appointment_id: dto.appointmentId },
      select: { appointment_id: true },
    });

    if (!appointmentExists) {
      this.logger.warn(`Không tìm thấy Appointment ID = ${dto.appointmentId}`);
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    // Kiểm tra xem Payment đã tồn tại với orderCode
    const existingPayment = await this.prisma.payment.findUnique({
      where: { order_code: dto.orderCode },
    });

    if (!existingPayment) {
      this.logger.warn(`Không tìm thấy Payment với orderCode = ${dto.orderCode}`);
      throw new BadRequestException('Thông tin thanh toán không tồn tại');
    }

    // Gọi PayOS để tạo link thanh toán
    let linkData;
    try {
      linkData = await this.payos.createPaymentLink({
        orderCode: dto.orderCode,
        amount: dto.amount,
        description: dto.description,
        cancelUrl: dto.cancelUrl,
        returnUrl: dto.returnUrl,
        buyerName: dto.buyerName,
        buyerEmail: dto.buyerEmail,
        buyerPhone: dto.buyerPhone,
      });
    } catch (err) {
      this.logger.error('Tạo link PayOS lỗi:', err);
      throw new BadRequestException('Không thể tạo link thanh toán');
    }

    return {
      paymentLink: linkData.checkoutUrl,
      message: 'OK',
    };
  }

  /** Xử lý callback từ PayOS */
  async processPaymentCallback(payload: any) {
  this.logger.log('Callback payload:', JSON.stringify(payload));

  const raw = payload.data?.orderCode ?? payload.data?.order_code;
  const orderCode = Number(raw);
  if (isNaN(orderCode)) {
    this.logger.warn('OrderCode không hợp lệ trong payload');
    throw new BadRequestException('OrderCode không hợp lệ');
  }

  const payment = await this.prisma.payment.findUnique({
    where: { order_code: orderCode },
    include: { appointment: { select: { appointment_id: true, status: true, schedule_id: true, user_id: true } } },
  });
  if (!payment) {
    this.logger.warn(`Không tìm thấy Payment orderCode=${orderCode}`);
    throw new BadRequestException('Thanh toán không tồn tại');
  }
  if (payment.appointment.status === AppointmentStatus.Cancelled) {
    this.logger.warn(`Lịch hẹn đã bị hủy: appointment_id=${payment.appointment_id}`);
    throw new BadRequestException('Lịch hẹn đã bị hủy');
  }

  const isSuccess = payload.success === true || payload.code === '00' || payload.data?.code === '00';

  const SYSTEM_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  await this.prisma.$transaction(async (tx) => {
    // Cập nhật payment.status
    await tx.payment.update({
      where: { order_code: orderCode },
      data: { status: isSuccess ? PaymentTransactionStatus.Completed : PaymentTransactionStatus.Failed },
    });

    // Cập nhật appointment
    await tx.appointment.update({
      where: { appointment_id: payment.appointment_id },
      data: {
        payment_status: isSuccess ? PaymentStatus.Paid : PaymentStatus.Failed,
        status: isSuccess ? AppointmentStatus.Confirmed : AppointmentStatus.Cancelled,
      },
    });

    // Ghi lịch sử trạng thái
    await tx.appointmentStatusHistory.create({
      data: {
        appointment_id: payment.appointment_id,
        status: isSuccess ? AppointmentStatus.Confirmed : AppointmentStatus.Cancelled,
        notes: isSuccess ? 'Xác nhận lịch hẹn sau thanh toán' : 'Hủy do thanh toán thất bại',
        changed_by: SYSTEM_USER_ID,
      },
    });

    // Cập nhật schedule nếu thành công
    if (isSuccess && payment.appointment.schedule_id) {
      await tx.schedule.update({
        where: { schedule_id: payment.appointment.schedule_id },
        data: { is_booked: true },
      });
    }

    // Gửi thông báo
    await tx.notification.create({
      data: {
        user_id: payment.appointment.user_id,
        type: NotificationType.Email,
        title: isSuccess ? 'Lịch hẹn đã được xác nhận' : 'Lịch hẹn đã bị hủy',
        content: isSuccess
          ? `Lịch hẹn ${payment.appointment_id} đã được xác nhận sau khi thanh toán thành công.`
          : `Lịch hẹn ${payment.appointment_id} đã bị hủy do thanh toán thất bại.`,
        status: NotificationStatus.Pending,
      },
    });
  });

  this.logger.log(`Processed payment callback: orderCode=${orderCode}, success=${isSuccess}`);
}


}
