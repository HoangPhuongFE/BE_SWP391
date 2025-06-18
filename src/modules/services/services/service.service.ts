import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceDto } from '../dtos/create-service.dto';
import { UpdateServiceDto } from '../dtos/update-service.dto';
import { ServiceType } from '@prisma/client';

@Injectable()
export class ServiceService {
  private readonly logger = new Logger(ServiceService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createService(dto: CreateServiceDto) {
  const {
    name,
    category,
    is_active = true,
    type,
    price,
    description,
    is_home_test,
    is_flexible_location,
    return_address,
    return_phone,
  } = dto;

  const existing = await this.prisma.service.findFirst({
    where: { category, name, deleted_at: null },
  });
  if (existing) {
    throw new BadRequestException('Danh mục và tên dịch vụ đã tồn tại');
  }

  if (is_home_test || !is_flexible_location) {
    if (!return_address || !return_phone) {
      throw new BadRequestException('Dịch vụ yêu cầu địa chỉ và số điện thoại liên hệ');
    }
  }

  const defaultTestingHours = type === ServiceType.Testing ? {
    morning: { start: '07:00', end: '11:00' },
    afternoon: { start: '13:00', end: '17:00' },
  } : undefined;

  const defaultDailyCapacity = type === ServiceType.Testing ? 20 : undefined;

  return this.prisma.service.create({
    data: {
      name,
      category,
      price,
      description,
      is_active,
      type,
      testing_hours: defaultTestingHours,
      daily_capacity: defaultDailyCapacity,
      is_home_test: is_home_test ?? false,
      is_flexible_location: is_flexible_location ?? false,
      return_address: return_address ?? null,
      return_phone: return_phone ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}


  async updateService(serviceId: string, dto: UpdateServiceDto) {
  const service = await this.prisma.service.findUnique({
    where: { service_id: serviceId, deleted_at: null },
  });
  if (!service) throw new BadRequestException('Dịch vụ không tồn tại');

  if (dto.price !== undefined && dto.price < 0) {
    throw new BadRequestException('Giá phải là số dương');
  }

  if (dto.name || dto.category) {
    const existing = await this.prisma.service.findFirst({
      where: {
        category: dto.category ?? service.category,
        name: dto.name ?? service.name,
        deleted_at: null,
        NOT: { service_id: serviceId },
      },
    });
    if (existing) throw new BadRequestException('Danh mục và tên dịch vụ đã tồn tại');
  }

  const updateType = dto.type ?? service.type;
  if (updateType === ServiceType.Consultation && dto.category) {
    const relatedTest = await this.prisma.service.findFirst({
      where: { category: dto.category, type: ServiceType.Testing, deleted_at: null },
    });
    if (!relatedTest) {
      this.logger.warn(`Không tìm thấy dịch vụ xét nghiệm cho category: ${dto.category}`);
    }
  }

  const willBeHomeTest = dto.is_home_test ?? service.is_home_test;
  const willBeFlexible = dto.is_flexible_location ?? service.is_flexible_location;

  if ((willBeHomeTest || !willBeFlexible) && (!dto.return_address && !service.return_address || !dto.return_phone && !service.return_phone)) {
    throw new BadRequestException('Thiếu thông tin nhận mẫu');
  }

  return this.prisma.service.update({
    where: { service_id: serviceId },
    data: {
      ...dto,
      testing_hours: updateType === ServiceType.Testing ? service.testing_hours : this.prisma.$type.JsonNull,
      daily_capacity: updateType === ServiceType.Testing ? service.daily_capacity : undefined,
      is_home_test: willBeHomeTest,
      is_flexible_location: willBeFlexible,
      return_address: dto.return_address ?? service.return_address,
      return_phone: dto.return_phone ?? service.return_phone,
      updated_at: new Date(),
    },
  });
}


  async deleteService(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null },
    });
    if (!service) {
      throw new BadRequestException('Dịch vụ không tồn tại');
    }

    return this.prisma.service.update({
      where: { service_id: serviceId },
      data: { deleted_at: new Date() },
    });
  }

  async getServices(category?: string, isActive?: boolean) {
    const where: any = { deleted_at: null };
    if (category) where.category = category;
    if (isActive !== undefined) where.is_active = isActive;

    return this.prisma.service.findMany({ where });
  }

  async getServiceById(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null },
    });
    if (!service) {
      throw new BadRequestException('Dịch vụ không tồn tại');
    }
    return { service };
  }

  async getConsultantsWithSchedules(serviceId: string, date?: string) {
    const service = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null },
    });
    if (!service || service.type !== ServiceType.Consultation) {
      throw new BadRequestException('Dịch vụ không tồn tại hoặc không phải tư vấn');
    }

    const where = date ? { start_time: { gte: new Date(date), lte: new Date(date + 'T23:59:59Z') } } : {};

    const schedules = await this.prisma.schedule.findMany({
      where: {
        service_id: serviceId,
        is_booked: false,
        deleted_at: null,
        ...where,
      },
      select: { consultant_id: true },
      distinct: ['consultant_id'],
    });

    const consultantIds = schedules.map(s => s.consultant_id);

    const consultants = await this.prisma.consultantProfile.findMany({
      where: {
        consultant_id: { in: consultantIds },
        is_verified: true,
        deleted_at: null,
      },
      include: {
        user: true,
        schedules: {
          where: {
            service_id: serviceId,
            is_booked: false,
            deleted_at: null,
            ...where,
          },
        },
      },
    });

    return {
      service: {
        service_id: service.service_id,
        name: service.name,
      },
      consultants: consultants.map((c) => ({
        consultant_id: c.consultant_id,
        full_name: c.user?.full_name || 'Unknown',
        schedules: c.schedules.map((s) => ({
          schedule_id: s.schedule_id,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      })),
    };
  }
}
