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
import { BlogModule } from './modules/blog/blog.module';
import { BlogCommentModule } from './modules/blog-comment/blog-comment.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { CloudinaryModule } from 'nestjs-cloudinary';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CloudinaryModule.forRoot({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    }),
    DatabaseModule,
    AuthModule,
    PrismaModule,
    CycleModule,
    ServiceModule,
    ScheduleModule,
    AppointmentModule,
    PaymentModule,
    EmailModule,
    BlogModule,
    BlogCommentModule,
    ShippingModule,
  ],
})
export class AppModule {}