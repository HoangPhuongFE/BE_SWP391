import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SetupCycleDto } from '../dtos/setup-cycle.dto';
import { CreateCycleDto } from '../dtos/create-cycle.dto';
import { UpdateSymptomsDto } from '../dtos/update-symptoms.dto';
import { EmailService } from '@modules/email/email.service';

@Injectable()
export class CycleService {
  private readonly logger = new Logger(CycleService.name);

  constructor(private readonly prisma: PrismaService,
    private readonly emailService: EmailService) { }

  async setupCycle(userId: string, dto: SetupCycleDto) {
    const { startDate, periodLength, previousCycles } = dto;
    const start = new Date(startDate);
    const now = new Date();

    // Validate ngày kỳ hiện tại
    if (start > now) throw new BadRequestException('Ngày bắt đầu không được trong tương lai');

    // Kiểm tra periodLength
    if (periodLength < 2 || periodLength > 7) {
      this.logger.warn(`Độ dài kỳ kinh ${periodLength} ngoài khoảng 2-7 ngày`);
    }

    // Cần previousCycles có ít nhất 1 kỳ trước đó
    if (!previousCycles || previousCycles.length < 1) {
      throw new BadRequestException('Bạn cần nhập ít nhất 1 kỳ trước đó');
    }

    // Chỉ lấy kỳ trước đó
    const prev = previousCycles[0];
    const prevDate = new Date(prev.startDate);

    // Validate logic ngày
    if (prevDate >= start) throw new BadRequestException('Kỳ trước đó phải nhỏ hơn kỳ hiện tại');

    // Kiểm tra cách tối thiểu 20 ngày
    const daysBetween = (start.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysBetween < 20) throw new BadRequestException('2 kỳ liên tiếp phải cách nhau ít nhất 20 ngày');

    // Tính averageCycleLength
    const averageCycleLength = daysBetween;
    // Tính averagePeriodLength nếu user có nhập periodLength cho kỳ trước đó
    const averagePeriodLength = prev.periodLength
      ? (periodLength + prev.periodLength) / 2
      : periodLength;

    // Dự đoán kỳ tiếp theo
    const nextCycleStart = new Date(start.getTime() + averageCycleLength * 24 * 60 * 60 * 1000);
    const ovulationDate = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Lưu kỳ hiện tại
    const cycle = await this.prisma.menstrualCycle.create({
      data: {
        user_id: userId,
        start_date: start,
        period_length: periodLength,
        cycle_length: averageCycleLength,
        ovulation_date: ovulationDate,
      },
    });

    // Tạo notification
    await this.createNotifications(userId, nextCycleStart, ovulationDate);

    return {
      cycle,
      predictions: { nextCycleStart, ovulationDate },
      averageCycleLength,
      averagePeriodLength,
      message: 'Thiết lập chu kỳ thành công',
    };
  }
  async createCycle(userId: string, dto: CreateCycleDto) {
    const { startDate, periodLength, symptoms, notes } = dto;
    const start = new Date(startDate);
    const now = new Date();

    // Kiểm tra ngày hợp lệ
    if (start > now) {
      throw new BadRequestException('Ngày bắt đầu không được trong tương lai');
    }

    // Kiểm tra periodLength
    if (periodLength < 2 || periodLength > 7) {
      this.logger.warn(`Độ dài kỳ kinh ${periodLength} ngoài khoảng 2-7 ngày`);
    }

    // Kiểm tra cách kỳ trước tối thiểu 20 ngày
    const lastCycle = await this.prisma.menstrualCycle.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { start_date: 'desc' },
    });
    if (lastCycle) {
      const daysBetween = Math.floor((start.getTime() - lastCycle.start_date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysBetween < 20) {
        throw new BadRequestException('Chu kỳ mới phải cách chu kỳ trước đó ít nhất 20 ngày');
      }
    }

    // Tính độ dài chu kỳ
    let cycleLength = lastCycle
      ? Math.floor((start.getTime() - lastCycle.start_date.getTime()) / (1000 * 60 * 60 * 24))
      : 28;

    // Tính độ dài trung bình chu kỳ
    const cycles = await this.prisma.menstrualCycle.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { start_date: 'desc' },
      take: 3,
    });
    let averageCycleLength: number;
    let isDefaultUsed = false;

    if (cycles.length === 0) {
      averageCycleLength = 28; // Không có chu kỳ trước
      isDefaultUsed = true;
    } else if (cycles.length === 1) {
      averageCycleLength = cycleLength; // Dùng cycleLength của chu kỳ trước
    } else {
      averageCycleLength = Math.floor(
        cycles.reduce((sum, c) => sum + (c.cycle_length || cycleLength), 0) / cycles.length
      );
    }

    // Dự đoán chu kỳ và rụng trứng
    const nextCycleStart = new Date(start.getTime() + averageCycleLength * 24 * 60 * 60 * 1000);
    const ovulationDate = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Lưu chu kỳ
    const cycle = await this.prisma.menstrualCycle.create({
      data: {
        user_id: userId,
        start_date: start,
        period_length: periodLength,
        cycle_length: cycleLength,
        symptoms,
        notes,
        ovulation_date: ovulationDate,
      },
    });

    // Tạo thông báo nhắc nhở
    await this.createNotifications(userId, nextCycleStart, ovulationDate);

    return {
      cycle,
      predictions: { nextCycleStart, ovulationDate },
      averageCycleLength,
      isDefaultUsed,
      message: isDefaultUsed
        ? 'Cập nhật chu kỳ thành công, dự đoán dựa trên giá trị mặc định'
        : 'Cập nhật chu kỳ thành công',
    };
  }
  async updateSymptoms(userId: string, cycleId: string, dto: UpdateSymptomsDto) {
    const cycle = await this.prisma.menstrualCycle.findUnique({
      where: { cycle_id: cycleId, user_id: userId, deleted_at: null },
    });
    if (!cycle) {
      throw new BadRequestException('Chu kỳ không tồn tại hoặc không thuộc người dùng');
    }

    return this.prisma.menstrualCycle.update({
      where: { cycle_id: cycleId },
      data: { symptoms: dto.symptoms, notes: dto.notes },
    });
  }


  async getCycles(
    userId: string,
    query: { startDate?: string; endDate?: string; limit?: number; page?: number }
  ) {
    const { startDate, endDate, limit = 10, page = 1 } = query;
    const where: any = { user_id: userId, deleted_at: null };

    if (startDate) where.start_date = { gte: new Date(startDate) };
    if (endDate) where.start_date = { ...where.start_date, lte: new Date(endDate) };

    // Truy vấn dữ liệu chính
    const [cycles, total] = await this.prisma.$transaction([
      this.prisma.menstrualCycle.findMany({
        where,
        orderBy: { start_date: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.menstrualCycle.count({ where }),
    ]);

    // Dự đoán chu kỳ kế tiếp
    let predictions: { nextCycleStart: Date; ovulationDate: Date } | null = null;

    if (cycles.length >= 1) {
      const cycleDates = cycles
        .map(c => c.start_date)
        .sort((a, b) => b.getTime() - a.getTime());

      let averageCycleLength = 28;

      if (cycleDates.length >= 2) {
        const diffs: number[] = [];
        for (let i = 0; i < cycleDates.length - 1; i++) {
          const diff = (cycleDates[i].getTime() - cycleDates[i + 1].getTime()) / (1000 * 60 * 60 * 24);
          diffs.push(diff);
        }
        averageCycleLength = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
      } else if (cycles[0].cycle_length) {
        averageCycleLength = cycles[0].cycle_length!;
      }

      predictions = {
        nextCycleStart: new Date(cycleDates[0].getTime() + averageCycleLength * 24 * 60 * 60 * 1000),
        ovulationDate: cycles[0].ovulation_date || new Date(cycleDates[0].getTime() + 14 * 24 * 60 * 60),
      };
    }

    return { cycles, total, page, limit, predictions };
  }


  async getAnalytics(userId: string, timeRange: string = '3months') {
    const ranges = { '3months': 3, '6months': 6, '1year': 12 };
    const months = ranges[timeRange] || 3;
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    const cycles = await this.prisma.menstrualCycle.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        start_date: { gte: start },
      },
      orderBy: { start_date: 'asc' },
    });

    const cycleLengths = cycles.map((c) => c.cycle_length || 28);
    const periodLengths = cycles.map((c) => c.period_length);
    const averageCycleLength = cycleLengths.length
      ? cycleLengths.reduce((sum, len) => sum + len, 0) / cycleLengths.length
      : 28;
    const averagePeriodLength = periodLengths.length
      ? periodLengths.reduce((sum, len) => sum + len, 0) / periodLengths.length
      : 5;

    let irregularityWarning: string | undefined;
    const recentCycles = cycles.slice(-3);
    if (
      recentCycles.length === 3 &&
      recentCycles.every((c) => (c.cycle_length || 28) < 21 || (c.cycle_length || 28) > 35)
    ) {
      irregularityWarning = 'Chu kỳ của bạn bất thường (<21 hoặc >35 ngày) trong 3 tháng. Đề xuất tư vấn.';
      const user = await this.prisma.user.findUnique({ where: { user_id: userId } });
      if (user && user.email) {
        await this.emailService.sendEmail(
          user.email,
          'Cảnh báo chu kỳ bất thường',
          `Chu kỳ của bạn bất thường. Vui lòng đặt lịch tư vấn tại: ${process.env.FRONTEND_URL_PROD}/consultation`,
        );
      }
    }

    const chartData = cycles.map((c) => ({
      date: c.start_date,
      cycleLength: c.cycle_length || 28,
      symptoms: c.symptoms || '',
    }));

    return {
      averageCycleLength,
      averagePeriodLength,
      chartData,
      irregularityWarning,
    };
  }

  private async createNotifications(userId: string, nextCycleStart: Date, ovulationDate: Date) {
    const notifications = [
      {
        title: 'Chu kỳ sắp bắt đầu (48h)',
        content: 'Chu kỳ của bạn dự kiến bắt đầu sau 2 ngày.',
        sendAt: new Date(nextCycleStart.getTime() - 48 * 60 * 60 * 1000),
      },
      {
        title: 'Chu kỳ sắp bắt đầu (24h)',
        content: 'Chu kỳ của bạn dự kiến bắt đầu ngày mai.',
        sendAt: new Date(nextCycleStart.getTime() - 24 * 60 * 60 * 1000),
      },
      {
        title: 'Chu kỳ hôm nay',
        content: 'Hôm nay là ngày dự kiến bắt đầu chu kỳ, hãy ghi nhận.',
        sendAt: nextCycleStart,
      },
      {
        title: 'Ngày rụng trứng sắp đến',
        content: 'Ngày rụng trứng dự kiến sau 2 ngày.',
        sendAt: new Date(ovulationDate.getTime() - 48 * 60 * 60 * 1000),
      },
    ];

    for (const notif of notifications) {
      await this.prisma.notification.create({
        data: {
          user_id: userId,
          type: 'Email', 
          title: notif.title,
          content: notif.content,
          status: 'Sent',
          created_at: notif.sendAt,
        },
      });
    }
  }
}