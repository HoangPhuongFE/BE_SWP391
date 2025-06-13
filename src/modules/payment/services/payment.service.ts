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
    private prisma: PrismaService,
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

    // Lưu record vào DB (nếu lỗi vẫn trả link nhưng ghi log)
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
   * Xử lý callback từ PayOS: update Payment, Appointment, và Schedule
   */
  async processPaymentCallback(payload: any) {
    this.logger.log('PayOS callback payload:', JSON.stringify(payload));

    // Lấy orderCode
    const orderCodeRaw = payload.data?.orderCode ?? payload.data?.order_code;
    const orderCode = Number(orderCodeRaw);
    if (!orderCode || isNaN(orderCode)) {
      this.logger.error('orderCode bị thiếu hoặc không hợp lệ:', payload);
      throw new BadRequestException('orderCode không hợp lệ!');
    }

    // Tìm payment
    const existing = await this.prisma.payment.findUnique({
      where: { order_code: orderCode },
    });
    if (!existing) {
      this.logger.warn(`Callback nhận về nhưng không tìm thấy payment orderCode=${orderCode}`);
      return;
    }

    // Xác định trạng thái mới
    const txStatus = payload.data?.status || payload.status || payload.data?.desc;
    let newStatus: 'Pending' | 'Completed' | 'Failed' = 'Pending';
    if (txStatus === 'PAID' || txStatus === 'Thành công') newStatus = 'Completed';
    else if (txStatus === 'CANCELLED') newStatus = 'Failed';

    // Update payment
    await this.prisma.payment.update({
      where: { order_code: orderCode },
      data: { status: newStatus },
    });

    // Nếu thành công, update appointment và đánh dấu schedule là booked
    if (newStatus === 'Completed') {
      await this.prisma.appointment.update({
        where: { appointment_id: existing.appointment_id },
        data: { payment_status: 'Paid' },
      });

      // Đánh dấu slot đã book
      // Lấy thông tin appointment để lấy schedule_id
      const appointment = await this.prisma.appointment.findUnique({
        where: { appointment_id: existing.appointment_id },
        select: { schedule_id: true },
      });
      if (appointment && appointment.schedule_id) {
        await this.prisma.schedule.update({
          where: { schedule_id: appointment.schedule_id },
          data: { is_booked: true },
        });
      } else {
        this.logger.warn(`Không tìm thấy appointment hoặc schedule_id cho appointment_id=${existing.appointment_id}`);
      }
    }

    this.logger.log(`Cập nhật callback thành công cho orderCode ${orderCode}`);
  }
}
