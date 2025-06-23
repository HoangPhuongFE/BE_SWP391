// src/shipping/dtos/update-return-status.dto.ts
import { ShippingStatus } from '../enums/shipping-status.enum'
import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateReturnStatusDto {
  @ApiProperty({
    enum: ShippingStatus,
    description: 'Trạng thái mới của đơn chiều về. Chỉ chấp nhận các giá trị: SampleInTransit, ReturnedToLab, Failed',
    example: ShippingStatus.ReturnedToLab,
  })
  @IsEnum(ShippingStatus, { message: 'status không hợp lệ' })
  status: ShippingStatus
}
