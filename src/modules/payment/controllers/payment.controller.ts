import { Controller, Post, Body, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { PaymentService } from '../services/payment.service';

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
  createLink(@Req() req, @Body() dto: CreatePaymentDto) {
    const userId = (req.user as any).userId;
    return this.paymentService.createPaymentLink(userId, dto);
  }

  @Get('link/:orderCode')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy thông tin thanh toán' })
  @ApiBearerAuth('access-token')
  getInfo(@Param('orderCode') code: string) {
    return this.paymentService.getPaymentLinkInfo(Number(code));
  }
}
