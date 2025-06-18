import { Controller, Post, Patch, Delete, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ServiceService } from '../services/service.service';
import { CreateServiceDto } from '../dtos/create-service.dto';
import { UpdateServiceDto } from '../dtos/update-service.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Services')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo dịch vụ mới' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateServiceDto })
  async createService(@Body() dto: CreateServiceDto) {
    return this.serviceService.createService(dto);
  }

  @Patch(':serviceId')
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật thông tin và giá dịch vụ' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ' })
  @ApiBody({ type: UpdateServiceDto })
  async updateService(@Param('serviceId') serviceId: string, @Body() dto: UpdateServiceDto) {
    return this.serviceService.updateService(serviceId, dto);
  }

  @Delete(':serviceId')
  @Roles(Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xóa dịch vụ (xóa mềm)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ' })
  async deleteService(@Param('serviceId') serviceId: string) {
    return this.serviceService.deleteService(serviceId);
  }

  @Get()
  @ApiOperation({ summary: 'Xem danh sách tất cả dịch vụ' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'category', required: false, description: 'Lọc theo danh mục' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Lọc theo trạng thái hoạt động' })
  async getServices(@Query('category') category?: string, @Query('is_active') isActive?: boolean) {
    return this.serviceService.getServices(category, isActive);
  }

  @Get(':serviceId')
  @ApiOperation({ summary: 'Xem chi tiết dịch vụ theo ID' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ' })
  async getServiceById(@Param('serviceId') serviceId: string) {
    return this.serviceService.getServiceById(serviceId);
  }

  @Get(':serviceId/consultants')
  @Roles(Role.Manager, Role.Staff)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem danh sách Consultant và lịch trống theo dịch vụ' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'serviceId', description: 'ID dịch vụ' })
  @ApiQuery({ name: 'date', required: false, description: 'Lọc lịch trống theo ngày (YYYY-MM-DD)' })
  async getConsultantsWithSchedules(@Param('serviceId') serviceId: string, @Query('date') date?: string) {
    return this.serviceService.getConsultantsWithSchedules(serviceId, date);
  }
}