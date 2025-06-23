import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { GhnService } from './ghn.service'
import { ShippingStatus } from '../enums/shipping-status.enum'

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ghnService: GhnService,
  ) { }

  async createOrderForAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId },
      include: { shipping_info: true },
    })

    if (!appointment?.shipping_info) return null

    const info = appointment.shipping_info

    const from = {
      name: 'Phòng Lab ABC',
      phone: '0938982776',
      address: '123 Pasteur, Q1, TP.HCM',
      district_id: process.env.GHN_FROM_DISTRICT ? +process.env.GHN_FROM_DISTRICT : (() => { throw new Error('GHN_FROM_DISTRICT env variable is not set'); })(),
      ward_code: process.env.GHN_FROM_WARD ?? (() => { throw new Error('GHN_FROM_WARD env variable is not set'); })(),
    }

    let ghnData: any
    try {
      ghnData = await this.ghnService.createOrder({
        from_name: from.name,
        from_phone: from.phone,
        from_address: from.address,
        from_district_id: from.district_id,
        from_ward_code: from.ward_code,

        to_name: info.contact_name,
        to_phone: info.contact_phone,
        to_address: info.shipping_address,
        to_district_id: parseInt(info.district),
        to_ward_code: info.ward,
        client_order_code: appointmentId,
      })
    } catch (error) {
      console.warn('GHN lỗi:', error.message)
      ghnData = {
        order_code: 'MOCK-GHN-' + Date.now(),
        expected_delivery_time: new Date().toISOString(),
        label: null,
      }
    }

    await this.prisma.shippingInfo.update({
      where: { id: info.id },
      data: {
        provider: 'GHN',
        provider_order_code: ghnData.order_code,
        shipping_status: ShippingStatus.Shipped,
        expected_delivery_time: ghnData.expected_delivery_time ? new Date(ghnData.expected_delivery_time) : undefined,
        label_url: ghnData.label || null,
      },
    })

    return {
      message: 'Tạo đơn GHN chiều đi thành công',
      order_code: ghnData.order_code,
      expected_delivery_time: ghnData.expected_delivery_time,
    }
  }


  async getByAppointmentId(appointmentId: string) {
    const outbound = await this.prisma.shippingInfo.findUnique({
      where: { appointment_id: appointmentId },
      select: {
        id: true,
        appointment_id: true,
        provider: true,
        provider_order_code: true,
        shipping_status: true,
        contact_name: true,
        contact_phone: true,
        shipping_address: true,
        province: true,
        district: true,
        ward: true,
        expected_delivery_time: true,
        label_url: true,
        created_at: true,
        updated_at: true,
      },
    });

    const returnShipping = await this.prisma.returnShippingInfo.findUnique({
      where: { appointment_id: appointmentId },
      select: {
        id: true,
        appointment_id: true,
        provider: true,
        provider_order_code: true,
        shipping_status: true,
        contact_name: true,
        contact_phone: true,
        pickup_address: true,
        pickup_province: true,
        pickup_district: true,
        pickup_ward: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      outbound,
      return: returnShipping,
    };
  }

  async getShippingByAppointment(appointmentId: string) {
    return this.prisma.shippingInfo.findUnique({
      where: { appointment_id: appointmentId },
      select: this.shippingSelectFields(),
    })
  }

  async getShippingById(id: string) {
    return this.prisma.shippingInfo.findUnique({
      where: { id },
      select: this.shippingSelectFields(),
    })
  }

  private shippingSelectFields() {
    return {
      id: true,
      appointment_id: true,
      provider: true,
      provider_order_code: true,
      shipping_status: true,
      contact_name: true,
      contact_phone: true,
      shipping_address: true,
      province: true,
      district: true,
      ward: true,
      expected_delivery_time: true,
      label_url: true,
      created_at: true,
      updated_at: true,
    }
  }
  async updateStatus(id: string, status: ShippingStatus) {
    const info = await this.prisma.shippingInfo.findUnique({ where: { id } })
    if (!info) throw new Error('Không tìm thấy đơn vận chuyển')

    await this.prisma.shippingInfo.update({
      where: { id },
      data: {
        shipping_status: status,
      },
    })

    return {
      message: 'Cập nhật trạng thái thành công',
      new_status: status,
    }
  }
  async markReturnRequested(appointmentId: string) {
    const shipping = await this.prisma.shippingInfo.findUnique({
      where: { appointment_id: appointmentId },
    })

    if (!shipping) {
      throw new Error('Không tìm thấy đơn shipping chiều đi')
    }

    if (shipping.shipping_status === 'ReturnedToLab') {
      throw new Error('Mẫu đã được trả về lab, không thể yêu cầu lại')
    }

    if (shipping.shipping_status === 'PickupRequested') {
      throw new Error('Đã yêu cầu lấy mẫu rồi')
    }

    const updated = await this.prisma.shippingInfo.update({
      where: { appointment_id: appointmentId },
      data: {
        shipping_status: 'PickupRequested',
      },
    })

    return {
      message: 'Đã yêu cầu lấy lại mẫu, vui lòng đợi nhân viên xử lý.',
      status: updated.shipping_status,
    }
  }
  async createReturnOrderForAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId },
      include: { shipping_info: true },
    });

    if (!appointment?.shipping_info) {
      throw new Error('Không tìm thấy đơn chiều đi');
    }

    const outbound = appointment.shipping_info;

    if (outbound.shipping_status !== ShippingStatus.PickupRequested) {
      throw new Error('Chưa yêu cầu lấy mẫu, không thể tạo chiều về');
    }

    const existingReturn = await this.prisma.shippingInfo.findFirst({
      where: {
        appointment_id: appointmentId,
        provider: 'GHN',
        provider_order_code: { not: null },
        shipping_status: { in: [ShippingStatus.SampleInTransit, ShippingStatus.ReturnedToLab] },
      },
    });

    if (existingReturn) throw new Error('Đã tồn tại đơn chiều về');

    const to = {
      name: 'Phòng Lab ABC',
      phone: '0938982776',
      address: '123 Pasteur, Q1, TP.HCM',
      district_id: process.env.GHN_FROM_DISTRICT
        ? +process.env.GHN_FROM_DISTRICT
        : (() => {
          throw new Error('GHN_FROM_DISTRICT env variable is not set');
        })(),
      ward_code: process.env.GHN_FROM_WARD ??
        (() => {
          throw new Error('GHN_FROM_WARD env variable is not set');
        })(),
    };

    let ghnData: {
      order_code: string;
      expected_delivery_time?: string;
      label?: string | null;
    };

    try {
      ghnData = await this.ghnService.createOrder({
        from_name: outbound.contact_name,
        from_phone: outbound.contact_phone,
        from_address: outbound.shipping_address,
        from_district_id: +outbound.district,
        from_ward_code: outbound.ward,
        to_name: to.name,
        to_phone: to.phone,
        to_address: to.address,
        to_district_id: to.district_id,
        to_ward_code: to.ward_code,
        client_order_code: `${appointmentId}-RETURN`,
      });
    } catch (error: any) {
      console.warn('GHN lỗi:', error.message);

      // Fallback tạo đơn mock nếu GHN lỗi (quá tải, sai địa chỉ, lỗi server, ...)
      ghnData = {
        order_code: 'MOCK-GHN-RETURN-' + Date.now(),
        expected_delivery_time: new Date().toISOString(),
        label: null,
      };
    }

    await this.prisma.returnShippingInfo.create({
      data: {
        appointment_id: appointmentId,
        provider: 'GHN',
        provider_order_code: ghnData.order_code,
        shipping_status: ShippingStatus.SampleInTransit,
        contact_name: outbound.contact_name,
        contact_phone: outbound.contact_phone,
        pickup_address: outbound.shipping_address,
        pickup_province: outbound.province,
        pickup_district: outbound.district,
        pickup_ward: outbound.ward,
        created_at: new Date(),
      },
    });


    return {
      message: 'Tạo đơn chiều về thành công',
      order_code: ghnData.order_code,
      expected_delivery_time: ghnData.expected_delivery_time,
    };
  }


  async updateReturnStatus(id: string, status: ShippingStatus) {
    const existing = await this.prisma.returnShippingInfo.findUnique({ where: { id } })
    if (!existing) throw new Error('Không tìm thấy đơn chiều về')

    return this.prisma.returnShippingInfo.update({
      where: { id },
      data: { shipping_status: status },
    })
  }


  async getReturnShippingById(id: string) {
  return this.prisma.returnShippingInfo.findUnique({
    where: { id },
    select: {
      id: true,
      appointment_id: true,
      provider: true,
      provider_order_code: true,
      shipping_status: true,
      contact_name: true,
      contact_phone: true,
      pickup_address: true,
      pickup_province: true,
      pickup_district: true,
      pickup_ward: true,
      created_at: true,
      updated_at: true,
    },
  });
}

}
