import { Controller, Post, Patch, Param, Body, UseGuards , Get, Req} from '@nestjs/common';
import { ShippingService } from '../services/shipping.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { CreateShippingInfoDto } from '../dtos/create-shipping-info.dto';
import { UpdateShippingStatusDto } from '../dtos/update-shipping-status.dto';
import { ApiTags, ApiBearerAuth, ApiOperation ,ApiParam } from '@nestjs/swagger';

@ApiTags('Shipping')
@Controller('appointments/:appointmentId/shipping')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) { }

  @Post('info')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({ summary: 'Staff tạo thông tin shipping' })
  async createShippingInfo(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CreateShippingInfoDto
  ) {
    return this.shippingService.createShippingInfo(appointmentId, dto);
  }

  @Post('order')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({ summary: 'Tạo vận đơn GHTK' })
  async createShippingOrder(@Param('appointmentId') appointmentId: string) {
    return this.shippingService.createShippingOrder(appointmentId);
  }

  @Patch('status')
  @Roles(Role.Staff, Role.Manager)
  @ApiOperation({ summary: 'Staff cập nhật trạng thái vận chuyển' })
  async updateShippingStatus(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateShippingStatusDto
  ) {
    return this.shippingService.updateShippingStatus(appointmentId, dto);
  }

  @Post('return')
  @Roles(Role.Customer)
  @ApiOperation({ summary: 'Customer gửi thông báo trả mẫu' })
  async customerReturnSample(@Param('appointmentId') appointmentId: string) {
    return this.shippingService.customerReturnSample(appointmentId);
  }


  @Get(':appointmentId/status')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tra cứu trạng thái giao nhận của lịch hẹn' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'appointmentId', description: 'ID lịch hẹn' })
  async getShippingStatus(@Param('appointmentId') appointmentId: string, @Req() req) {
    const userId = req.user.userId;
    return this.shippingService.getShippingStatus(appointmentId, userId);
  }
}


