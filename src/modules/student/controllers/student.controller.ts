import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { StudentService } from '../services/student.service';
import { CreateStudentDto } from '../dtos/create-student.dto';
import { UpdateStudentDto } from '../dtos/update-student.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('students') 
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo sinh viên mới' })
  @ApiResponse({ status: 201, description: 'Sinh viên đã được tạo' })
  @ApiBody({ type: CreateStudentDto })
  create(@Body() dto: CreateStudentDto) {
    return this.studentService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả sinh viên' })
  @ApiResponse({ status: 200, description: 'Danh sách sinh viên' })
  findAll() {
    return this.studentService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin sinh viên theo ID' })
  @ApiParam({ name: 'id', required: true, example: 1 })
  @ApiResponse({ status: 200, description: 'Chi tiết sinh viên' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.studentService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin sinh viên' })
  @ApiParam({ name: 'id', required: true, example: 1 })
  @ApiBody({ type: UpdateStudentDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa sinh viên theo ID' })
  @ApiParam({ name: 'id', required: true, example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.studentService.remove(id);
  }
}
