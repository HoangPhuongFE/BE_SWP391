// src/modules/appointments/dtos/get-test-result.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetTestResultDto {
  @ApiProperty({ example: 'HIV123', description: 'Mã xét nghiệm' })
  @IsString()
  testCode: string;
}
