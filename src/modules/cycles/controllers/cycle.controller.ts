import { Controller, Post, Get, Patch, Body, Req, Query, UseGuards, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Thiết lập chu kỳ kinh nguyệt lần đầu', description: 'Cho phép khách hàng thiết lập thông tin chu kỳ kinh nguyệt ban đầu, bao gồm ngày bắt đầu, độ dài kỳ kinh và dữ liệu chu kỳ trước đó để dự đoán.' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: SetupCycleDto, description: 'Dữ liệu để thiết lập chu kỳ, bao gồm ngày bắt đầu, độ dài kỳ kinh và danh sách chu kỳ trước đó (nếu có).' })
  async setupCycle(@Req() req, @Body() dto: SetupCycleDto) {
    const userId = (req.user as any).userId;
    return this.cycleService.setupCycle(userId, dto);
  }

  @Post()
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Ghi nhận chu kỳ kinh nguyệt mới', description: 'Cho phép khách hàng ghi nhận một chu kỳ kinh nguyệt mới với thông tin về ngày bắt đầu, độ dài kỳ kinh, triệu chứng và ghi chú.' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateCycleDto, description: 'Dữ liệu để tạo chu kỳ mới, bao gồm ngày bắt đầu, độ dài kỳ kinh, triệu chứng và ghi chú (tùy chọn).' })
  async createCycle(@Req() req, @Body() dto: CreateCycleDto) {
    const userId = (req.user as any).userId;
    return this.cycleService.createCycle(userId, dto);
  }

  @Patch(':cycleId/symptoms')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật triệu chứng cho chu kỳ', description: 'Cho phép khách hàng cập nhật triệu chứng và ghi chú cho một chu kỳ kinh nguyệt cụ thể dựa trên ID chu kỳ.' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'cycleId', description: 'ID của chu kỳ kinh nguyệt cần cập nhật', type: String })
  @ApiBody({ type: UpdateSymptomsDto, description: 'Dữ liệu để cập nhật, bao gồm danh sách triệu chứng và ghi chú (tùy chọn).' })
  async updateSymptoms(@Req() req, @Param('cycleId') cycleId: string, @Body() dto: UpdateSymptomsDto) {
    const userId = (req.user as any).userId;
    return this.cycleService.updateSymptoms(userId, cycleId, dto);
  }

  @Get()
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem lịch sử chu kỳ kinh nguyệt', description: 'Trả về danh sách các chu kỳ kinh nguyệt của khách hàng, có thể lọc theo khoảng thời gian, số lượng bản ghi và trang.' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu để lọc chu kỳ (định dạng ISO).' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc để lọc chu kỳ (định dạng ISO).' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số lượng bản ghi tối đa trên mỗi trang (mặc định: 10).' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang hiện tại (mặc định: 1).' })
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
  @ApiOperation({ summary: 'Phân tích dữ liệu chu kỳ kinh nguyệt', description: 'Cung cấp phân tích dữ liệu chu kỳ kinh nguyệt, bao gồm độ dài trung bình của chu kỳ và kỳ kinh, biểu đồ dữ liệu và cảnh báo bất thường (nếu có) dựa trên khoảng thời gian được chọn.' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'timeRange', required: false, enum: ['3months', '6months', '1year'], description: 'Khoảng thời gian để phân tích (3 tháng, 6 tháng, 1 năm; mặc định: 3 tháng).' })
  async getAnalytics(@Req() req, @Query('timeRange') timeRange: string) {
    const userId = (req.user as any).userId;
    return this.cycleService.getAnalytics(userId, timeRange);
  }
}