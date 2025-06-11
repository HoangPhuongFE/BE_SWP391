// src/modules/services/controllers/service.controller.ts
import { Controller, Post, Patch, Delete, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
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
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo dịch vụ mới' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateServiceDto })
  async createService(@Body() dto: CreateServiceDto) {
    return this.serviceService.createService(dto);
  }

  @Patch(':serviceId')
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật thông tin và giá dịch vụ' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateServiceDto })
  async updateService(@Param('serviceId') serviceId: string, @Body() dto: UpdateServiceDto) {
    return this.serviceService.updateService(serviceId, dto);
  }

  @Delete(':serviceId')
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xóa dịch vụ' })
  @ApiBearerAuth('access-token')
  async deleteService(@Param('serviceId') serviceId: string) {
    return this.serviceService.deleteService(serviceId);
  }

  @Get()
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem danh sách tất cả dịch vụ' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  async getServices(@Query('category') category?: string, @Query('is_active') isActive?: boolean) {
    return this.serviceService.getServices(category, isActive);
  }

  @Get(':serviceId')
  @Roles(Role.Manager, Role.Admin)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem chi tiết dịch vụ theo ID' })
  @ApiBearerAuth('access-token')
  async getServiceById(@Param('serviceId') serviceId: string) {
    return this.serviceService.getServiceById(serviceId);
  }

  @Get(':serviceId/consultants')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem danh sách Consultant và lịch trống theo dịch vụ' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'date', required: false })
  async getConsultantsWithSchedules(@Param('serviceId') serviceId: string, @Query('date') date?: string) {
    return this.serviceService.getConsultantsWithSchedules(serviceId, date);
  }
}