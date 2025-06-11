// src/modules/appointments/appointment.module.ts
import { Module } from '@nestjs/common';
import { AppointmentController } from './controllers/appointment.controller';
import { AppointmentService } from './services/appointment.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module'; // Thêm import PaymentModule
@Module({
  imports: [PrismaModule, PaymentModule],
  controllers: [AppointmentController],
  providers: [AppointmentService],
})
export class AppointmentModule {}