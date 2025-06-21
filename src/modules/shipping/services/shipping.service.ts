import { Injectable, BadRequestException } from '@nestjs/common';
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
      DeliveredToCustomer: ['PickupRequested'],
      PickupRequested: ['SampleInTransit'],
      SampleInTransit: ['ReturnedToLab'],
      ReturnedToLab: [],
      Failed: [],
      SampleCollected: []
    };
    return validTransitions[current]?.includes(next) ?? false;
  }

  async createShippingInfo(appointmentId: string, dto: CreateShippingInfoDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId, deleted_at: null },
    });

    if (!appointment) throw new BadRequestException('Lịch hẹn không tồn tại');
    if (appointment.mode !== ServiceMode.AT_HOME) {
      throw new BadRequestException('Thông tin vận chuyển chỉ áp dụng cho mode AT_HOME');
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
      throw new BadRequestException('Tạo vận đơn chỉ áp dụng cho mode AT_HOME');
    }
    if (shippingInfo.shipping_status !== 'Pending') {
      throw new BadRequestException('Trạng thái vận chuyển không phù hợp để tạo vận đơn');
    }

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

    let providerOrderCode: string;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.ghtkService.createOrder(payload);
        providerOrderCode = response.order.label;

        // Kiểm tra trùng provider_order_code
        const existing = await this.prisma.shippingInfo.findFirst({
          where: { provider_order_code: providerOrderCode, appointment_id: { not: appointmentId } },
        });
        if (existing) throw new BadRequestException('Mã vận đơn đã tồn tại');

        // Transaction cho cập nhật và thông báo
        await this.prisma.$transaction([
          this.prisma.shippingInfo.update({
            where: { appointment_id: appointmentId },
            data: {
              provider_order_code: providerOrderCode,
              shipping_status: 'Shipped',
              updated_at: new Date(),
            },
          }),
          this.prisma.notification.create({
            data: {
              user_id: shippingInfo.appointment.user_id,
              type: 'Email',
              title: 'Gửi bộ xét nghiệm',
              content: `Bộ xét nghiệm của bạn đã được gửi. Mã vận đơn: ${providerOrderCode}.`,
              status: 'Pending',
            },
          }),
          this.prisma.auditLog.create({
            data: {
              user_id: 'system', // Hoặc lấy staffId nếu có
              action: 'CREATE_SHIPPING_ORDER',
              entity_type: 'ShippingInfo',
              entity_id: shippingInfo.id,
              details: { provider_order_code: providerOrderCode },
            },
          }),
        ]);

        return { label: providerOrderCode };
      } catch (error) {
        if (attempt === 3) throw new BadRequestException(`Tạo vận đơn thất bại: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  async updateShippingStatus(appointmentId: string, dto: UpdateShippingStatusDto) {
    const shippingInfo = await this.prisma.shippingInfo.findUnique({
      where: { appointment_id: appointmentId },
      include: { appointment: true },
    });

    if (!shippingInfo) throw new BadRequestException('Không tìm thấy thông tin vận chuyển');
    if (shippingInfo.appointment.mode !== ServiceMode.AT_HOME) {
      throw new BadRequestException('Cập nhật trạng thái vận chuyển chỉ áp dụng cho mode AT_HOME');
    }

    // Kiểm tra chuyển trạng thái
    if (!this.validateShippingStatusTransition(shippingInfo.shipping_status, dto.shipping_status)) {
      throw new BadRequestException(`Không thể chuyển từ ${shippingInfo.shipping_status} sang ${dto.shipping_status}`);
    }

    const [updatedShipping] = await this.prisma.$transaction([
      // Cập nhật trạng thái vận chuyển
      this.prisma.shippingInfo.update({
        where: { appointment_id: appointmentId },
        data: { shipping_status: dto.shipping_status, updated_at: new Date() },
      }),
      // Xử lý ReturnedToLab
      ...(dto.shipping_status === 'ReturnedToLab'
        ? [
          this.prisma.appointment.update({
            where: { appointment_id: appointmentId },
            data: {
              status: 'SampleCollected',
              sample_collected_date: new Date(),
              updated_at: new Date(),
            },
          }),
          this.prisma.appointmentStatusHistory.create({
            data: {
              appointment_id: appointmentId,
              status: 'SampleCollected',
              notes: 'Nhận mẫu từ khách thành công',
              changed_by: 'system',
            },
          }),
          this.prisma.notification.create({
            data: {
              user_id: shippingInfo.appointment.user_id,
              type: 'Email',
              title: 'Nhận mẫu xét nghiệm',
              content: 'Mẫu xét nghiệm của bạn đã được nhận tại phòng lab.',
              status: 'Pending',
            },
          }),
        ]
        : []),
      // Thông báo khi giao kit cho khách
      ...(dto.shipping_status === 'DeliveredToCustomer'
        ? [
          this.prisma.notification.create({
            data: {
              user_id: shippingInfo.appointment.user_id,
              type: 'Email',
              title: 'Đã nhận bộ xét nghiệm',
              content: 'Bạn đã nhận được bộ xét nghiệm. Vui lòng thực hiện và gửi mẫu về theo hướng dẫn.',
              status: 'Pending',
            },
          }),
        ]
        : []),
      // Ghi audit log
      this.prisma.auditLog.create({
        data: {
          user_id: shippingInfo.appointment.user_id, // Hoặc lấy staffId nếu có
          action: 'UPDATE_SHIPPING_STATUS',
          entity_type: 'ShippingInfo',
          entity_id: shippingInfo.id,
          details: { shipping_status: dto.shipping_status },
        },
      }),
    ]);

    return updatedShipping;
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


  async getShippingStatus(appointmentId: string, userId: string) {
  const shippingInfo = await this.prisma.shippingInfo.findUnique({
    where: { appointment_id: appointmentId },
    include: { appointment: { select: { user_id: true, mode: true } } },
  });

  if (!shippingInfo) throw new BadRequestException('Không tìm thấy thông tin vận chuyển');
  if (shippingInfo.appointment.user_id !== userId) {
    throw new BadRequestException('Bạn không có quyền xem thông tin này');
  }
  if (shippingInfo.appointment.mode !== ServiceMode.AT_HOME) {
    throw new BadRequestException('Lịch hẹn không có thông tin vận chuyển');
  }

  const statusLabels = {
    Pending: 'Đang chuẩn bị gửi hàng',
    Shipped: 'Đã gửi',
    DeliveredToCustomer: 'Khách đã nhận kit',
    PickupRequested: 'Khách yêu cầu lấy mẫu',
    SampleInTransit: 'Mẫu đang gửi về',
    SampleCollected: 'Đã nhận mẫu',
    ReturnedToLab: 'Đã về phòng xét nghiệm',
    Failed: 'Giao hàng thất bại',
  };

  return {
    appointment_id: appointmentId,
    provider: shippingInfo.provider,
    provider_order_code: shippingInfo.provider_order_code,
    shipping_status: shippingInfo.shipping_status,
    display_status: statusLabels[shippingInfo.shipping_status], 
    contact_name: shippingInfo.contact_name,
    contact_phone: shippingInfo.contact_phone,
    shipping_address: shippingInfo.shipping_address,
    province: shippingInfo.province,
    district: shippingInfo.district,
    ward: shippingInfo.ward,
    created_at: shippingInfo.created_at,
    updated_at: shippingInfo.updated_at,
    message: 'Lấy trạng thái giao nhận thành công',
  };
}

}
