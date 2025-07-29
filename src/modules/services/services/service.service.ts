import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceDto, ServiceMode } from '../dtos/create-service.dto';
import { UpdateServiceDto } from '../dtos/update-service.dto';
import { ServiceType } from '@prisma/client';

@Injectable()
export class ServiceService {
  private readonly logger = new Logger(ServiceService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async createService(dto: CreateServiceDto) {
    const {
      name,
      category,
      is_active = true,
      type,
      price,
      description,
      return_address,
      return_phone,
      available_modes,
      daily_capacity,
    } = dto;

    // Thu thập lỗi
    const errors: { field: string; message: string }[] = [];

    // Kiểm tra dịch vụ đã tồn tại
    const existing = await this.prisma.service.findFirst({
      where: { category, name, deleted_at: null },
    });
    if (existing) {
      errors.push({ field: 'name', message: `Dịch vụ với danh mục '${category}' và tên '${name}' đã tồn tại` });
    }

    // Kiểm tra return_address và return_phone
    if (type === ServiceType.Testing || (available_modes ?? []).includes('AT_HOME' as ServiceMode)) {
      if (!return_address) {
        errors.push({ field: 'return_address', message: 'Địa chỉ nhận mẫu là bắt buộc' });
      }
      if (!return_phone) {
        errors.push({ field: 'return_phone', message: 'Số điện thoại nhận mẫu là bắt buộc' });
      }
    }

    // Trả về lỗi nếu có
    if (errors.length > 0) {
      return {
        statusCode: 400,
        message: 'Dữ liệu không hợp lệ',
        errors,
      };
    }

    // Gán giá trị mặc định
    const defaultTestingHours =
      type === ServiceType.Testing
        ? { morning: { start: '07:00', end: '11:00' }, afternoon: { start: '13:00', end: '17:00' } }
        : { all_day: { start: '08:00', end: '17:00' } };

    const finalDailyCapacity = daily_capacity ?? 10;
    const finalReturnAddress = return_address ?? 'Không áp dụng';
    const finalReturnPhone = return_phone ?? 'Không áp dụng';

    // Tạo dịch vụ
    return this.prisma.service.create({
      data: {
        name,
        category,
        price,
        description,
        is_active,
        type,
        available_modes: available_modes ?? ['AT_CLINIC'],
        testing_hours: defaultTestingHours,
        daily_capacity: finalDailyCapacity,
        return_address: finalReturnAddress,
        return_phone: finalReturnPhone,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }



  async updateService(serviceId: string, dto: UpdateServiceDto) {
    const errors: { field: string; message: string }[] = [];

    // Kiểm tra dịch vụ tồn tại
    const service = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null },
    });

    if (!service) {
      errors.push({ field: 'serviceId', message: 'Dịch vụ không tồn tại' });
      return {
        statusCode: 400,
        message: 'Dữ liệu không hợp lệ',
        errors,
      };
    }

    // Kiểm tra giá
    if (dto.price !== undefined && dto.price < 0) {
      errors.push({ field: 'price', message: 'Giá phải là số dương' });
    }

    // Kiểm tra trùng tên và danh mục
    if (dto.name || dto.category) {
      const existing = await this.prisma.service.findFirst({
        where: {
          category: dto.category ?? service.category,
          name: dto.name ?? service.name,
          deleted_at: null,
          NOT: { service_id: serviceId },
        },
      });
      if (existing) {
        errors.push({
          field: 'name',
          message: `Dịch vụ với danh mục '${dto.category ?? service.category}' và tên '${dto.name ?? service.name}' đã tồn tại`,
        });
      }
    }

    // Kiểm tra category cho Consultation
    const updateType = dto.type ?? service.type;
    if (updateType === ServiceType.Consultation && dto.category) {
      const relatedTest = await this.prisma.service.findFirst({
        where: { category: dto.category, type: ServiceType.Testing, deleted_at: null },
      });
      if (!relatedTest) {
        this.logger.warn(`Không tìm thấy dịch vụ xét nghiệm cho category: ${dto.category}`);
      }
    }

    // Kiểm tra return_address và return_phone
    const updatedModes = dto.available_modes ?? (service.available_modes as string[] ?? []);
    const mergedAddress = dto.return_address ?? service.return_address ?? 'Không áp dụng';
    const mergedPhone = dto.return_phone ?? service.return_phone ?? 'Không áp dụng';
    if (updateType === ServiceType.Testing || updatedModes.includes('AT_HOME' as ServiceMode)) {
      if (!mergedAddress || mergedAddress === 'Không áp dụng') {
        errors.push({ field: 'return_address', message: 'Địa chỉ nhận mẫu là bắt buộc' });
      }
      if (!mergedPhone || mergedPhone === 'Không áp dụng') {
        errors.push({ field: 'return_phone', message: 'Số điện thoại nhận mẫu là bắt buộc' });
      }
    }

    // Trả về lỗi nếu có
    if (errors.length > 0) {
      return {
        statusCode: 400,
        message: 'Dữ liệu không hợp lệ',
        errors,
      };
    }

    // Gán giá trị mặc định cho testing_hours và daily_capacity
    const defaultTestingHours =
      updateType === ServiceType.Testing
        ? service.testing_hours ?? { morning: { start: '07:00', end: '11:00' }, afternoon: { start: '13:00', end: '17:00' } }
        : { all_day: { start: '08:00', end: '17:00' } };
    const defaultDailyCapacity = updateType === ServiceType.Testing ? service.daily_capacity ?? 20 : 10;

    // Cập nhật dịch vụ
    return this.prisma.service.update({
      where: { service_id: serviceId },
      data: {
        name: dto.name ?? service.name,
        category: dto.category ?? service.category,
        price: dto.price ?? service.price,
        description: dto.description ?? service.description,
        is_active: dto.is_active ?? service.is_active,
        type: updateType,
        available_modes: updatedModes,
        testing_hours: defaultTestingHours,
        daily_capacity: defaultDailyCapacity,
        return_address: mergedAddress,
        return_phone: mergedPhone,
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

  const services = await this.prisma.service.findMany({
    where,
    include: {
      schedules: {
        where: { deleted_at: null },
        select: {
          consultant_id: true,
          consultant: {
            select: {
              user: { select: { full_name: true, email: true } },
            },
          },
        },
      },
    },
  });

  return services.map(service => ({
    service_id: service.service_id,
    name: service.name,
    description: service.description,
    price: service.price,
    category: service.category,
    is_active: service.is_active,
    type: service.type,
    testing_hours: service.testing_hours,
    daily_capacity: service.daily_capacity,
    return_address: service.return_address,
    return_phone: service.return_phone,
    available_modes: service.available_modes,
    consultants: service.schedules.map(schedule => ({
      consultant_id: schedule.consultant_id,
      full_name: schedule.consultant?.user?.full_name,
      email: schedule.consultant?.user?.email,
    })),
  }));
}

  async getServiceById(serviceId: string, date?: string) {
    const service = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null },
    });
    if (!service) {
      throw new BadRequestException('Dịch vụ không tồn tại');
    }

    if (service.type !== ServiceType.Consultation) {
      return {
        service: {
          service_id: service.service_id,
          name: service.name,
          category: service.category,
          price: service.price,
          description: service.description,
          is_active: service.is_active,
          type: service.type,
          available_modes: service.available_modes,
          testing_hours: service.testing_hours,
          daily_capacity: service.daily_capacity,
          return_address: service.return_address,
          return_phone: service.return_phone,
          created_at: service.created_at,
          updated_at: service.updated_at,
        },
      };
    }

    const where = date
      ? {
        start_time: {
          gte: new Date(`${date}T00:00:00Z`),
          lte: new Date(`${date}T23:59:59Z`),
        },
      }
      : {};

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
      select: {
        consultant_id: true,
        specialization: true,
        average_rating: true,
        user: { select: { full_name: true } },
        schedules: {
          where: {
            service_id: serviceId,
            is_booked: false,
            deleted_at: null,
            ...where,
          },
          select: {
            schedule_id: true,
            start_time: true,
            end_time: true,
          },
        },
      },
    });

    return {
      service: {
        service_id: service.service_id,
        name: service.name,
        category: service.category,
        price: service.price,
        description: service.description,
        is_active: service.is_active,
        type: service.type,
        available_modes: service.available_modes,
        testing_hours: service.testing_hours,
        daily_capacity: service.daily_capacity,
        return_address: service.return_address,
        return_phone: service.return_phone,
        created_at: service.created_at,
        updated_at: service.updated_at,
      },
      consultants: consultants.map((c) => ({
        consultant_id: c.consultant_id,
        full_name: c.user?.full_name || 'Unknown',
        specialization: c.specialization,
        average_rating: c.average_rating,
        schedules: c.schedules.map((s) => ({
          schedule_id: s.schedule_id,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      })),
    };
  }

}
