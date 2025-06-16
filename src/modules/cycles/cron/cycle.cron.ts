import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CycleCron {
  private readonly logger = new Logger(CycleCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkMissedUpdates() {
    const users = await this.prisma.user.findMany({
      where: { role: 'Customer' },
      include: { menstrual_cycles: { orderBy: { start_date: 'desc' }, take: 1 } },
    });

    for (const user of users) {
      const lastCycle = user.menstrual_cycles[0];
      if (!lastCycle) continue;

      const expectedNext = new Date(
        lastCycle.start_date.getTime() + (lastCycle.cycle_length || 28) * 24 * 60 * 60 * 1000,
      );
      const now = new Date();
      const daysMissed = (now.getTime() - expectedNext.getTime()) / (1000 * 60 * 60 * 24);

      if (daysMissed > 3) {
        await this.prisma.notification.create({
          data: {
            user_id: user.user_id,
            type: 'Email',
            title: 'Nhắc nhở cập nhật chu kỳ',
            content: `Bạn chưa cập nhật chu kỳ mới. Vui lòng ghi nhận tại: ${process.env.FRONTEND_URL_PROD}/cycles`,
            status: 'Pending',
          },
        });
        this.logger.log(`Gửi nhắc nhở cho user ${user.user_id}`);
      }
    }
  }
}