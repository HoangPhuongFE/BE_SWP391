import { Controller, Post, Patch, Param, Body, UseGuards, Get, Req } from '@nestjs/common';
import { ShippingService } from '../services/shipping.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { CreateShippingInfoDto } from '../dtos/create-shipping-info.dto';
import { UpdateShippingStatusDto } from '../dtos/update-shipping-status.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';




@ApiTags('Shipping')
@ApiBearerAuth('access-token')
@Controller('shipping')
@UseGuards(AuthGuard('jwt'))
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /**
   * STAFF / MANAGER tạo thông tin giao hàng (chiều đi) cho một lịch hẹn tại nhà.
   */
  @Post('/appointments/:appointmentId/info')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({
    summary: 'Tạo thông tin giao hàng (chiều đi)',
    description: `Dùng cho STAFF / MANAGER khởi tạo thông tin shipping chiều đi (gửi kit) cho lịch hẹn tại nhà.`,
  })
  async createShippingInfo(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CreateShippingInfoDto,
  ) {
    return this.shippingService.createShippingInfo(appointmentId, dto);
  }

  /**
   * STAFF / MANAGER tạo vận đơn thực tế qua GHTK (chiều đi).
   */
  @Post('/appointments/:appointmentId/order')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({
    summary: 'Tạo vận đơn GHTK (chiều đi)',
    description: `Tạo đơn vận chuyển thật sự với GHTK sau khi đã tạo thông tin giao hàng.`,
  })
  async createShippingOrder(@Param('appointmentId') appointmentId: string) {
    return this.shippingService.createShippingOrder(appointmentId);
  }

  /**
   * CUSTOMER gửi yêu cầu trả mẫu (chiều về).
   */
  @Post('/appointments/:appointmentId/return')
  @Roles(Role.Customer)
  @ApiOperation({
    summary: 'Customer gửi yêu cầu trả mẫu (chiều về)',
    description: `Dùng khi khách hàng muốn trả lại mẫu sau khi đã nhận kit. Hệ thống sẽ tạo thông tin chiều về.`,
  })
  async customerReturnSample(@Param('appointmentId') appointmentId: string) {
    return this.shippingService.customerReturnSample(appointmentId);
  }

  /**
   * STAFF / MANAGER cập nhật trạng thái chiều đi.
   */
  @Patch('/:shippingInfoId/status')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({
    summary: 'Cập nhật trạng thái chiều đi',
    description: `Trạng thái hợp lệ:
    - Pending → Shipped
    - Shipped → DeliveredToCustomer
    Không hỗ trợ nhảy lùi hoặc bỏ bước.`,
  })
  async updateShippingStatusById(
    @Param('shippingInfoId') shippingInfoId: string,
    @Body() dto: UpdateShippingStatusDto,
  ) {
    return this.shippingService.updateShippingStatusById(shippingInfoId, dto);
  }

  /**
   * STAFF / MANAGER cập nhật trạng thái chiều về.
   */
  @Patch('/return/:returnShippingInfoId/status')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({
    summary: 'Cập nhật trạng thái chiều về',
    description: `Trạng thái hợp lệ:
    - PickupRequested → SampleInTransit
    - SampleInTransit → ReturnedToLab
    
    Không dùng các trạng thái như 'Shipped', 'DeliveredToCustomer' ở chiều về.`,
  })
  async updateReturnShippingStatusById(
    @Param('returnShippingInfoId') returnShippingInfoId: string,
    @Body() dto: UpdateShippingStatusDto,
  ) {
    return this.shippingService.updateReturnShippingStatusById(returnShippingInfoId, dto);
  }

  /**
   * STAFF / MANAGER / CUSTOMER lấy thông tin vận chuyển chiều đi và chiều về theo appointment.
   */
  @Get('/appointments/:appointmentId/shipping')
  @Roles(Role.Staff, Role.Manager, Role.Customer)
  @ApiOperation({
    summary: 'Lấy thông tin vận chuyển (chiều đi + chiều về)',
    description: `Trả về đầy đủ thông tin vận chuyển của cả chiều gửi kit và chiều trả mẫu, nếu có.`,
  })
  async getShippingInfo(@Param('appointmentId') appointmentId: string) {
    return this.shippingService.getShippingInfoByAppointmentId(appointmentId);
  }
}
