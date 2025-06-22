import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ShippingStatus } from '@prisma/client';

export class UpdateReturnShippingStatusDto {
    @ApiProperty({ enum: ShippingStatus })
  @IsEnum(ShippingStatus)
  shipping_status: ShippingStatus;
}
