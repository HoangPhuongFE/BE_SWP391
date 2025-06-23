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
  constructor(private readonly serviceService: ServiceService) {}

  /**
   * MANAGER tạo dịch vụ mới.
   */
  @Post()
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Tạo dịch vụ mới',
    description: 'Chỉ MANAGER có thể tạo mới dịch vụ. Với dịch vụ Testing và hỗ trợ AT_HOME thì bắt buộc phải nhập return_address và return_phone.',
  })
  @ApiBody({ type: CreateServiceDto })
  async createService(@Body() dto: CreateServiceDto) {
    return this.serviceService.createService(dto);
  }

  /**
   * MANAGER cập nhật thông tin dịch vụ.
   */
  @Patch(':serviceId')
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cập nhật thông tin dịch vụ',
    description: 'Chỉ MANAGER có thể cập nhật dịch vụ. Nếu cập nhật mode sang AT_HOME thì cần có return_address và return_phone.',
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
   * MANAGER xóa mềm dịch vụ.
   */
  @Delete(':serviceId')
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Xóa dịch vụ (soft delete)',
    description: 'Chỉ MANAGER có quyền xóa dịch vụ. Hệ thống sẽ gán deleted_at thay vì xóa cứng.',
  })
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ cần xóa' })
  async deleteService(@Param('serviceId') serviceId: string) {
    return this.serviceService.deleteService(serviceId);
  }

  /**
   * Lấy danh sách tất cả dịch vụ, có thể lọc theo category và trạng thái hoạt động.
   */
  @Get()
  @ApiOperation({
    summary: 'Danh sách dịch vụ',
    description: 'Trả về danh sách tất cả dịch vụ chưa bị xoá. Có thể lọc theo danh mục (category) và trạng thái hoạt động (is_active).',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Lọc theo danh mục dịch vụ (VD: STI)' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Lọc theo trạng thái hoạt động' })
  async getServices(
    @Query('category') category?: string,
    @Query('is_active') isActive?: boolean,
  ) {
    return this.serviceService.getServices(category, isActive);
  }

  /**
   * Lấy chi tiết dịch vụ (PUBLIC).
   * Nếu là dịch vụ tư vấn, trả về danh sách consultant + lịch trống.
   */
  @Get(':serviceId')
  @Public()
  @ApiOperation({
    summary: 'Chi tiết dịch vụ (PUBLIC)',
    description: `Trả về chi tiết dịch vụ. Nếu là loại 'Consultation', bao gồm lịch trống và thông tin chuyên gia.`,
  })
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ' })
  @ApiQuery({ name: 'date', required: false, description: 'Ngày cần lọc lịch (format: YYYY-MM-DD)' })
  async getServiceById(
    @Param('serviceId') serviceId: string,
    @Query('date') date?: string,
  ) {
    return this.serviceService.getServiceById(serviceId, date);
  }
}
