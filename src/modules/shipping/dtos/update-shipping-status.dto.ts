import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ShippingStatus } from '@prisma/client';

export class UpdateShippingStatusDto {
  @ApiProperty({ enum: ShippingStatus })
  @IsEnum(ShippingStatus)
  shipping_status: ShippingStatus;
}
