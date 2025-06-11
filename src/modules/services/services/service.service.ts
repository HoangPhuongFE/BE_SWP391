// src/modules/services/services/service.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceDto } from '../dtos/create-service.dto';
import { UpdateServiceDto } from '../dtos/update-service.dto';
import { EmailService } from '../../email/email.service';

@Injectable()
export class ServiceService {
  private readonly logger = new Logger(ServiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createService(dto: CreateServiceDto) {
    const { name, category } = dto;
    const existing = await this.prisma.service.findFirst({
      where: { category, name, deleted_at: null },
    });
    if (existing) {
      throw new BadRequestException('Danh mục và tên dịch vụ đã tồn tại');
    }

    return this.prisma.service.create({ data: dto });
  }

  async updateService(serviceId: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({
      where: { service_id: serviceId, deleted_at: null },
    });
    if (!service) {
      throw new BadRequestException('Dịch vụ không tồn tại');
    }

    if (dto.price !== undefined && dto.price < 0) {
      throw new BadRequestException('Giá phải là số dương');
    }

    const updatedService = await this.prisma.service.update({
      where: { service_id: serviceId },
      data: dto,
    });

    // Gửi thông báo nếu giá thay đổi
    if (
      dto.price !== undefined &&
      Number(dto.price) !== Number(service.price)
    ) {
      const users = await this.prisma.user.findMany({ where: { is_active: true } });
      const emails = users.map((user) => user.email).join(',');
      await this.emailService.sendEmail(
        emails,
        'Cập nhật bảng giá dịch vụ',
        `Giá dịch vụ ${service.name} đã thay đổi thành ${dto.price} VND. Kiểm tra tại: http://your-frontend.com/services`,
      );
    }

    return { service: updatedService, message: 'Cập nhật dịch vụ thành công' };
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
}