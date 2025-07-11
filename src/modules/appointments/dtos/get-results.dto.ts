import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetResultsDto {
  @ApiProperty({
    description: 'Mã xét nghiệm (test_code)',
    required: true,
    example: 'STI-123',
  })
  @IsString()
  testCode: string;

  @ApiProperty({
    description: 'Tên đầy đủ của người dùng',
    required: true,
    example: 'Nguyen Van A',
  })
  @IsString()
  fullName: string;
}