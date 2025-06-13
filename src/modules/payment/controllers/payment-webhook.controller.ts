import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';

@Controller('payment')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('callback')
  @HttpCode(200)
  async webhook(
    @Body() payload: any,
    @Headers('x-payos-signature') signature: string,
  ) {
    this.logger.log('Nhận callback PayOS:', JSON.stringify(payload));
    try {
      await this.paymentService.processPaymentCallback(payload);
    } catch (err) {
      // Luôn trả 200 để PayOS không retry
      this.logger.error('Xử lý callback lỗi:', err);
    }
    return { received: true };
  }
}
