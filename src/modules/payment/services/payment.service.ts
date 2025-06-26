import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import PayOS from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentDto } from '../dtos/create-payment.dto';

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

  /** Tạo link + lưu Payment (Pending) */
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

    try {
      await this.prisma.payment.create({
        data: {
          payment_id: crypto.randomUUID(), // Tự sinh UUID nếu cần
          user_id: userId,
          appointment_id: dto.appointmentId,
          order_code: dto.orderCode,
          amount: dto.amount,
          payment_method: dto.paymentMethod,
          status: 'Pending',
          expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 phút
        },
      });
    } catch (err) {
      this.logger.error('Lưu Payment vào DB lỗi:', err);
      throw new BadRequestException('Lưu thanh toán thất bại');
    }

    return { paymentLink: linkData.checkoutUrl, message: 'OK' }; // Sửa thành checkoutUrl nếu đúng
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
      await this.prisma.appointment.update({
        where: { appointment_id: payment.appointment_id },
        data: { payment_status: 'Paid' },
      });
      this.logger.log(`Payment success orderCode=${orderCode}, appointment.payment_status=Paid`);
    } else {
      this.logger.log(`Payment failed orderCode=${orderCode}`);
    }
  }
}
