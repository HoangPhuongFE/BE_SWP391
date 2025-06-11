// src/modules/appointments/dtos/get-test-result.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetTestResultDto {
  @ApiProperty({ example: "app001", description: 'Mã lịch hẹn xét nghiệm' })
  @IsString()
  appointmentId: string;
}