import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ShippingService } from '../services/shipping.service';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateShippingStatusDto } from '../dtos/update-shipping-status.dto';
import { UpdateReturnStatusDto } from '../dtos/update-return-status.dto';

@ApiTags('Shipping')
@Controller('shipping')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) { }

  // ========================== OUTBOUND SHIPPING ==========================

  /**
   * Lấy thông tin vận chuyển chiều đi + chiều về theo appointment.
   */
  @Get('appointments/:id')
  @Roles(Role.Staff, Role.Customer, Role.Manager)
  @ApiOperation({
    summary: 'Lấy thông tin vận chuyển theo lịch hẹn',
    description: 'Trả về cả thông tin chiều đi (outbound) và chiều về (return) theo appointmentId.',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  async getByAppointment(@Param('id') appointmentId: string) {
    const info = await this.shippingService.getByAppointmentId(appointmentId);
    if (!info) throw new NotFoundException('Không tìm thấy thông tin vận chuyển');
    return info;
  }

  /**
   * Lấy chi tiết đơn chiều đi theo shippingInfo.id
   */
  @Get(':id')
  @Roles(Role.Staff, Role.Customer, Role.Manager)
  @ApiOperation({
    summary: 'Lấy thông tin đơn chiều đi theo ID',
    description: 'Trả về chi tiết đơn vận chuyển chiều đi.',
  })
  @ApiParam({ name: 'id', description: 'ShippingInfo ID' })
  async getByShippingId(@Param('id') id: string) {
    const info = await this.shippingService.getShippingById(id);
    if (!info) throw new NotFoundException('Không tìm thấy đơn vận chuyển');
    return info;
  }

  /**
   * Tạo đơn GHN chiều đi cho lịch hẹn.
   */
  @Post('appointments/:id/order-ghn')
  @Roles(Role.Staff)
  @ApiOperation({
    summary: 'Tạo đơn GHN chiều đi',
    description: 'Tạo đơn chiều đi từ Lab đến khách hàng cho một lịch hẹn.',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  async createGhnOrder(@Param('id') appointmentId: string) {
    const result = await this.shippingService.createOrderForAppointment(appointmentId);
    if (!result) throw new NotFoundException('Không tìm thấy lịch hẹn hoặc thông tin vận chuyển');
    return result;
  }

  /**
   * Cập nhật trạng thái đơn chiều đi.
   */
  @Patch(':id/status')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({
    summary: 'Cập nhật trạng thái đơn chiều đi',
    description: 'Các trạng thái: Pending, Shipped, DeliveredToCustomer, Failed',
  })
  @ApiParam({ name: 'id', description: 'ShippingInfo ID' })
  @ApiBody({ type: UpdateShippingStatusDto })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateShippingStatusDto) {
    return this.shippingService.updateStatus(id, dto.status);
  }

  // ========================== RETURN REQUEST ==========================

  /**
   * Customer yêu cầu trả mẫu.
   */
  @Post('appointments/:id/return-request')
  @Roles(Role.Customer)
  @ApiOperation({
    summary: 'Yêu cầu trả mẫu (PickupRequested)',
    description: 'Customer yêu cầu trả mẫu → chuyển trạng thái đơn chiều đi sang PickupRequested.',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  async requestReturn(@Param('id') appointmentId: string) {
    return this.shippingService.markReturnRequested(appointmentId);
  }

  // ========================== RETURN SHIPPING ==========================

  /**
   * Lấy chi tiết đơn chiều về theo returnShippingInfo.id
   */
  @Get('return/:id')
  @Roles(Role.Staff, Role.Customer, Role.Manager)
  @ApiOperation({
    summary: 'Lấy thông tin đơn chiều về theo ID',
    description: 'Trả về chi tiết đơn chiều về theo returnShippingInfo.id.',
  })
  @ApiParam({ name: 'id', description: 'ReturnShippingInfo ID' })
  async getReturnById(@Param('id') id: string) {
    const info = await this.shippingService.getReturnShippingById(id);
    if (!info) throw new NotFoundException('Không tìm thấy đơn chiều về');
    return info;
  }

  /**
   * Tạo đơn GHN chiều về.
   */
  @Post('appointments/:id/order-ghn-return')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({
    summary: 'Tạo đơn GHN chiều về',
    description: 'Tạo đơn chiều về từ khách hàng về Lab sau khi có yêu cầu trả mẫu.',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  async createGhnReturnOrder(@Param('id') appointmentId: string) {
    return this.shippingService.createReturnOrderForAppointment(appointmentId);
  }

  /**
   * Cập nhật trạng thái đơn chiều về.
   */
  @Patch('return/:id/status')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({
    summary: 'Cập nhật trạng thái đơn chiều về',
    description: 'Các trạng thái: SampleInTransit, ReturnedToLab, Failed',
  })
  @ApiParam({ name: 'id', description: 'ReturnShippingInfo ID' })
  @ApiBody({ type: UpdateReturnStatusDto })
  async updateReturnStatus(@Param('id') id: string, @Body() dto: UpdateReturnStatusDto) {
    return this.shippingService.updateReturnStatus(id, dto.status);
  }
}
