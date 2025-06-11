// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CycleModule } from './modules/cycles/cycle.module';
import { ServiceModule } from './modules/services/service.module';
import { ScheduleModule } from './modules/schedules/schedule.module';
import { AppointmentModule } from './modules/appointments/appointment.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    PrismaModule,
    CycleModule,
    ServiceModule,
    ScheduleModule,
    AppointmentModule,
    PaymentModule,
    EmailModule,
  ],
})
export class AppModule {}