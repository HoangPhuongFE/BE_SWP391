import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GhtkService } from '../../ghtk/services/ghtk.service';
import { CreateShippingInfoDto } from '../dtos/create-shipping-info.dto';
import { UpdateShippingStatusDto } from '../dtos/update-shipping-status.dto';

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ghtkService: GhtkService,
  ) {}

  async createShippingInfo(appointmentId: string, dto: CreateShippingInfoDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });

    if (!appointment) throw new BadRequestException('Appointment not found');

    return this.prisma.shippingInfo.create({
      data: { appointment_id: appointmentId, ...dto, shipping_status: 'Pending' },
    });
  }

  async createShippingOrder(appointmentId: string) {
    const shippingInfo = await this.prisma.shippingInfo.findUnique({
      where: { appointment_id: appointmentId },
    });

    if (!shippingInfo) throw new BadRequestException('No shipping info found');

    const payload = {
      order: {
        id: appointmentId,
        pick_name: 'Phòng Lab A',
        pick_address: '123 Nguyễn Văn A, Q1, HCM',
        pick_province: 'TP.HCM',
        pick_district: 'Quận 1',
        pick_tel: '0909123456',
        name: shippingInfo.contact_name,
        address: shippingInfo.shipping_address,
        province: shippingInfo.province,
        district: shippingInfo.district,
        tel: shippingInfo.contact_phone,
        note: '',
        value: 500000,
        pick_money: 0,
        is_freeship: true,
      },
    };

    const response = await this.ghtkService.createOrder(payload);

    await this.prisma.shippingInfo.update({
      where: { appointment_id: appointmentId },
      data: {
        provider_order_code: response.order.label,
        shipping_status: 'Shipped',
      },
    });

    return { label: response.order.label };
  }

  async updateShippingStatus(appointmentId: string, dto: UpdateShippingStatusDto) {
    const shippingInfo = await this.prisma.shippingInfo.findUnique({
      where: { appointment_id: appointmentId },
    });

    if (!shippingInfo) throw new BadRequestException('No shipping info found');

    return this.prisma.shippingInfo.update({
      where: { appointment_id: appointmentId },
      data: { shipping_status: dto.shipping_status },
    });
  }

  async customerReturnSample(appointmentId: string) {
    const shippingInfo = await this.prisma.shippingInfo.findUnique({
      where: { appointment_id: appointmentId },
    });

    if (!shippingInfo) throw new BadRequestException('No shipping info found');

    return this.prisma.shippingInfo.update({
      where: { appointment_id: appointmentId },
      data: { shipping_status: 'PickupRequested' },
    });
  }
}
