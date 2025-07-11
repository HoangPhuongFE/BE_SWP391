// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { QuestionsModule } from './modules/questions/questions.module';
import { CloudinaryModule } from 'nestjs-cloudinary';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CloudinaryModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        cloud_name: configService.get('CLOUDINARY_CLOUD_NAME'),
        api_key: configService.get('CLOUDINARY_API_KEY'),
        api_secret: configService.get('CLOUDINARY_API_SECRET'),
      }),
      inject: [ConfigService],
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
    QuestionsModule,
  ],
})
export class AppModule {}