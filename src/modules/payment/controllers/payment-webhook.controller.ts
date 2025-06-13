// src/modules/payment/controllers/payment-webhook.controller.ts
import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';

@Controller('payment')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('callback')
  @HttpCode(200)
  async handlePayOSCallback(
    @Body() payload: any,
    @Headers('x-payos-signature') signature: string
  ) {
    this.logger.log('Nhận callback từ PayOS:', JSON.stringify(payload));

    try {
      await this.paymentService.processPaymentCallback(payload);
    } catch (err) {
      // Ghi log lỗi nhưng KHÔNG THROW để luôn trả về 200
      this.logger.error('Xử lý callback lỗi:', err);
    }

    return { received: true };
  }
}
