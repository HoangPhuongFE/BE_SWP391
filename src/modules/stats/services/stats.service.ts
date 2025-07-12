import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StatsQueryDto } from '../dtos/stats-query.dto';
import { Prisma, AppointmentStatus, AppointmentType, Role, PaymentMethod, PaymentTransactionStatus } from '@prisma/client';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAppointmentStats(query: StatsQueryDto) {
    const { startDate, endDate, type, status } = query;
    const today = new Date();
    const where: Prisma.AppointmentWhereInput = {
      deleted_at: null,
      status: status ? { in: status.split(',').map(s => s as AppointmentStatus) } : undefined,
      type: type ? { in: type.split(',').map(t => t as AppointmentType) } : undefined,
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
    };

    const [total, appointments] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({ where, select: { status: true, type: true, created_at: true } }),
    ]);

    return {
      total,
      appointments: appointments.map(a => ({ status: a.status, type: a.type, created_at: a.created_at })),
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

    const [total, testResults] = await Promise.all([
      this.prisma.testResult.count({ where }),
      this.prisma.testResult.findMany({ where, select: { is_abnormal: true, service_id: true, created_at: true } }),
    ]);

    return {
      total,
      testResults: testResults.map(tr => ({ is_abnormal: tr.is_abnormal, service_id: tr.service_id, created_at: tr.created_at })),
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

    const [total, appointments] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({ where, select: { service_id: true, created_at: true } }),
    ]);

    return {
      total,
      appointments: appointments.map(a => ({ service_id: a.service_id, created_at: a.created_at })),
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
      start_date: start && end ? { gte: start, lte: end } : { lte: today },
    };

    const [total, cycles] = await Promise.all([
      this.prisma.menstrualCycle.count({ where }),
      this.prisma.menstrualCycle.findMany({ where, select: { cycle_length: true, period_length: true, symptoms: true, start_date: true } }),
    ]);

    // Xử lý trường hợp không có dữ liệu
    if (!cycles.length) {
      return {
        total: 0,
        averageCycleLength: 28,
        averagePeriodLength: 0,
        irregularCycles: 0,
        commonSymptoms: [],
        cycles: [],
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
      cycles: cycles.map(c => ({ start_date: c.start_date, cycle_length: c.cycle_length, period_length: c.period_length, symptoms: c.symptoms })),
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

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, select: { role: true, is_active: true, created_at: true } }),
    ]);

    return {
      total,
      users: users.map(u => ({ role: u.role, is_active: u.is_active, created_at: u.created_at })),
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

    const [total, questions] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({ where, select: { status: true, category: true, consultant_id: true, created_at: true } }),
    ]);

    return {
      total,
      questions: questions.map(q => ({ status: q.status, category: q.category, consultant_id: q.consultant_id, created_at: q.created_at })),
      message: 'Lấy thống kê câu hỏi thành công',
    };
  }

  async getRevenueStats(query: StatsQueryDto) {
    const { startDate, endDate, serviceId, paymentMethod } = query;
    const today = new Date();
    const where: Prisma.PaymentWhereInput = {
      deleted_at: null,
      status: paymentMethod ? { in: paymentMethod.split(',').map(pm => pm as PaymentTransactionStatus) } : { equals: PaymentTransactionStatus.Completed },
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
      appointment: serviceId ? { service_id: serviceId } : undefined,
      payment_method: paymentMethod ? { in: paymentMethod.split(',').map(pm => pm as PaymentMethod) } : undefined,
    };

    const [total, payments] = await Promise.all([
      this.prisma.payment.aggregate({ _sum: { amount: true }, where }).then(r => r._sum.amount || 0),
      this.prisma.payment.findMany({ where, select: { amount: true, created_at: true, appointment_id: true } }),
    ]);

    return {
      total,
      payments: payments.map(p => ({ amount: p.amount, created_at: p.created_at, appointment_id: p.appointment_id })),
      message: 'Lấy thống kê doanh thu thành công',
    };
  }

  async getCustomerServiceUsage(query: StatsQueryDto) {
    const { startDate, endDate, serviceId, category } = query;
    const today = new Date();
    const where: Prisma.AppointmentWhereInput = {
      deleted_at: null,
      status: { not: 'Cancelled' },
      created_at: startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : { lte: today },
      service_id: serviceId ? serviceId : undefined,
      service: category ? { category: { equals: category } } : undefined,
    };

    const [total, appointments] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({ where, select: { user_id: true, service_id: true, created_at: true } }),
    ]);

    return {
      total,
      appointments: appointments.map(a => ({ user_id: a.user_id, service_id: a.service_id, created_at: a.created_at })),
      message: 'Lấy thống kê khách hàng sử dụng dịch vụ thành công',
    };
  }
}