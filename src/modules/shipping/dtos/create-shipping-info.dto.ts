import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateShippingInfoDto {
  @ApiProperty() @IsString() provider: string;
  @ApiProperty() @IsString() contact_name: string;
  @ApiProperty() @IsString() contact_phone: string;
  @ApiProperty() @IsString() shipping_address: string;
  @ApiProperty() @IsString() province: string;
  @ApiProperty() @IsString() district: string;
  @ApiProperty() @IsString() ward: string;
}
