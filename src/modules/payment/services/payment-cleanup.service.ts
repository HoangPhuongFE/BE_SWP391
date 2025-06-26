import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, AppointmentStatus, PaymentStatus, PaymentTransactionStatus } from '@prisma/client';

@Injectable()
export class PaymentCleanupService {
  private readonly logger = new Logger(PaymentCleanupService.name);
  private readonly SYSTEM_USER_ID = '550e8400-e29b-41d4-a716-446655440000'; // UUID cố định từ seed
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES) // Chạy mỗi 30 phút
  async handleExpiredPayments() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const expiredPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentTransactionStatus.Pending,
        OR: [
          { expires_at: { lte: new Date() } },
          { created_at: { lte: thirtyMinutesAgo } },
        ],
      },
      include: { appointment: { include: { schedule: true } } },
    });

    for (const payment of expiredPayments) {
      await this.prisma.$transaction(async (prisma) => {
        // Cập nhật Payment
        await prisma.payment.update({
          where: { payment_id: payment.payment_id },
          data: { status: PaymentTransactionStatus.Cancelled },
        });

        // Cập nhật Appointment
        await prisma.appointment.update({
          where: { appointment_id: payment.appointment_id },
          data: {
            status: AppointmentStatus.Cancelled,
            payment_status: PaymentStatus.Failed,
          },
        });

        // Ghi lịch sử trạng thái
        await prisma.appointmentStatusHistory.create({
          data: {
            appointment_id: payment.appointment_id,
            status: AppointmentStatus.Cancelled,
            notes: 'Hủy do không thanh toán trong 30 phút',
            changed_by: this.SYSTEM_USER_ID, 
          },
        });

        // Giải phóng Schedule (nếu có)
        if (payment.appointment?.schedule_id && payment.appointment.schedule?.is_booked) {
          await prisma.schedule.update({
            where: { schedule_id: payment.appointment.schedule_id },
            data: { is_booked: false },
          });
        }
      });

      this.logger.log(`Cancelled appointment ${payment.appointment_id} (payment ${payment.payment_id}) due to expiration`);
    }
  }
}