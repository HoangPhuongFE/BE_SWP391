import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PayOS from '@payos/node';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly payos: PayOS;

  constructor(private configService: ConfigService, private prisma: PrismaService) {
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.configService.get<string>('PAYOS_API_KEY');
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY');

    if (!clientId || !apiKey || !checksumKey) {
      throw new BadRequestException('Thiếu thông tin cấu hình PayOS');
    }

    try {
      this.payos = new PayOS(clientId, apiKey, checksumKey);
    } catch (error) {
      this.logger.error(`Lỗi khởi tạo PayOS: ${error.message}`, error.stack);
      throw new BadRequestException('Không thể khởi tạo PayOS');
    }
  }

  async createPaymentLink(dto: CreatePaymentDto) {
    const { orderCode, amount, description, cancelUrl, returnUrl, buyerName, buyerEmail, buyerPhone } = dto;

    try {
      const paymentLinkData = await this.payos.createPaymentLink({
        orderCode,
        amount,
        description,
        cancelUrl,
        returnUrl,
        buyerName,
        buyerEmail,
        buyerPhone,
      });

      return { paymentLink: paymentLinkData, message: 'Tạo liên kết thanh toán thành công' };
    } catch (error) {
      this.logger.error(`Lỗi tạo liên kết thanh toán: ${error.message}`, error.stack);
      throw new BadRequestException('Không thể tạo liên kết thanh toán');
    }
  }

  async getPaymentLinkInfo(orderCode: number) {
    try {
      const paymentInfo = await this.payos.getPaymentLinkInformation(orderCode);
      return { paymentInfo, message: 'Lấy thông tin thanh toán thành công' };
    } catch (error) {
      this.logger.error(`Lỗi lấy thông tin thanh toán: ${error.message}`, error.stack);
      throw new BadRequestException('Không thể lấy thông tin thanh toán');
    }
  }

  async processPaymentCallback(payload: any) {
    try {
      const orderCode = payload.orderCode;
      const transactionStatus = payload.status;

      let newStatus = 'Pending';
      if (transactionStatus === 'PAID') {
        newStatus = 'Completed';
      } else if (transactionStatus === 'CANCELLED') {
        newStatus = 'Failed';
      }

      const payment = await this.prisma.payment.update({
        where: { order_code: orderCode },
        data: {
          status: newStatus as any,
        },
      });

      if (newStatus === 'Completed') {
        await this.prisma.appointment.update({
          where: { appointment_id: payment.appointment_id },
          data: { payment_status: 'Paid' },
        });
      }

      this.logger.log(`Cập nhật callback thành công cho orderCode ${orderCode}`);
    } catch (error) {
      this.logger.error('Lỗi xử lý callback: ', error);
      throw new BadRequestException('Lỗi xử lý callback từ PayOS');
    }
  }
}
