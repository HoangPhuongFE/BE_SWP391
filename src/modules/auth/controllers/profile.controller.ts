import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { UpdateCustomerProfileDto } from '../dtos/update-customer-profile.dto';
import { UpdateConsultantProfileDto } from '../dtos/update-consultant-profile.dto';
import { AuthService } from '../services/auth.service';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from '../guards/roles.guard';
import { Public } from '../decorators/public.decorator';

@ApiTags('Profile')
@Controller('auth/profile')
export class ProfileController {
  constructor(private readonly authService: AuthService) {}

  @Get('customer')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Customer)
  @ApiOperation({ summary: 'Lấy CustomerProfile của chính bạn' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'CustomerProfile' })
  async getCustomerProfile(@Req() req) {
    console.log('ProfileController - req.user:', req.user);
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Không thể xác định userId');
    const profile = await this.authService.getCustomerProfile(userId);
    if (!profile) throw new NotFoundException('Chưa có CustomerProfile');
    return profile;
  }

  @Patch('customer')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Customer)
  @ApiOperation({ summary: 'Tạo hoặc cập nhật CustomerProfile' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateCustomerProfileDto })
  @ApiResponse({ status: 200, description: 'CustomerProfile sau khi cập nhật' })
  async updateCustomerProfile(@Req() req, @Body() dto: UpdateCustomerProfileDto) {
    console.log('ProfileController - req.user:', req.user);
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Không thể xác định userId');
    return this.authService.upsertCustomerProfile(userId, dto);
  }

  @Get('consultant')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Consultant)
  @ApiOperation({ summary: 'Lấy ConsultantProfile của chính bạn' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'ConsultantProfile' })
  async getConsultantProfile(@Req() req) {
    console.log('ProfileController - req.user:', req.user);
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Không thể xác định userId');
    const profile = await this.authService.getConsultantProfile(userId);
    if (!profile) throw new NotFoundException('Chưa có ConsultantProfile');
    return profile;
  }

  @Patch('consultant')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Consultant)
  @ApiOperation({ summary: 'Tạo hoặc cập nhật ConsultantProfile' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateConsultantProfileDto })
  @ApiResponse({ status: 200, description: 'ConsultantProfile sau khi cập nhật' })
  async updateConsultantProfile(@Req() req, @Body() dto: UpdateConsultantProfileDto) {
    console.log('ProfileController - req.user:', req.user);
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Không thể xác định userId');
    return this.authService.upsertConsultantProfile(userId, dto);
  }

   @Get('customers/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Manager, Role.Staff, Role.Customer, Role.Consultant , Role.Admin)
  @ApiOperation({ summary: 'Lấy tất cả CustomerProfile' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Danh sách tất cả CustomerProfile' })
  async getAllCustomerProfiles() {
    return this.authService.getAllCustomerProfiles();
  }

  @Get('consultants/all')
  @Public()
  @ApiOperation({ summary: 'Lấy tất cả ConsultantProfile' })
  @ApiResponse({ status: 200, description: 'Danh sách tất cả ConsultantProfile' })
  async getAllConsultantProfiles() {
    return this.authService.getAllConsultantProfiles();
  }
}