import { IsInt, IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 123456789, description: 'Mã đơn hàng (số)' })
  @IsInt()
  orderCode: number;

  @ApiProperty({ example: 1500000, description: 'Số tiền (VND)' })
  @IsInt()
  amount: number;

  @ApiProperty({ example: 'Thanh toán dịch vụ', description: 'Mô tả' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'http://your-frontend.com/cancel', description: 'URL hủy' })
  @IsUrl()
  cancelUrl: string;

  @ApiProperty({ example: 'http://your-frontend.com/success', description: 'URL thành công' })
  @IsUrl()
  returnUrl: string;

  @ApiProperty({ example: 'user123', description: 'Tên người mua', required: false })
  @IsOptional()
  @IsString()
  buyerName?: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email người mua', required: false })
  @IsOptional()
  @IsString()
  buyerEmail?: string;

  @ApiProperty({ example: '0901234567', description: 'Số điện thoại người mua', required: false })
  @IsOptional()
  @IsString()
  buyerPhone?: string;
}
