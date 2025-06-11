import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';

@Controller('payment')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('callback')
  @HttpCode(200)
  async handlePayOSCallback(@Body() payload: any, @Headers('x-payos-signature') signature: string) {
    this.logger.log('Nhận callback từ PayOS:', payload);
    await this.paymentService.processPaymentCallback(payload);
    return { message: 'Callback received' };
  }
}
