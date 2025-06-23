import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'

interface CreateOrderInput {
  from_name: string
  from_phone: string
  from_address: string
  from_district_id: number
  from_ward_code: string

  to_name: string
  to_phone: string
  to_address: string
  to_district_id: number
  to_ward_code: string

  client_order_code: string
}

@Injectable()
export class GhnService {
  constructor(private readonly http: HttpService) {}

  async createOrder(input: CreateOrderInput) {
    const {
      GHN_TOKEN,
      GHN_SHOP_ID,
      GHN_API_URL,
    } = process.env

    if (!GHN_TOKEN || !GHN_SHOP_ID || !GHN_API_URL) {
      throw new Error('Thiếu biến môi trường cấu hình GHN')
    }

    const payload = {
      from_name: input.from_name,
      from_phone: input.from_phone,
      from_address: input.from_address,
      from_district_id: input.from_district_id,
      from_ward_code: input.from_ward_code,

      to_name: input.to_name,
      to_phone: input.to_phone,
      to_address: input.to_address,
      to_district_id: input.to_district_id,
      to_ward_code: input.to_ward_code,

      client_order_code: input.client_order_code,

      service_id: 53320, // GHN dịch vụ tiêu chuẩn
      payment_type_id: 2, // Bên gửi trả phí
      required_note: 'KHONGCHOXEMHANG',

      items: [{ name: 'Bộ kit xét nghiệm', quantity: 1 }],
      weight: 500,
      length: 10,
      width: 10,
      height: 5,
    }

    const headers = {
      Token: GHN_TOKEN,
      ShopId: +GHN_SHOP_ID,
    }

    const url = `${GHN_API_URL}/shipping-order/create`

    try {
      const res = await firstValueFrom(this.http.post(url, payload, { headers }))
      return res.data.data
    } catch (error) {
      const response = error?.response?.data
      throw new Error(
        `GHN createOrder lỗi: ${response?.code_message_value || error.message}`
      )
    }
  }
}
