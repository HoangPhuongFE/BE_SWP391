import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { UpdateCustomerProfileDto } from '../dtos/update-customer-profile.dto';
import { UpdateConsultantProfileDto } from '../dtos/update-consultant-profile.dto';
import { AuthService } from '../services/auth.service';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from '../guards/roles.guard';
import { Public } from '../decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Profile')
@Controller('auth/profile')
export class ProfileController {
  constructor(private readonly authService: AuthService) { }

  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Customer, Role.Consultant, Role.Manager, Role.Staff, Role.Admin)
  @ApiOperation({ summary: 'Lấy thông tin của chính bạn' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Thông tin người dùng' })
  async getCustomerProfile(@Req() req) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Không thể xác định userId');
    const profile = await this.authService.getCustomerProfile(userId);
    if (!profile) throw new NotFoundException('Chưa có thông tin người dùng');
    return profile;
  }


  
  @Patch('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Customer, Role.Consultant, Role.Manager, Role.Staff, Role.Admin)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Cập nhật thông tin của chính bạn' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateCustomerProfileDto })
  @ApiResponse({ status: 200, description: 'Thông tin người dùng sau khi cập nhật' })
  async updateCustomerProfile(
    @Req() req,
    @Body() dto: UpdateCustomerProfileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Không thể xác định người dùng');
    return this.authService.upsertCustomerProfile(userId, dto, file);
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
  @ApiOperation({ summary: 'Tạo hoặc cập nhật thông tin tư vấn viên' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateConsultantProfileDto })
  @ApiResponse({ status: 200, description: 'Thông tin tư vấn viên sau khi cập nhật' })
  async updateConsultantProfile(@Req() req, @Body() dto: UpdateConsultantProfileDto) {
    console.log('ProfileController - req.user:', req.user);
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Không thể xác định người dùng');
    return this.authService.upsertConsultantProfile(userId, dto);
  }

  @Get('me/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Manager, Role.Staff, Role.Customer, Role.Consultant, Role.Admin)
  @ApiOperation({ summary: 'Lấy tất cả thông tin người dùng' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Danh sách tất cả thông tin người dùng' })
  async getAllCustomerProfiles() {
    return this.authService.getAllCustomerProfiles();
  }

  @Get('consultants/all')
  @Public()
  @ApiOperation({ summary: 'Lấy tất cả thông tin tư vấn viên' })
  @ApiResponse({ status: 200, description: 'Danh sách tất cả thông tin tư vấn viên' })
  async getAllConsultantProfiles() {
    return this.authService.getAllConsultantProfiles();
  }
}