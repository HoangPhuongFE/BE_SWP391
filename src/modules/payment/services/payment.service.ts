import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import PayOS from '@payos/node';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly payos: PayOS;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const id = this.config.get('PAYOS_CLIENT_ID');
    const key = this.config.get('PAYOS_API_KEY');
    const ck  = this.config.get('PAYOS_CHECKSUM_KEY');
    if (!id||!key||!ck) throw new BadRequestException('Thiếu PayOS config');
    this.payos = new PayOS(id, key, ck);
  }

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
          user_id: userId,
          appointment_id: appointmentId,
          order_code: orderCode,
          amount,
          payment_method: paymentMethod,
          status: 'Pending',
        },
      });
    } catch (e) {
      this.logger.error('Lưu payment lỗi', e);
    }

    return { paymentLink: linkData, message: 'OK' };
  }

  async getPaymentLinkInfo(orderCode: number) {
    try {
      const info = await this.payos.getPaymentLinkInformation(orderCode);
      return { paymentInfo: info, message: 'OK' };
    } catch (e) {
      this.logger.error('Lấy info lỗi', e);
      throw new BadRequestException('Không thể lấy thông tin');
    }
  }

  async processPaymentCallback(payload: any) {
    this.logger.log('Callback payload:', payload);

    const codeRaw = payload.data?.orderCode ?? payload.data?.order_code;
    const orderCode = Number(codeRaw);
    if (!orderCode) return;

    // Tìm payment kèm appointment
    const existing = await this.prisma.payment.findUnique({
      where: { order_code: orderCode },
      include: { appointment: true },
    });
    if (!existing) {
      this.logger.warn(`Không tìm thấy payment ${orderCode}`);
      return;
    }

    const tx = payload.data?.status || payload.status || payload.data?.desc;
    let newStatus: 'Pending' | 'Completed' | 'Failed' = 'Pending';
    if (tx === 'PAID' || tx === 'Thành công') newStatus = 'Completed';
    else if (tx === 'CANCELLED') newStatus = 'Failed';

    // 1) update payment.status
    await this.prisma.payment.update({
      where: { order_code: orderCode },
      data: { status: newStatus },
    });

    if (newStatus === 'Completed') {
      // 2) update appointment.payment_status and appointment.status
      await this.prisma.appointment.update({
        where: { appointment_id: existing.appointment_id },
        data: {
          payment_status: 'Paid',
          status:         'Confirmed',
        },
      });
      // 3) đánh dấu schedule.is_booked
      const sid = existing.appointment.schedule_id;
      if (sid) {
        await this.prisma.schedule.update({
          where: { schedule_id: sid },
          data: { is_booked: true },
        });
      }
    }

    this.logger.log(`Cập nhật callback hoàn tất cho ${orderCode}`);
  }
}
