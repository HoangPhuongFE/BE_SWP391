// src/modules/payment/services/payment.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PayOS from '@payos/node';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly payos: PayOS;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.configService.get<string>('PAYOS_API_KEY');
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY');
    if (!clientId || !apiKey || !checksumKey) {
      throw new BadRequestException('Thiếu thông tin cấu hình PayOS');
    }
    this.payos = new PayOS(clientId, apiKey, checksumKey);
  }

  /**
   * Tạo link thanh toán và lưu record Payment vào DB
   */
  async createPaymentLink(userId: string, dto: CreatePaymentDto) {
    const {
      orderCode,
      amount,
      description,
      cancelUrl,
      returnUrl,
      buyerName,
      buyerEmail,
      buyerPhone,
      paymentMethod,
      appointmentId,
    } = dto;

    let paymentLinkData;
    try {
      paymentLinkData = await this.payos.createPaymentLink({
        orderCode,
        amount,
        description,
        cancelUrl,
        returnUrl,
        buyerName,
        buyerEmail,
        buyerPhone,
      });
    } catch (error) {
      this.logger.error(`Lỗi tạo liên kết thanh toán: ${error.message}`, error.stack);
      throw new BadRequestException('Không thể tạo liên kết thanh toán');
    }

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
    } catch (dbError) {
      this.logger.error('Không thể lưu payment vào DB:', dbError);
    }

    return {
      paymentLink: paymentLinkData,
      message: 'Tạo liên kết thanh toán và lưu thành công',
    };
  }

  /**
   * Lấy thông tin link thanh toán từ PayOS
   */
  async getPaymentLinkInfo(orderCode: number) {
    try {
      const paymentInfo = await this.payos.getPaymentLinkInformation(orderCode);
      return { paymentInfo, message: 'Lấy thông tin thanh toán thành công' };
    } catch (error) {
      this.logger.error(`Lỗi lấy thông tin thanh toán: ${error.message}`, error.stack);
      throw new BadRequestException('Không thể lấy thông tin thanh toán');
    }
  }

  /**
   * Xử lý callback từ PayOS: update Payment & Appointment
   */
  async processPaymentCallback(payload: any) {
    this.logger.log('PayOS callback payload:', JSON.stringify(payload));

    const orderCodeRaw = payload.data?.orderCode ?? payload.data?.order_code;
    const orderCode = Number(orderCodeRaw);
    if (!orderCode || isNaN(orderCode)) {
      this.logger.error('orderCode bị thiếu hoặc không hợp lệ:', payload);
      throw new BadRequestException('orderCode không hợp lệ!');
    }

    const existing = await this.prisma.payment.findUnique({ where: { order_code: orderCode } });
    if (!existing) {
      this.logger.error(`Không tìm thấy payment với orderCode ${orderCode}`);
      throw new BadRequestException(`Không tìm thấy payment với orderCode ${orderCode}`);
    }

    const txStatus = payload.data?.status || payload.status || payload.data?.desc;
    let newStatus: 'Pending' | 'Completed' | 'Failed' = 'Pending';
    if (txStatus === 'PAID' || txStatus === 'Thành công') newStatus = 'Completed';
    else if (txStatus === 'CANCELLED') newStatus = 'Failed';

    await this.prisma.payment.update({
      where: { order_code: orderCode },
      data: { status: newStatus },
    });

    if (newStatus === 'Completed') {
      await this.prisma.appointment.update({
        where: { appointment_id: existing.appointment_id },
        data: { payment_status: 'Paid' },
      });
    }

    this.logger.log(`Cập nhật callback thành công cho orderCode ${orderCode}`);
  }
}
