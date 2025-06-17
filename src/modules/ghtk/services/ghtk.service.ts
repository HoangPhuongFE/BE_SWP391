import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GhtkCreateOrderDto } from '../dtos/ghtk-create-order.dto';

@Injectable()
export class GhtkService {
  private readonly logger = new Logger(GhtkService.name);
  private readonly apiUrl: string;
  private readonly token: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('GHTK_API_URL') || 'https://services.giaohangtietkiem.vn';
    this.token = this.configService.get<string>('GHTK_API_TOKEN') || '';
  }

  async createOrder(payload: GhtkCreateOrderDto): Promise<any> {
    const url = `${this.apiUrl}/services/shipment/order`;
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: { 'Content-Type': 'application/json', 'Token': this.token },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Lỗi khi tạo đơn GHTK', error?.response?.data || error);
      throw error;
    }
  }

  async getOrderStatus(label: string): Promise<any> {
    const url = `${this.apiUrl}/services/shipment/v2/${label}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: { 'Token': this.token } }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Lỗi khi lấy trạng thái GHTK', error?.response?.data || error);
      throw error;
    }
  }
}
