// src/modules/auth/controllers/profile.controller.ts
import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard }        from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';

import { UpdateCustomerProfileDto }    from '../dtos/update-customer-profile.dto';
import { UpdateConsultantProfileDto }  from '../dtos/update-consultant-profile.dto';
import { AuthService }                 from '../services/auth.service';

import { Roles }  from '../decorators/roles.decorator';
import { Role   } from '@prisma/client';    // enum Role
import { RolesGuard } from '../guards/roles.guard';

@ApiTags('Profile')
@UseGuards(AuthGuard('jwt'), RolesGuard)   // JWT + Role-check
@Controller('auth/profile')
export class ProfileController {
  constructor(private readonly authService: AuthService) {}

  // --- CustomerProfile ---

  @Get('customer')
  @Roles(Role.Customer, Role.Admin)         // chỉ Customer và Admin được phép
  @ApiOperation({ summary: 'Lấy CustomerProfile của chính bạn' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'CustomerProfile' })
  async getCustomerProfile(@Req() req) {
    const userId = (req.user as any).userId; 
    const profile = await this.authService.getCustomerProfile(userId);
    if (!profile) throw new NotFoundException('Chưa có CustomerProfile');
    return profile;
  }

  @Patch('customer')
  @Roles(Role.Customer, Role.Admin) // chỉ Customer và Admin được phép
  @ApiOperation({ summary: 'Tạo hoặc cập nhật CustomerProfile' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateCustomerProfileDto })
  @ApiResponse({ status: 200, description: 'CustomerProfile sau khi cập nhật' })
  async updateCustomerProfile(
    @Req() req,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    const userId = (req.user as any).userId;
    return this.authService.upsertCustomerProfile(userId, dto);
  }

  // --- ConsultantProfile ---

  @Get('consultant')
  @Roles(Role.Consultant, Role.Admin)       // chỉ Consultant và Admin được phép
  @ApiOperation({ summary: 'Lấy ConsultantProfile của chính bạn' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'ConsultantProfile' })
  async getConsultantProfile(@Req() req) {
    const userId = (req.user as any).userId;
    const profile = await this.authService.getConsultantProfile(userId);
    if (!profile) throw new NotFoundException('Chưa có ConsultantProfile');
    return profile;
  }

  @Patch('consultant')
  @Roles(Role.Consultant, Role.Admin) // chỉ Consultant và Admin được phép
  @ApiOperation({ summary: 'Tạo hoặc cập nhật ConsultantProfile' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateConsultantProfileDto })
  @ApiResponse({ status: 200, description: 'ConsultantProfile sau khi cập nhật' })
  async updateConsultantProfile(
    @Req() req,
    @Body() dto: UpdateConsultantProfileDto,
  ) {
    const userId = (req.user as any).userId;
    return this.authService.upsertConsultantProfile(userId, dto);
  }
}
