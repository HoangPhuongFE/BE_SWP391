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
    if (isNaN(orderCode)) return;

    const payment = await this.prisma.payment.findUnique({
      where: { order_code: orderCode },
      include: { appointment: true },
    });
    if (!payment) {
      this.logger.warn(`Không tìm thấy Payment orderCode=${orderCode}`);
      return;
    }

    // Xác định success
    const isSuccess =
      payload.success === true ||
      payload.code === '00' ||
      payload.data?.code === '00';

    // Cập nhật payment.status
    await this.prisma.payment.update({
      where: { order_code: orderCode },
      data: { status: isSuccess ? 'Completed' : 'Failed' },
    });

    // Nếu thành công, chỉ update appointment.payment_status
 if (isSuccess) {
  const updatedAppointment = await this.prisma.appointment.update({
    where: { appointment_id: payment.appointment_id },
    data: {
      payment_status: 'Paid',
    },
    select: {
      schedule_id: true,
    },
  });

  // Nếu có schedule_id → cập nhật is_booked
  if (updatedAppointment.schedule_id) {
    await this.prisma.schedule.update({
      where: { schedule_id: updatedAppointment.schedule_id },
      data: { is_booked: true },
    });
    this.logger.log(`Lịch ${updatedAppointment.schedule_id} đã được cập nhật is_booked=true`);
  }

  this.logger.log(`Payment success: appointment_id=${payment.appointment_id}, status=Confirmed, payment_status=Paid`);
}
}
}