import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import PayOS from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentDto } from '../dtos/create-payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly payos: PayOS;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const clientId = this.config.get<string>('PAYOS_CLIENT_ID');
    const apiKey   = this.config.get<string>('PAYOS_API_KEY');
    const ckKey    = this.config.get<string>('PAYOS_CHECKSUM_KEY');
    if (!clientId || !apiKey || !ckKey) {
      throw new BadRequestException('Thiếu cấu hình PayOS');
    }
    this.payos = new PayOS(clientId, apiKey, ckKey);
  }

  /** Tạo link thanh toán + lưu Payment (Pending) */
  async createPaymentLink(userId: string, dto: CreatePaymentDto) {
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

    // Lưu record Payment
    try {
      await this.prisma.payment.create({
        data: {
          user_id:        userId,
          appointment_id: dto.appointmentId,
          order_code:     dto.orderCode,
          amount:         dto.amount,
          payment_method: dto.paymentMethod,
          status:         'Pending',
        },
      });
    } catch (err) {
      this.logger.error('Lưu Payment vào DB lỗi:', err);
    }

    return { paymentLink: linkData, message: 'OK' };
  }

  /** Lấy thông tin link đã tạo */
  async getPaymentLinkInfo(orderCode: number) {
    try {
      const info = await this.payos.getPaymentLinkInformation(orderCode);
      return { paymentInfo: info, message: 'OK' };
    } catch (err) {
      this.logger.error('Lấy thông tin PayOS lỗi:', err);
      throw new BadRequestException('Không thể lấy thông tin thanh toán');
    }
  }

  /** Xử lý callback từ PayOS */
  async processPaymentCallback(payload: any) {
    this.logger.log('Callback payload:', payload);

    const raw = payload.data?.orderCode ?? payload.data?.order_code;
    const orderCode = Number(raw);
    if (!orderCode) return;

    // 1) Tìm payment kèm luôn appointment
    const payment = await this.prisma.payment.findUnique({
      where: { order_code: orderCode },
      include: { appointment: true },
    });
    if (!payment) {
      this.logger.warn(`Không tìm thấy Payment với orderCode=${orderCode}`);
      return;
    }

    // 2) Xác định trạng thái mới
    const tx = payload.data?.status || payload.status || payload.data?.desc;
    let newStatus: 'Pending' | 'Completed' | 'Failed' = 'Pending';
    if (tx === 'PAID' || tx === 'Thành công') newStatus = 'Completed';
    else if (tx === 'CANCELLED')                 newStatus = 'Failed';

    // 3) Cập nhật Payment.status
    await this.prisma.payment.update({
      where: { order_code: orderCode },
      data:  { status: newStatus },
    });

    // 4) Nếu thành công, cập nhật luôn Appointment và Schedule
    if (newStatus === 'Completed') {
      await this.prisma.appointment.update({
        where: { appointment_id: payment.appointment_id },
        data: {
          payment_status: 'Paid',
          status:         'Confirmed',
        },
      });
      const sid = payment.appointment.schedule_id;
      if (sid) {
        await this.prisma.schedule.update({
          where: { schedule_id: sid },
          data: { is_booked: true },
        });
      }
    }

    this.logger.log(`Callback xử lý xong orderCode=${orderCode}`);
  }
}
