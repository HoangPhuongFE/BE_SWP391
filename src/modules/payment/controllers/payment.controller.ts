import { Controller, Post, Body, UseGuards, Param, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('link')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo liên kết thanh toán' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreatePaymentDto })
  async createPaymentLink(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createPaymentLink(dto);
  }

  @Get('link/:orderCode')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy thông tin thanh toán' })
  @ApiBearerAuth('access-token')
  async getPaymentLinkInfo(@Param('orderCode') orderCodeStr: string) {
    const orderCode = Number(orderCodeStr);
    return this.paymentService.getPaymentLinkInfo(orderCode);
  }
}
