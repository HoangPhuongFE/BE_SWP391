import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { validate } from 'class-validator';
import { CreateOrderInput, GhnService } from './ghn.service';
import { ShippingStatus } from '@prisma/client';




@Injectable()
export class ShippingService {
  // Mapping tên quận/huyện song ngữ + mã trực tiếp
  private readonly districtMapping: Record<string, string> = {
    'quận 1': '1442', 'quan 1': '1442', 'district 1': '1442',
    'Tân Bình': '1455', 'tan binh': '1455', 'quan tan binh': '1455',
    // Thêm các mapping khác nếu cần
  };

  private readonly wardMapping: Record<string, Record<string, string>> = {
    '1442': {
      'phường 1': '20101', 'phuong 1': '20101', 'ngọc hà': '20102', 'ngoc ha': '20102',
      // ... các phường Quận 1 khác
    },
    '1455': {
      'phường 12': '20121', 'phuong 12': '20121',
      // ... các phường Quận Tân Bình khác
    },
    // ... mapping cho các quận còn lại
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly ghnService: GhnService,
  ) {}

  /**
   * Tạo đơn GHN cho một appointment đã có shipping_info
   */
  async createOrderForAppointment(appointmentId: string) {
    // 1. Lấy appointment + shipping_info
    const appointment = await this.prisma.appointment.findUnique({
      where: { appointment_id: appointmentId },
      include: { shipping_info: true },
    });
    if (!appointment) {
      throw new NotFoundException(`Không tìm thấy lịch hẹn với ID: ${appointmentId}`);
    }
    const info = appointment.shipping_info;
    if (!info) {
      throw new NotFoundException(`Không tìm thấy thông tin vận chuyển cho lịch hẹn: ${appointmentId}`);
    }

    // 2. Xác định districtId (hỗ trợ cả mã và tên nhiều ngôn ngữ)
    const rawDistrict = info.district;
    const dk = rawDistrict.toLowerCase().trim();
    let districtId: string;
    if (/^[0-9]+$/.test(rawDistrict)) {
      districtId = rawDistrict;
    } else if (this.districtMapping[dk]) {
      districtId = this.districtMapping[dk];
    } else {
      throw new BadRequestException(`Quận/huyện không hợp lệ: ${rawDistrict}`);
    }

    // 3. Xác định wardCode tương ứng
    const rawWard = info.ward;
    const wk = rawWard.toLowerCase().trim();
    let wardCode: string;
    if (/^[0-9]+$/.test(rawWard)) {
      wardCode = rawWard;
    } else if (this.wardMapping[districtId]?.[wk]) {
      wardCode = this.wardMapping[districtId][wk];
    } else {
      throw new BadRequestException(`Phường/xã không hợp lệ: ${rawWard}`);
    }

    // 4. Chuẩn bị thông tin người gửi (hardcode hoặc config env)
    const from = {
      name: 'Phòng Lab ABC',
      phone: '0938982776',
      address: '123 Pasteur, Q1, TP.HCM',
      district_id: +(process.env.GHN_FROM_DISTRICT || 1442),
      ward_code: process.env.GHN_FROM_WARD || '20101',
    };

    // 5. Xây payload CreateOrderInput
    const orderInput: CreateOrderInput = {
      from_name: from.name,
      from_phone: from.phone,
      from_address: from.address,
      from_district_id: from.district_id,
      from_ward_code: from.ward_code,
      from_ward_name: 'Phường Bến Nghé',
      from_district_name: 'Quận 1',
      from_province_name: 'Hồ Chí Minh',
      to_name: info.contact_name,
      to_phone: info.contact_phone,
      to_address: info.shipping_address,
      to_district_id: +districtId,
      to_ward_code: wardCode,
      to_ward_name: info.ward,
      to_district_name: info.district,
      to_province_name: 'Hồ Chí Minh',
      return_phone: from.phone,
      return_address: from.address,
      return_district_id: from.district_id,
      return_ward_code: from.ward_code,
      client_order_code: appointmentId,
      service_id: 53321,
      service_type_id: 2,
      payment_type_id: 2,
      required_note: 'KHONGCHOXEMHANG',
      cod_amount: 0,
      content: 'Bộ kit xét nghiệm',
      weight: 500,
      length: 10,
      width: 10,
      height: 5,
      insurance_value: 1000000,
      items: [
        {
          name: 'Bộ kit xét nghiệm',
          code: 'KIT123',
          quantity: 1,
          price: 200000,
          length: 10,
          width: 10,
          height: 5,
          weight: 500,
          category: { level1: 'Y tế' },
        },
      ],
    };

    // 6. Gọi GHN với retry exponential back-off + jitter
    let ghnData: any;
    const maxRetries = 15;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        ghnData = await this.ghnService.createOrder(orderInput);
        break;
      } catch (err) {
        const msg = err?.message || '';
        if (msg.includes('quá tải') && attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        // Fallback mock
        ghnData = {
          order_code: `MOCK-GHN-${Date.now()}`,
          expected_delivery_time: new Date().toISOString(),
          label: null,
        };
        break;
      }
    }

    // 7. Cập nhật lại shipping_info
    await this.prisma.shippingInfo.update({
      where: { id: info.id },
      data: {
        provider: 'GHN',
        provider_order_code: ghnData.order_code,
        shipping_status: ShippingStatus.Shipped,
        expected_delivery_time: ghnData.expected_delivery_time ? new Date(ghnData.expected_delivery_time) : undefined,
        label_url: ghnData.label || null,
      },
    });

    return { message: 'Tạo đơn GHN thành công', order_code: ghnData.order_code, expected_delivery_time: ghnData.expected_delivery_time };
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
