import { IsEnum } from 'class-validator'
import { ShippingStatus } from '../enums/shipping-status.enum'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateShippingStatusDto {
  @ApiProperty({
    description: 'Trạng thái đơn vận chuyển cần cập nhật',
    enum: ShippingStatus,
    example: ShippingStatus.DeliveredToCustomer,
  })
  @IsEnum(ShippingStatus)
  status: ShippingStatus
}
