import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { StatsService } from '../services/stats.service';
import { StatsQueryDto } from '../dtos/stats-query.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Statistics')
@Controller('stats')
@UseGuards(AuthGuard('jwt'))
@Roles(Role.Manager, Role.Staff)
@ApiBearerAuth('access-token')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('appointments')
  @ApiOperation({
    summary: 'Thống kê lịch hẹn',
    description: `
Trả về thống kê lịch hẹn theo trạng thái, loại, và thời gian. Hỗ trợ lọc theo ngày bắt đầu, ngày kết thúc, loại, và trạng thái.
- Tổng số (total) cho phép tính phần trăm trên FE.
- Dữ liệu byDate hỗ trợ biểu đồ theo ngày/tháng/quý/năm.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Loại lịch hẹn (Consultation/Testing)' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Trạng thái lịch hẹn' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'month', 'quarter', 'year'], description: 'Nhóm theo ngày/tháng/quý/năm' })
  async getAppointmentStats(@Query() query: StatsQueryDto) {
    return this.statsService.getAppointmentStats(query);
  }

  @Get('test-results')
  @ApiOperation({
    summary: 'Thống kê kết quả xét nghiệm',
    description: `
Trả về thống kê kết quả xét nghiệm theo trạng thái (bình thường/bất thường) và danh mục. Hỗ trợ lọc theo ngày và danh mục.
- Tổng số (total) dùng để tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Danh mục xét nghiệm' })
  async getTestResultStats(@Query() query: StatsQueryDto) {
    return this.statsService.getTestResultStats(query);
  }

  @Get('services')
  @ApiOperation({
    summary: 'Thống kê sử dụng dịch vụ',
    description: `
Trả về thống kê số lượng lịch hẹn theo danh mục và dịch vụ. Hỗ trợ lọc theo ngày, danh mục, và ID dịch vụ.
- Tổng số (total) hỗ trợ tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Danh mục dịch vụ' })
  @ApiQuery({ name: 'serviceId', required: false, type: String, description: 'ID dịch vụ' })
  async getServiceStats(@Query() query: StatsQueryDto) {
    return this.statsService.getServiceStats(query);
  }


  @Get('cycles')
  @ApiOperation({
    summary: 'Thống kê chu kỳ kinh nguyệt',
    description: `
Trả về thống kê độ dài chu kỳ, thời kỳ kinh nguyệt, số chu kỳ bất thường, và triệu chứng phổ biến. Hỗ trợ lọc theo ngày.
- Tổng số (total) hỗ trợ tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  async getCycleStats(@Query() query: StatsQueryDto) {
    return this.statsService.getCycleStats(query);
  }

  @Get('users')
  @ApiOperation({
    summary: 'Thống kê người dùng',
    description: `
Trả về thống kê người dùng theo vai trò, trạng thái hoạt động, và thời gian đăng ký. Hỗ trợ lọc theo ngày, vai trò, và trạng thái.
- Tổng số (total) dùng để tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'role', required: false, type: String, description: 'Vai trò người dùng' })
  @ApiQuery({ name: 'isActive', required: false, enum: ['true', 'false'], description: 'Trạng thái hoạt động' })
  async getUserStats(@Query() query: StatsQueryDto) {
    return this.statsService.getUserStats(query);
  }

  @Get('questions')
  @ApiOperation({
    summary: 'Thống kê câu hỏi',
    description: `
Trả về thống kê câu hỏi theo trạng thái, danh mục, và tư vấn viên. Hỗ trợ lọc theo ngày, danh mục, và ID tư vấn viên.
- Tổng số (total) hỗ trợ tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Danh mục câu hỏi' })
  @ApiQuery({ name: 'consultantId', required: false, type: String, description: 'ID tư vấn viên' })
  async getQuestionStats(@Query() query: StatsQueryDto) {
    return this.statsService.getQuestionStats(query);
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Thống kê doanh thu',
    description: `
Trả về thống kê doanh thu theo dịch vụ, thời gian, và phương thức thanh toán. Hỗ trợ lọc theo ngày, ID dịch vụ, và phương thức.
- Tổng số (total) là tổng doanh thu, dùng để tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'serviceId', required: false, type: String, description: 'ID dịch vụ' })
  @ApiQuery({ name: 'paymentMethod', required: false, type: String, description: 'Phương thức thanh toán' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'month', 'quarter', 'year'], description: 'Nhóm theo ngày/tháng/quý/năm' })
  async getRevenueStats(@Query() query: StatsQueryDto) {
    return this.statsService.getRevenueStats(query);
  }

  @Get('customers/service-usage')
  @ApiOperation({
    summary: 'Thống kê khách hàng sử dụng dịch vụ',
    description: `
Trả về thống kê số lượng khách hàng duy nhất sử dụng dịch vụ theo danh mục, dịch vụ, và thời gian. Hỗ trợ lọc theo ngày, danh mục, và ID dịch vụ.
- Tổng số (total) là số khách hàng duy nhất, dùng để tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'serviceId', required: false, type: String, description: 'ID dịch vụ' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Danh mục dịch vụ' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'month', 'quarter', 'year'], description: 'Nhóm theo ngày/tháng/quý/năm' })
  async getCustomerServiceUsage(@Query() query: StatsQueryDto) {
    return this.statsService.getCustomerServiceUsage(query);
  }
}