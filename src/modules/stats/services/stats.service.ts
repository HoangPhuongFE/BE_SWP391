import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StatsQueryDto } from '../dtos/stats-query.dto';
import { Prisma, AppointmentStatus, AppointmentType, Role, PaymentMethod, PaymentTransactionStatus } from '@prisma/client';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) { }

  async getAppointmentStats(query: StatsQueryDto) {
    const { startDate, endDate, type, status, groupBy } = query;
    const today = new Date();
    const where: Prisma.AppointmentWhereInput = {
      deleted_at: null,
      status: status ? { in: status.split(',').map(s => s as AppointmentStatus) } : undefined,
      type: type ? { in: type.split(',').map(t => t as AppointmentType) } : undefined,
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
    };

    const [total, byStatus, byType, byDate] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.groupBy({ by: ['status'], _count: { _all: true }, where }),
      this.prisma.appointment.groupBy({ by: ['type'], _count: { _all: true }, where }),
      groupBy ? this.prisma.$queryRaw(
        Prisma.sql`SELECT DATE_FORMAT(created_at, ${groupBy === 'year' ? '%Y' : groupBy === 'quarter' ? '%Y-%m' : groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d'}) as period, COUNT(*) as count
          FROM Appointment
          WHERE deleted_at IS NULL
          ${status ? Prisma.sql`AND status IN (${Prisma.join(status.split(',').map(s => Prisma.sql`'${s}'`))})` : Prisma.empty}
          ${type ? Prisma.sql`AND type IN (${Prisma.join(type.split(',').map(t => Prisma.sql`'${t}'`))})` : Prisma.empty}
          ${startDate && endDate ? Prisma.sql`AND created_at >= ${new Date(startDate)} AND created_at <= ${new Date(endDate)}` : Prisma.sql`AND created_at <= ${today}`}
          GROUP BY period`
      ) : Promise.resolve([]),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count._all])),
      byType: Object.fromEntries(byType.map(t => [t.type, t._count._all])),
      byDate: (byDate as any[]).map(d => ({ period: d.period as string, count: Number(d.count) })),
      message: 'Lấy thống kê lịch hẹn thành công',
    };
  }

  async getTestResultStats(query: StatsQueryDto) {
    const { startDate, endDate, category } = query;
    const today = new Date();
    const where: Prisma.TestResultWhereInput = {
      deleted_at: null,
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
      service: category ? { category: { equals: category } } : undefined,
    };

    const [total, byStatus, byCategory] = await Promise.all([
      this.prisma.testResult.count({ where }),
      this.prisma.testResult.groupBy({
        by: ['is_abnormal'],
        _count: { _all: true },
        where,
      }),
      this.prisma.testResult.groupBy({
        by: ['service_id'],
        _count: { _all: true },
        where,
      }).then(results => Promise.all(results.map(async r => ({
        serviceId: r.service_id,
        category: (await this.prisma.service.findUnique({ where: { service_id: r.service_id } }))?.category ?? undefined,
        count: r._count._all,
      })))),
    ]);

    return {
      total,
      byStatus: { Normal: byStatus.find(s => !s.is_abnormal)?._count._all || 0, Abnormal: byStatus.find(s => s.is_abnormal)?._count._all || 0 },
      byCategory: Object.fromEntries(byCategory.map(c => [c.category ?? 'Unknown', c.count])),
      message: 'Lấy thống kê kết quả xét nghiệm thành công',
    };
  }

  async getServiceStats(query: StatsQueryDto) {
    const { startDate, endDate, category, serviceId } = query;
    const today = new Date();
    const where: Prisma.AppointmentWhereInput = {
      deleted_at: null,
      status: { not: 'Cancelled' },
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
      service_id: serviceId ? serviceId : undefined,
      service: category ? { category: { equals: category } } : undefined,
    };

    const [total, byCategory, byService] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.groupBy({
        by: ['service_id'],
        _count: { _all: true },
        where,
      }).then(results => Promise.all(results.map(async r => ({
        serviceId: r.service_id,
        category: (await this.prisma.service.findUnique({ where: { service_id: r.service_id ?? undefined } }))?.category || undefined,
        count: r._count._all,
      })))),
      this.prisma.appointment.groupBy({
        by: ['service_id'],
        _count: { _all: true },
        where,
      }).then(results => Promise.all(results.map(async r => ({
        serviceId: r.service_id,
        name: (await this.prisma.service.findUnique({ where: { service_id: r.service_id ?? undefined } }))?.name ?? undefined,
        count: r._count._all,
      })))),
    ]);

    return {
      total,
      byCategory: Object.fromEntries(byCategory.map(c => [c.category ?? 'Unknown', c.count])),
      byService: byService.map(s => ({ serviceId: s.serviceId, name: s.name ?? 'Unknown', count: s.count })),
      message: 'Lấy thống kê dịch vụ thành công',
    };
  }


  async getCycleStats(query: StatsQueryDto) {
  const { startDate, endDate } = query;
  const today = new Date();

  // Parse và validate date
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (startDate && start && isNaN(start.getTime())) throw new BadRequestException('Ngày bắt đầu không hợp lệ');
  if (endDate && end && isNaN(end.getTime())) throw new BadRequestException('Ngày kết thúc không hợp lệ');

  const where: Prisma.MenstrualCycleWhereInput = {
    deleted_at: null,
    start_date: start && end
      ? { gte: start, lte: end }
      : { lte: today },
  };

  const [total, cycles] = await Promise.all([
    this.prisma.menstrualCycle.count({ where }),
    this.prisma.menstrualCycle.findMany({ where, select: { cycle_length: true, period_length: true, symptoms: true } }),
  ]);

  // Xử lý trường hợp không có dữ liệu
  if (!cycles.length) {
    return {
      total: 0,
      averageCycleLength: 28, // Giá trị mặc định
      averagePeriodLength: 0,
      irregularCycles: 0,
      commonSymptoms: [],
      message: 'Không có dữ liệu chu kỳ trong khoảng thời gian này',
    };
  }

  const averageCycleLength = cycles.reduce((sum, c) => sum + (c.cycle_length || 28), 0) / cycles.length;
  const averagePeriodLength = cycles.reduce((sum, c) => sum + (c.period_length || 0), 0) / cycles.length;
  const irregularCycles = cycles.filter(c => (c.cycle_length || 28) < 21 || (c.cycle_length || 28) > 35).length;
  const commonSymptoms = cycles
    .flatMap(c => c.symptoms || [])
    .reduce((acc, sym) => ({ ...acc, [sym]: (acc[sym] || 0) + 1 }), {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([sym]) => sym);

  return {
    total,
    averageCycleLength,
    averagePeriodLength,
    irregularCycles,
    commonSymptoms,
    message: 'Lấy thống kê chu kỳ thành công',
  };
}

  async getUserStats(query: StatsQueryDto) {
    const { startDate, endDate, role, isActive } = query;
    const today = new Date();
    const where: Prisma.UserWhereInput = {
      deleted_at: null,
      role: role ? { in: role.split(',').map(r => r as Role) } : undefined,
      is_active: isActive ? isActive === 'true' : undefined,
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
    };

    const [total, byRole, byStatus, byDate] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true }, where }),
      this.prisma.user.groupBy({ by: ['is_active'], _count: { _all: true }, where }),
      this.prisma.$queryRaw(
        Prisma.sql`SELECT DATE_FORMAT(created_at, ?) as date, COUNT(*) as count
          FROM User
          WHERE deleted_at IS NULL
          ${role ? Prisma.sql`AND role IN (${Prisma.join(role.split(',').map(r => Prisma.sql`'${r}'`))})` : Prisma.empty}
          ${isActive ? Prisma.sql`AND is_active = ${isActive === 'true'}` : Prisma.empty}
          ${startDate && endDate ? Prisma.sql`AND created_at >= ${new Date(startDate)} AND created_at <= ${new Date(endDate)}` : Prisma.sql`AND created_at <= ${today}`}
          GROUP BY date`,
        '%Y-%m-%d'
      ),
    ]);

    return {
      total,
      byRole: Object.fromEntries(byRole.map(r => [r.role, r._count._all])),
      byStatus: Object.fromEntries(byStatus.map(s => [s.is_active, s._count._all])),
      byDate: (byDate as any[]).map(d => ({ date: d.date as string, count: Number(d.count) })),
      message: 'Lấy thống kê người dùng thành công',
    };
  }

  async getQuestionStats(query: StatsQueryDto) {
    const { startDate, endDate, category, consultantId } = query;
    const today = new Date();
    const where: Prisma.QuestionWhereInput = {
      deleted_at: null,
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
      category: category ? { equals: category } : undefined,
      consultant_id: consultantId ? consultantId : undefined,
    };

    const [total, byStatus, byCategory, byConsultant] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.groupBy({ by: ['status'], _count: { _all: true }, where }),
      this.prisma.question.groupBy({ by: ['category'], _count: { _all: true }, where }),
      this.prisma.question.groupBy({ by: ['consultant_id'], _count: { _all: true }, where }).then(results => Promise.all(results.map(async r => ({
        consultantId: r.consultant_id,
        count: r._count._all,
      })))),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count._all])),
      byCategory: Object.fromEntries(byCategory.map(c => [c.category ?? 'Unknown', c._count._all])),
      byConsultant: byConsultant.map(c => ({ consultantId: c.consultantId, count: c.count })),
      message: 'Lấy thống kê câu hỏi thành công',
    };
  }

  async getRevenueStats(query: StatsQueryDto) {
  const { startDate, endDate, serviceId, paymentMethod, groupBy } = query;
  const today = new Date();
  const where: Prisma.PaymentWhereInput = {
    deleted_at: null,
    status: paymentMethod ? { in: paymentMethod.split(',').map(pm => pm as PaymentTransactionStatus) } : { equals: PaymentTransactionStatus.Completed },
    created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
    appointment: serviceId ? { service_id: serviceId } : undefined,
    payment_method: paymentMethod ? { in: paymentMethod.split(',').map(pm => pm as PaymentMethod) } : undefined,
  };

  try {
    const [total, byService, byPeriod, byPaymentMethod] = await Promise.all([
      this.prisma.payment.aggregate({ _sum: { amount: true }, where }).then(r => r._sum.amount || 0),
      this.prisma.payment.groupBy({
        by: ['appointment_id'],
        _sum: {
          amount: true,
        },
        where,
      }).then(results => Promise.all(results.map(async r => {
        const appointment = await this.prisma.appointment.findUnique({ where: { appointment_id: r.appointment_id } });
        const service = appointment?.service_id ? await this.prisma.service.findUnique({ where: { service_id: appointment.service_id } }) : null;
        return {
          serviceId: appointment?.service_id ?? undefined,
          name: service?.name ?? 'Unknown',
          revenue: r._sum.amount,
        };
      }))),
      groupBy ? this.prisma.$queryRaw(
        Prisma.sql`SELECT DATE_FORMAT(created_at, ${groupBy === 'year' ? '%Y' : groupBy === 'quarter' ? '%Y-%m' : groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d'}) as period, SUM(amount) as revenue
          FROM Payment
          WHERE deleted_at IS NULL AND status = ${PaymentTransactionStatus.Completed}
          ${serviceId ? Prisma.sql`AND appointment_id IN (SELECT appointment_id FROM Appointment WHERE service_id = ${serviceId})` : Prisma.empty}
          ${paymentMethod ? Prisma.sql`AND payment_method IN (${Prisma.join(paymentMethod.split(',').map(m => Prisma.sql`'${m}'`))})` : Prisma.empty}
          ${startDate && endDate ? Prisma.sql`AND created_at >= ${new Date(startDate)} AND created_at <= ${new Date(endDate)}` : Prisma.sql`AND created_at <= ${today}`}
          GROUP BY period`
      ) : Promise.resolve([]),
      this.prisma.payment.groupBy({
        by: ['payment_method'],
        _sum: {
          amount: true,
        },
        where,
      }),
    ]);

    return {
      total,
      byService: byService.filter(s => s.serviceId).map(s => ({ serviceId: s.serviceId, name: s.name, revenue: s.revenue })),
      byPeriod: (byPeriod as any[]).map(p => ({ period: p.period as string, revenue: Number(p.revenue) })),
      byPaymentMethod: Object.fromEntries(byPaymentMethod.map(m => [m.payment_method, m._sum.amount])),
      message: 'Lấy thống kê doanh thu thành công',
    };
  } catch (error) {
    console.error('Error in getRevenueStats:', error);
    throw new BadRequestException('Lỗi khi lấy thống kê doanh thu: ' + error.message);
  }
}

  async getCustomerServiceUsage(query: StatsQueryDto) {
    const { startDate, endDate, serviceId, category, groupBy } = query;
    const today = new Date();
    const where: Prisma.AppointmentWhereInput = {
      deleted_at: null,
      status: { not: 'Cancelled' },
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
      service_id: serviceId ? serviceId : undefined,
      service: category ? { category: { equals: category } } : undefined,
    };

    const [total, byService, byCategory, byPeriod] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.groupBy({
        by: ['service_id'],
        _count: { user_id: true },
        where,
      }).then(results => Promise.all(results.map(async r => ({
        serviceId: r.service_id,
        name: (await this.prisma.service.findUnique({ where: { service_id: r.service_id ?? undefined } }))?.name ?? undefined,
        customerCount: r._count.user_id,
      })))),
      this.prisma.appointment.groupBy({
        by: ['service_id'],
        _count: { user_id: true },
        where,
      }).then(results => Promise.all(results.map(async r => ({
        category: (await this.prisma.service.findUnique({ where: { service_id: r.service_id ?? undefined } }))?.category ?? undefined,
        customerCount: r._count.user_id,
      })))),
      groupBy ? this.prisma.$queryRaw(
        Prisma.sql`SELECT DATE_FORMAT(created_at, ?) as period, COUNT(DISTINCT user_id) as customerCount
          FROM Appointment
          WHERE deleted_at IS NULL AND status != 'Cancelled'
          ${serviceId ? Prisma.sql`AND service_id = ${serviceId}` : Prisma.empty}
          ${category ? Prisma.sql`AND service_id IN (SELECT service_id FROM Service WHERE category = ${category})` : Prisma.empty}
          ${startDate && endDate ? Prisma.sql`AND created_at >= ${new Date(startDate)} AND created_at <= ${new Date(endDate)}` : Prisma.sql`AND created_at <= ${today}`}
          GROUP BY period`,
        groupBy === 'year' ? '%Y' : groupBy === 'quarter' ? '%Y-%m' : groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d'
      ) : Promise.resolve([]),
    ]);

    return {
      total,
      byService: byService.map(s => ({ serviceId: s.serviceId, name: s.name ?? 'Unknown', customerCount: s.customerCount })),
      byCategory: Object.fromEntries(byCategory.map(c => [c.category ?? 'Unknown', c.customerCount])),
      byPeriod: (byPeriod as any[]).map(p => ({ period: p.period as string, customerCount: Number(p.customerCount) })),
      message: 'Lấy thống kê khách hàng sử dụng dịch vụ thành công',
    };
  }
}