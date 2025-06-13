import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import PayOS from '@payos/node';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  [x: string]: any;
  private readonly logger = new Logger(PaymentService.name);
  private readonly payos: PayOS;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const id = this.config.get<string>('PAYOS_CLIENT_ID');
    const key = this.config.get<string>('PAYOS_API_KEY');
    const ck  = this.config.get<string>('PAYOS_CHECKSUM_KEY');
    if (!id||!key||!ck) throw new BadRequestException('Thiếu PayOS config');
    this.payos = new PayOS(id, key, ck);
  }

  /** Tạo link + lưu vào Payment */
  async createPaymentLink(userId: string, dto: CreatePaymentDto) {
    const {
      orderCode, amount, description,
      cancelUrl, returnUrl,
      buyerName, buyerEmail, buyerPhone,
      paymentMethod, appointmentId,
    } = dto;

    let linkData;
    try {
      linkData = await this.payos.createPaymentLink({
        orderCode, amount, description,
        cancelUrl, returnUrl,
        buyerName, buyerEmail, buyerPhone,
      });
    } catch (e) {
      this.logger.error('Tạo link lỗi', e);
      throw new BadRequestException('Không thể tạo link thanh toán');
    }

    // Lưu vào DB
    try {
      await this.prisma.payment.create({
        data: {
          user_id:        userId,
          appointment_id: appointmentId,
          order_code:     orderCode,
          amount,
          payment_method: paymentMethod,
          status:         'Pending',
        },
      });
    } catch (e) {
      this.logger.error('Lưu payment lỗi', e);
    }

    return { paymentLink: linkData, message: 'OK' };
  }

  /** Xử lý callback từ PayOS */
  async processPaymentCallback(payload: any) {
    this.logger.log('Callback payload:', JSON.stringify(payload));

    const codeRaw  = payload.data?.orderCode ?? payload.data?.order_code;
    const orderCode = Number(codeRaw);
    if (!orderCode) return;

    // 1) Tìm payment kèm appointment
    const existing = await this.prisma.payment.findUnique({
      where:   { order_code: orderCode },
      include: { appointment: true },
    });
    if (!existing) {
      this.logger.warn(`Không tìm thấy payment ${orderCode}`);
      return;
    }

    // 2) Xác định trạng thái mới
    const tx = payload.data?.status || payload.status || payload.data?.desc;
    let newStatus: 'Pending' | 'Completed' | 'Failed' = 'Pending';
    if (tx === 'PAID' || tx === 'Thành công') newStatus = 'Completed';
    else if (tx === 'CANCELLED')               newStatus = 'Failed';

    // 3) Cập nhật payment.status
    await this.prisma.payment.update({
      where: { order_code: orderCode },
      data:  { status: newStatus },
    });

    // 4) Nếu thành công, cập nhật appointment + schedule
    if (newStatus === 'Completed') {
      await this.prisma.appointment.update({
        where: { appointment_id: existing.appointment_id },
        data:  {
          payment_status: 'Paid',
          status:         'Confirmed',
        },
      });
      const sid = existing.appointment.schedule_id;
      if (sid) {
        await this.prisma.schedule.update({
          where: { schedule_id: sid },
          data:  { is_booked: true },
        });
      }
    }

    this.logger.log(`Cập nhật callback hoàn tất cho orderCode=${orderCode}`);
  }
}
