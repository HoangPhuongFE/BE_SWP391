import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
    this.apiUrl = this.configService.get<string>('GHTK_API_URL') || '';
    this.token = this.configService.get<string>('GHTK_API_TOKEN') || '';
    if (!this.token) {
      throw new BadRequestException('GHTK_API_TOKEN không được cấu hình');
    }
  }

  async createOrder(payload: GhtkCreateOrderDto): Promise<any> {
    const url = `${this.apiUrl}/services/shipment/order`;
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: { 'Content-Type': 'application/json', 'Token': this.token },
        }),
      );
      if (!response.data.success) {
        this.logger.error(`GHTK API lỗi: ${JSON.stringify(response.data)}`);
        throw new BadRequestException(`Tạo đơn GHTK thất bại: ${response.data.message}`);
      }
      return response.data;
    } catch (error) {
      this.logger.error('Lỗi khi tạo đơn GHTK', error?.response?.data || error.message);
      throw new BadRequestException(`Tạo đơn GHTK thất bại: ${error?.response?.data?.message || error.message}`);
    }
  }

  async getOrderStatus(label: string): Promise<any> {
    const url = `${this.apiUrl}/services/shipment/v2/${label}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: { 'Token': this.token } }),
      );
      if (!response.data.success) {
        this.logger.error(`GHTK API lỗi: ${JSON.stringify(response.data)}`);
        throw new BadRequestException(`Lấy trạng thái GHTK thất bại: ${response.data.message}`);
      }
      return response.data;
    } catch (error) {
      this.logger.error('Lỗi khi lấy trạng thái GHTK', error?.response?.data || error.message);
      throw new BadRequestException(`Lấy trạng thái GHTK thất bại: ${error?.response?.data?.message || error.message}`);
    }
  }
}