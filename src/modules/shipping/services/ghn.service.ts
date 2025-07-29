import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface CreateOrderInput {
  from_name: string;
  from_phone: string;
  from_address: string;
  from_district_id: number;
  from_ward_code: string;
  from_ward_name?: string;
  from_district_name?: string;
  from_province_name?: string;
  to_name: string;
  to_phone: string;
  to_address: string;
  to_district_id: number;
  to_ward_code: string;
  to_ward_name?: string;
  to_district_name?: string;
  to_province_name?: string;
  return_phone?: string;
  return_address?: string;
  return_district_id?: number;
  return_ward_code?: string;
  client_order_code: string;
  service_id?: number;
  service_type_id?: number;
  payment_type_id?: number;
  required_note?: string;
  cod_amount?: number;
  content?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  insurance_value?: number;
  items?: Array<{
    name: string;
    code: string;
    quantity: number;
    price: number;
    length: number;
    width: number;
    height: number;
    weight: number;
    category: { level1: string };
  }>;
}

@Injectable()
export class GhnService {
  constructor(private readonly httpService: HttpService) {}

  async createOrder(input: CreateOrderInput) {
    const { GHN_TOKEN, GHN_SHOP_ID, GHN_API_URL } = process.env;
    if (!GHN_TOKEN || !GHN_SHOP_ID || !GHN_API_URL) {
      throw new Error('Thiếu biến môi trường cấu hình GHN');
    }

    const serviceResponse = await firstValueFrom(
      this.httpService.post(
        `${GHN_API_URL}/shipping-order/available-services`,
        { shop_id: +GHN_SHOP_ID, from_district: input.from_district_id, to_district: input.to_district_id },
        { headers: { Token: GHN_TOKEN, 'Content-Type': 'application/json' } }
      )
    );
    const availableServices = serviceResponse.data.data;
    if (!availableServices?.length) {
      throw new Error('Không có dịch vụ vận chuyển khả dụng cho tuyến này');
    }
    const service_id = availableServices.find(s => s.service_type_id === 2)?.service_id || availableServices[0].service_id;

    const payload: CreateOrderInput = {
      from_name: input.from_name,
      from_phone: input.from_phone,
      from_address: input.from_address,
      from_district_id: input.from_district_id,
      from_ward_code: input.from_ward_code,
      from_ward_name: input.from_ward_name || 'Phường Bến Nghé',
      from_district_name: input.from_district_name || 'Quận 1',
      from_province_name: input.from_province_name || 'Hồ Chí Minh',
      to_name: input.to_name,
      to_phone: input.to_phone,
      to_address: input.to_address,
      to_district_id: input.to_district_id,
      to_ward_code: input.to_ward_code,
      to_ward_name: input.to_ward_name || 'Unknown',
      to_district_name: input.to_district_name || 'Unknown',
      to_province_name: input.to_province_name || 'Hồ Chí Minh',
      return_phone: input.return_phone,
      return_address: input.return_address,
      return_district_id: input.return_district_id,
      return_ward_code: input.return_ward_code,
      client_order_code: input.client_order_code,
      service_id,
      service_type_id: input.service_type_id,
      payment_type_id: input.payment_type_id,
      required_note: input.required_note,
      cod_amount: input.cod_amount,
      content: input.content,
      weight: input.weight,
      length: input.length,
      width: input.width,
      height: input.height,
      insurance_value: input.insurance_value,
      items: input.items,
    };

    const url = `${GHN_API_URL}/shipping-order/create`;
    try {
      const res = await firstValueFrom(
        this.httpService.post(url, payload, { headers: { Token: GHN_TOKEN, ShopId: +GHN_SHOP_ID, 'Content-Type': 'application/json' } })
      );
      return res.data.data;
    } catch (error) {
      const response = error?.response?.data;
      throw new Error(`GHN createOrder lỗi: ${response?.code_message_value || response?.message || error.message}`);
    }
  }
}