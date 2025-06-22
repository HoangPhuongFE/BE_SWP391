import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GhtkService } from '../../ghtk/services/ghtk.service';
import { CreateShippingInfoDto } from '../dtos/create-shipping-info.dto';
import { UpdateShippingStatusDto } from '../dtos/update-shipping-status.dto';
import { ShippingStatus } from '@prisma/client';
import { ServiceMode } from '@modules/services/dtos/create-service.dto';

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ghtkService: GhtkService,
  ) { }

  private validateShippingStatusTransition(current: ShippingStatus, next: ShippingStatus): boolean {
    const validTransitions: Record<ShippingStatus, ShippingStatus[]> = {
      Pending: ['Shipped'],
      Shipped: ['DeliveredToCustomer'],
      DeliveredToCustomer: [],
      PickupRequested: ['SampleInTransit'],
      SampleInTransit: ['ReturnedToLab'],
      ReturnedToLab: [],
      Failed: [],
    };
    return validTransitions[current]?.includes(next) ?? false;
  }

  async createShippingInfo(appointmentId: string, dto: CreateShippingInfoDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });

    if (!appointment) throw new BadRequestException('Lịch hẹn không tồn tại');
    if (appointment.mode !== ServiceMode.AT_HOME) {
      throw new BadRequestException('Chỉ áp dụng cho dịch vụ tại nhà');
    }

    return this.prisma.shippingInfo.create({
      data: { appointment_id: appointmentId, ...dto, shipping_status: 'Pending' },
    });
  }

  async createShippingOrder(appointmentId: string) {
    const shippingInfo = await this.prisma.shippingInfo.findUnique({
      where: { appointment_id: appointmentId },
      include: { appointment: true },
    });

    if (!shippingInfo) throw new BadRequestException('Không tìm thấy thông tin vận chuyển');
    if (shippingInfo.appointment.mode !== ServiceMode.AT_HOME) {
      throw new BadRequestException('Chỉ áp dụng cho dịch vụ tại nhà');
    }
    if (shippingInfo.shipping_status !== 'Pending') {
      throw new BadRequestException('Trạng thái không hợp lệ để tạo vận đơn');
    }

    //  Fake đơn vận chuyển giống chiều về
    const providerOrderCode = `[MOCK-GHTK]_${appointmentId}-forward`;

    const existing = await this.prisma.shippingInfo.findFirst({
      where: { provider_order_code: providerOrderCode, appointment_id: { not: appointmentId } },
    });
    if (existing) throw new BadRequestException('Mã vận đơn đã tồn tại');

    await this.prisma.$transaction([
      this.prisma.shippingInfo.update({
        where: { appointment_id: appointmentId },
        data: {
          provider_order_code: providerOrderCode,
          shipping_status: 'Shipped',
        },
      }),
      this.prisma.notification.create({
        data: {
          user_id: shippingInfo.appointment.user_id,
          type: 'Email',
          title: 'Gửi bộ xét nghiệm',
          content: `Bộ xét nghiệm đã được gửi. Mã đơn: ${providerOrderCode}`,
          status: 'Pending',
        },
      }),
    ]);

    return { label: providerOrderCode };
  }


  async updateShippingStatusById(shippingInfoId: string, dto: UpdateShippingStatusDto) {
    const info = await this.prisma.shippingInfo.findUnique({
      where: { id: shippingInfoId },
      include: { appointment: true },
    });
    if (!info) throw new BadRequestException('Không tìm thấy đơn hàng');
    if (!this.validateShippingStatusTransition(info.shipping_status, dto.shipping_status)) {
      throw new BadRequestException('Chuyển trạng thái không hợp lệ');
    }

    return this.prisma.shippingInfo.update({
      where: { id: shippingInfoId },
      data: { shipping_status: dto.shipping_status, updated_at: new Date() },
    });
  }

  async updateReturnShippingStatusById(returnShippingInfoId: string, dto: UpdateShippingStatusDto) {
    const info = await this.prisma.returnShippingInfo.findUnique({
      where: { id: returnShippingInfoId },
      include: { appointment: true },
    });
    if (!info) throw new BadRequestException('Không tìm thấy đơn trả mẫu');

    const valid = {
      PickupRequested: ['SampleInTransit'],
      SampleInTransit: ['ReturnedToLab'],
      ReturnedToLab: [],
    };
    if (!valid[info.shipping_status]?.includes(dto.shipping_status)) {
      throw new BadRequestException('Chuyển trạng thái không hợp lệ');
    }

    const txs: any[] = [
      this.prisma.returnShippingInfo.update({
        where: { id: returnShippingInfoId },
        data: { shipping_status: dto.shipping_status, updated_at: new Date() },
      }),
    ];

    if (dto.shipping_status === 'ReturnedToLab') {
      txs.push(
        this.prisma.appointment.update({
          where: { appointment_id: info.appointment_id },
          data: {
            status: 'SampleCollected',
            sample_collected_date: new Date(),
          },
        }),
      );
    }

    return this.prisma.$transaction(txs);
  }

  async customerReturnSample(appointmentId: string) {
    const existingShipping = await this.prisma.shippingInfo.findFirst({
      where: {
        appointment_id: appointmentId,
        shipping_status: 'DeliveredToCustomer',
      },
      include: { appointment: true },
    });
    if (!existingShipping) {
      throw new BadRequestException('Không thể trả mẫu khi chưa nhận kit');
    }

    const service = await this.prisma.service.findUnique({
      where: { service_id: existingShipping.appointment.service_id ?? undefined },
    });
    if (!service?.return_address || !service.return_phone) {
      throw new BadRequestException('Chưa cấu hình địa chỉ nhận mẫu');
    }

    return this.prisma.returnShippingInfo.create({
      data: {
        appointment_id: appointmentId,
        provider: 'GHTK',
        provider_order_code: `[MOCK-GHTK]_${appointmentId}-return`,
        shipping_status: 'PickupRequested',
        contact_name: existingShipping.contact_name,
        contact_phone: existingShipping.contact_phone,
        pickup_address: existingShipping.shipping_address,
        pickup_province: existingShipping.province,
        pickup_district: existingShipping.district,
        pickup_ward: existingShipping.ward,
      },
    });
  }

 



  async getShippingInfoByAppointmentId(appointmentId: string) {
    const [forward, returned] = await Promise.all([
      this.prisma.shippingInfo.findUnique({
        where: { appointment_id: appointmentId },
      }),
      this.prisma.returnShippingInfo.findUnique({
        where: { appointment_id: appointmentId },
      }),
    ]);

    return { forward, return: returned };
  }

}