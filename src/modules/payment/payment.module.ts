import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentService } from './services/payment.service';
import { PaymentController } from './controllers/payment.controller';
import { PaymentWebhookController } from './controllers/payment-webhook.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { PaymentCleanupService } from './services/payment-cleanup.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()], 
  providers: [PaymentService, PrismaService, PaymentCleanupService], 
  controllers: [PaymentController, PaymentWebhookController],
  exports: [PaymentService],
})
export class PaymentModule {}