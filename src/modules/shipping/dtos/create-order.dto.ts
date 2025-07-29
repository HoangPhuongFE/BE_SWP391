import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  appointmentId: string;

  @IsString()
  @IsNotEmpty()
  contact_name: string;

  @IsString()
  @Matches(/^0[0-9]{9}$/, { message: 'Số điện thoại không hợp lệ' })
  contact_phone: string;

  @IsString()
  @IsNotEmpty()
  shipping_address: string;

  @IsString()
  @Matches(/^[0-9]+$/, { message: 'District phải là ID (số)' })
  district: string; // districtId từ FE

  @IsString()
  @Matches(/^[0-9]+$/, { message: 'Ward phải là code (số)' })
  ward: string; // wardCode từ FE
}
