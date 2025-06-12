import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetTestResultDto {
  @ApiProperty({ example: "app001", description: 'ID lịch hẹn' })
  @IsString()
  appointmentId: string;

  @ApiProperty({ example: "STI123", description: 'Mã xét nghiệm' })
  @IsString()
  testCode: string;
}