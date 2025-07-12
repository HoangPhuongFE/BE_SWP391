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
Trả về thống kê lịch hẹn với dữ liệu thô (status, type, created_at). Hỗ trợ lọc theo ngày bắt đầu, ngày kết thúc, loại, và trạng thái.
- Tổng số (total) cho phép tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Loại lịch hẹn (Consultation/Testing)' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Trạng thái lịch hẹn' })
  async getAppointmentStats(@Query() query: StatsQueryDto) {
    return this.statsService.getAppointmentStats(query);
  }

  @Get('test-results')
  @ApiOperation({
    summary: 'Thống kê kết quả xét nghiệm',
    description: `
Trả về thống kê kết quả xét nghiệm với dữ liệu thô (is_abnormal, service_id, created_at). Hỗ trợ lọc theo ngày và danh mục.
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
Trả về thống kê sử dụng dịch vụ với dữ liệu thô (service_id, created_at). Hỗ trợ lọc theo ngày, danh mục, và ID dịch vụ.
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
Trả về thống kê chu kỳ với dữ liệu thô (start_date, cycle_length, period_length, symptoms). Hỗ trợ lọc theo ngày.
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
Trả về thống kê người dùng với dữ liệu thô (role, is_active, created_at). Hỗ trợ lọc theo ngày, vai trò, và trạng thái.
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
Trả về thống kê câu hỏi với dữ liệu thô (status, category, consultant_id, created_at). Hỗ trợ lọc theo ngày, danh mục, và ID tư vấn viên.
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
Trả về thống kê doanh thu với dữ liệu thô (amount, created_at, appointment_id). Hỗ trợ lọc theo ngày, ID dịch vụ, và phương thức.
- Tổng số (total) là tổng doanh thu, dùng để tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'serviceId', required: false, type: String, description: 'ID dịch vụ' })
  @ApiQuery({ name: 'paymentMethod', required: false, type: String, description: 'Phương thức thanh toán' })
  async getRevenueStats(@Query() query: StatsQueryDto) {
    return this.statsService.getRevenueStats(query);
  }

  @Get('customers/service-usage')
  @ApiOperation({
    summary: 'Thống kê khách hàng sử dụng dịch vụ',
    description: `
Trả về thống kê khách hàng với dữ liệu thô (user_id, service_id, created_at). Hỗ trợ lọc theo ngày, danh mục, và ID dịch vụ.
- Tổng số (total) là số khách hàng duy nhất, dùng để tính phần trăm trên FE.`,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiQuery({ name: 'serviceId', required: false, type: String, description: 'ID dịch vụ' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Danh mục dịch vụ' })
  async getCustomerServiceUsage(@Query() query: StatsQueryDto) {
    return this.statsService.getCustomerServiceUsage(query);
  }
}