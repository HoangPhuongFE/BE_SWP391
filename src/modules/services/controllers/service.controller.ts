import { Controller, Post, Patch, Delete, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ServiceService } from '../services/service.service';
import { CreateServiceDto } from '../dtos/create-service.dto';
import { UpdateServiceDto } from '../dtos/update-service.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('Services')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) { }

  /**
   * Tạo dịch vụ mới (chỉ MANAGER).
   * - FE cần: Form nhập thông tin dịch vụ (name, category, price, description, type, available_modes, return_address, return_phone, is_active).
   * - Nếu type = Testing hoặc available_modes chứa AT_HOME, bắt buộc có return_address và return_phone.
   * - Gửi POST request với body theo CreateServiceDto.
   * - Trả về: Dịch vụ mới tạo (JSON).
   */
  @Post()
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Tạo dịch vụ mới',
    description: 'Chỉ MANAGER tạo được. Yêu cầu đầy đủ thông tin dịch vụ. Với Testing hoặc AT_HOME, cần return_address và return_phone. Trả về dịch vụ vừa tạo.',
  })
  @ApiBody({ type: CreateServiceDto })
  async createService(@Body() dto: CreateServiceDto) {
    return this.serviceService.createService(dto);
  }

  /**
   * Cập nhật dịch vụ (chỉ MANAGER).
   * - FE cần: Form chỉnh sửa thông tin dịch vụ (theo UpdateServiceDto).
   * - serviceId lấy từ URL param.
   * - Nếu cập nhật available_modes thành AT_HOME, cần return_address và return_phone.
   * - Gửi PATCH request với body theo UpdateServiceDto.
   * - Trả về: Dịch vụ đã cập nhật (JSON)
   * .
   */
  @Patch(':serviceId')
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cập nhật dịch vụ',
    description: 'Chỉ MANAGER cập nhật được. Cần serviceId và thông tin cần chỉnh sửa. Nếu thêm AT_HOME, cần return_address và return_phone. Trả về dịch vụ đã cập nhật.',
  })
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ cần cập nhật' })
  @ApiBody({ type: UpdateServiceDto })
  async updateService(
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.serviceService.updateService(serviceId, dto);
  }

  /**
   * Xóa mềm dịch vụ (chỉ MANAGER).
   * - FE cần: Button xác nhận xóa dịch vụ với serviceId.
   * - Gửi DELETE request với serviceId trong URL.
   * - Trả về: Dịch vụ đã xóa mềm (JSON, có deleted_at).
   */
  @Delete(':serviceId')
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Xóa mềm dịch vụ',
    description: 'Chỉ MANAGER xóa được. Dịch vụ được đánh dấu deleted_at, không xóa cứng. Trả về dịch vụ đã xóa.',
  })
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ cần xóa' })
  async deleteService(@Param('serviceId') serviceId: string) {
    return this.serviceService.deleteService(serviceId);
  }

  /**
   * Lấy danh sách dịch vụ.
   * - FE cần: Giao diện hiển thị danh sách dịch vụ, hỗ trợ bộ lọc category và is_active.
   * - Query params: category (string, tùy chọn), is_active (boolean, tùy chọn).
   * - Gửi GET request, trả về danh sách dịch vụ (JSON array).
   */
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách dịch vụ',
    description: 'Trả về danh sách dịch vụ chưa xóa, hỗ trợ lọc theo category và is_active. FE hiển thị danh sách và bộ lọc.',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Lọc theo danh mục (VD: STI)' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Lọc theo trạng thái hoạt động' })
  async getServices(
    @Query('category') category?: string,
    @Query('is_active') isActive?: boolean,
  ) {
    return this.serviceService.getServices(category, isActive);
  }

  /**
   * Lấy chi tiết dịch vụ (PUBLIC).
   * - FE cần: Trang chi tiết dịch vụ với serviceId.
   * - Nếu type = Consultation, hiển thị thêm danh sách consultant và lịch trống.
   * - Query param: date (YYYY-MM-DD, tùy chọn) để lọc lịch.
   * - Gửi GET request, trả về: Chi tiết dịch vụ (JSON). Nếu Consultation, có thêm consultants và schedules.
   */
  @Get(':serviceId')
  @Public()
  @ApiOperation({
    summary: 'Lấy chi tiết dịch vụ (PUBLIC)',
    description: 'Trả về chi tiết dịch vụ với serviceId. Nếu Consultation, bao gồm danh sách consultant và lịch trống (lọc theo date nếu có). FE hiển thị chi tiết và lịch.',
  })
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ' })
  @ApiQuery({ name: 'date', required: false, description: 'Ngày lọc lịch (YYYY-MM-DD)' })
  async getServiceById(
    @Param('serviceId') serviceId: string,
    @Query('date') date?: string,
  ) {
    return this.serviceService.getServiceById(serviceId, date);
  }
}