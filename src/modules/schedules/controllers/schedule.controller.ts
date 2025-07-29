import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ScheduleService } from '../services/schedule.service';
import { CreateScheduleDto } from '../dtos/create-schedule.dto';
import { UpdateScheduleDto } from '../dtos/update-schedule.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { BatchCreateScheduleDto } from '../dtos/batch-create-schedule.dto';

@ApiTags('Schedules')
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) { }

  /**
   * Consultant tạo lịch trống mới.
   * - FE cần: Form nhập thông tin lịch (start_time, end_time, service_id).
   * - Kiểm tra: Thời gian hợp lệ, không trùng lịch hẹn/lịch trống, dịch vụ là Consultation, lịch không quá 2 giờ.
   * - Gửi POST request với body theo CreateScheduleDto.
   * - Trả về: Lịch trống vừa tạo (JSON).
   */
  @Post()
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Consultant tạo lịch trống',
    description: 'Consultant tạo lịch trống với thời gian và dịch vụ. Thời gian phải trong tương lai, không trùng, tối đa 2 giờ, trong 2 tháng, không trước năm sau. Trả về lịch và thông tin dịch vụ.',
  })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateScheduleDto })
  async createSchedule(@Body() dto: CreateScheduleDto, @Req() req) {
    const userId = req.user.userId;
    const consultant = await this.scheduleService.getConsultantProfile(userId);
    if (!consultant) throw new BadRequestException('Không tìm thấy hồ sơ Consultant');
    return this.scheduleService.createSchedule(consultant.consultant_id, dto);
  }

  /**
   * Consultant xem tất cả lịch trống của mình.
   * - FE cần: Giao diện danh sách lịch trống của Consultant đang đăng nhập.
   * - Gửi GET request.
   * - Trả về: Danh sách lịch trống (JSON array, bao gồm tên dịch vụ).
   */
  @Get()
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Consultant xem lịch trống của mình',
    description: 'Trả về tất cả lịch trống của Consultant đang đăng nhập. FE hiển thị danh sách lịch.',
  })
  @ApiBearerAuth('access-token')
  async getAllSchedules(@Req() req) {
    const userId = req.user.userId;
    const consultant = await this.scheduleService.getConsultantProfile(userId);
    if (!consultant) throw new BadRequestException('Không tìm thấy hồ sơ Consultant');
    return this.scheduleService.getAllSchedules(consultant.consultant_id);
  }

  /**
   * Xem chi tiết lịch trống.
   * - FE cần: Trang chi tiết lịch với scheduleId.
   * - Consultant chỉ xem lịch của mình, Manager xem được tất cả.
   * - Gửi GET request với scheduleId trong URL.
   * - Trả về: Chi tiết lịch trống (JSON, bao gồm tên dịch vụ).
   */
  @Get(':scheduleId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Xem chi tiết lịch trống',
    description: 'Consultant xem lịch của mình, Manager xem được tất cả. Trả về chi tiết lịch với scheduleId. FE hiển thị thông tin lịch.',
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'scheduleId', description: 'ID lịch trống' })
  async getScheduleById(@Param('scheduleId') scheduleId: string, @Req() req) {
    const userId = req.user.userId;
    const role = req.user.role;
    const schedule = await this.scheduleService.getScheduleWithConsultant(scheduleId);
    if (!schedule) throw new BadRequestException('Lịch không tồn tại');
    if (role === Role.Consultant) {
      const consultant = await this.scheduleService.getConsultantProfile(userId);
      if (!consultant || schedule.consultant_id !== consultant.consultant_id)
        throw new BadRequestException('Không có quyền xem lịch này');
    } else if (role !== Role.Manager) {
      throw new BadRequestException('Không có quyền xem lịch này');
    }
    return this.scheduleService.getScheduleById(scheduleId);
  }

  
  @Get('consultants/:consultantId')
  @Roles(Role.Manager, Role.Staff)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Manager và Staff xem lịch  của Consultant',
    description: 'Trả về tất cả lịch của Consultant. FE hiển thị danh sách lịch.',
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'consultantId', description: 'ID Consultant' })
  async getConsultantSchedules(@Param('consultantId') consultantId: string) {
    const consultant = await this.scheduleService.getConsultantProfileById(consultantId);
    if (!consultant) throw new BadRequestException('Không tìm thấy hồ sơ Consultant');
    return this.scheduleService.getAllSchedules(consultantId);
  }

  /**
   * Consultant cập nhật lịch trống.
   * - FE cần: Form chỉnh sửa lịch (start_time, end_time, service_id) với scheduleId.
   * - Kiểm tra: Consultant sở hữu lịch, thời gian hợp lệ, không trùng, dịch vụ là Consultation.
   * - Gửi PATCH request với body theo UpdateScheduleDto.
   * - Trả về: Lịch đã cập nhật (JSON).
   */
  @Patch(':scheduleId')
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Consultant cập nhật lịch trống',
    description: 'Consultant cập nhật lịch của mình. Thời gian phải hợp lệ, không trùng, tối đa 2 giờ. Trả về lịch đã cập nhật.',
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'scheduleId', description: 'ID lịch trống' })
  @ApiBody({ type: UpdateScheduleDto })
  async updateSchedule(@Param('scheduleId') scheduleId: string, @Body() dto: UpdateScheduleDto, @Req() req) {
    const userId = req.user.userId;
    const schedule = await this.scheduleService.getScheduleWithConsultant(scheduleId);
    if (!schedule) throw new BadRequestException('Lịch không tồn tại');
    const consultant = await this.scheduleService.getConsultantProfile(userId);
    if (!consultant || schedule.consultant_id !== consultant.consultant_id)
      throw new BadRequestException('Không có quyền cập nhật lịch này');
    return this.scheduleService.updateSchedule(scheduleId, dto);
  }

  /**
   * Consultant xóa mềm lịch trống.
   * - FE cần: Button xác nhận xóa lịch với scheduleId.
   * - Kiểm tra: Consultant sở hữu lịch, lịch chưa được đặt.
   * - Gửi DELETE request với scheduleId trong URL.
   * - Trả về: Lịch đã xóa mềm (JSON, có deleted_at).
   */
  @Delete(':scheduleId')
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Tư vấn viên xóa mềm lịch trống',
    description: 'Tư vấn viên xóa lịch của mình nếu chưa được đặt. Trả về lịch đã xóa mềm. FE hiển thị xác nhận xóa.',
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'scheduleId', description: 'ID lịch trống' })
  async deleteSchedule(@Param('scheduleId') scheduleId: string, @Req() req) {
    const userId = req.user.userId;
    const schedule = await this.scheduleService.getScheduleWithConsultant(scheduleId);
    if (!schedule) throw new BadRequestException('Lịch không tồn tại');
    const consultant = await this.scheduleService.getConsultantProfile(userId);
    if (!consultant || schedule.consultant_id !== consultant.consultant_id)
      throw new BadRequestException('Không có quyền xóa lịch này');
    return this.scheduleService.deleteSchedule(scheduleId, userId, req.user.role);
  }

  /**
   * Consultant tạo hàng loạt lịch trống.
   * - FE cần: Form nhập khoảng thời gian (start_time, end_time), duration_minutes, service_id.
   * - Kiểm tra: Thời gian hợp lệ, không trùng, dịch vụ là Consultation, tạo lịch theo khoảng thời gian.
   * - Gửi POST request với body theo BatchCreateScheduleDto.
   * - Trả về: Số lịch tạo thành công và danh sách lịch (JSON).
   */
  @Post('batch')
  @Roles(Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Tư vấn viên tạo nhiều lịch trống',
    description: 'Tạo hàng loạt lịch trống trong khoảng thời gian (2 tháng, không trước năm sau) với độ dài mỗi slot 15-120 phút. Trả về số lịch tạo, danh sách lịch, và thông tin dịch vụ.',
  })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: BatchCreateScheduleDto })
  async batchCreate(@Body() dto: BatchCreateScheduleDto, @Req() req) {
    const userId = req.user.userId;
    const consultant = await this.scheduleService.getConsultantProfile(userId);
    if (!consultant) throw new BadRequestException('Không tìm thấy hồ sơ Consultant');
    return this.scheduleService.batchCreateSchedules(consultant.consultant_id, dto);
  }
}