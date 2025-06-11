// src/modules/cycles/controllers/cycle.controller.ts
import { Controller, Post, Get, Patch, Body, Req, Query, UseGuards, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { CycleService } from '../services/cycle.service';
import { SetupCycleDto } from '../dtos/setup-cycle.dto';
import { CreateCycleDto } from '../dtos/create-cycle.dto';
import { UpdateSymptomsDto } from '../dtos/update-symptoms.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Menstrual Cycles')
@Controller('cycles')
export class CycleController {
  constructor(private readonly cycleService: CycleService) {}

  @Post('setup')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Thiết lập chu kỳ kinh nguyệt lần đầu' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: SetupCycleDto })
  async setupCycle(@Req() req, @Body() dto: SetupCycleDto) {
    const userId = (req.user as any).userId;
    return this.cycleService.setupCycle(userId, dto);
  }

  @Post()
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Ghi nhận chu kỳ kinh nguyệt mới' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateCycleDto })
  async createCycle(@Req() req, @Body() dto: CreateCycleDto) {
    const userId = (req.user as any).userId;
    return this.cycleService.createCycle(userId, dto);
  }

  @Patch(':cycleId/symptoms')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật triệu chứng cho chu kỳ' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateSymptomsDto })
  async updateSymptoms(@Req() req, @Param('cycleId') cycleId: string, @Body() dto: UpdateSymptomsDto) {
    const userId = (req.user as any).userId;
    return this.cycleService.updateSymptoms(userId, cycleId, dto);
  }

  @Get()
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem lịch sử chu kỳ kinh nguyệt' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  async getCycles(@Req() req, @Query() query: { startDate?: string; endDate?: string; limit?: string; page?: string }) {
    const userId = (req.user as any).userId;
    return this.cycleService.getCycles(userId, {
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit ? parseInt(query.limit) : undefined,
      page: query.page ? parseInt(query.page) : undefined,
    });
  }

  @Get('analytics')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Phân tích dữ liệu chu kỳ kinh nguyệt' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'timeRange', required: false, enum: ['3months', '6months', '1year'] })
  async getAnalytics(@Req() req, @Query('timeRange') timeRange: string) {
    const userId = (req.user as any).userId;
    return this.cycleService.getAnalytics(userId, timeRange);
  }
}