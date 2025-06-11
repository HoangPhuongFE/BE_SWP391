// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CycleModule } from './modules/cycles/cycle.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './modules/email/email.module';
import { ServiceModule } from './modules/services/service.module';
import { AppointmentModule } from './modules/appointments/appointment.module';
import { ScheduleModule } from './modules/schedules/schedule.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    PrismaModule,
    CycleModule,
    ServiceModule,
    EmailModule,
    AppointmentModule,
    ScheduleModule,
  ],
})
export class AppModule {}