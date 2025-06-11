// src/modules/auth/controllers/auth.controller.ts
import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dtos/login.dto';
import { SignupDto } from '../dtos/signup.dto';
import { SetPasswordDto } from '../dtos/set-password.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';

import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth
} from '@nestjs/swagger';

@ApiTags('Auth (quản lý người dùng)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ————— Google OAuth —————

  @Get('google')
  @ApiOperation({ summary: 'Chuyển hướng người dùng đến màn hình đồng ý Google OAuth' })
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport sẽ tự redirect
  }

  @Get('google/redirect')
  @ApiOperation({ summary: 'Google OAuth callback endpoint' })
  @UseGuards(AuthGuard('google'))
  async googleRedirect(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as {
      provider: string;
      providerId: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!oauthUser.email) {
      throw new BadRequestException('Email không được cung cấp bởi Google');
    }

    const result = await this.authService.handleOAuthLogin({
      provider: oauthUser.provider,
      providerId: oauthUser.providerId,
      email: oauthUser.email,
      name: oauthUser.name,
      picture: oauthUser.picture,
    });

    const frontendUrl =
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL_PROD
        : process.env.FRONTEND_URL_LOCAL;

    const redirectUrl = `${frontendUrl}/login-success?token=${result.accessToken}&refresh=${result.refreshToken}`;
    return res.redirect(redirectUrl);
  }

  // ————— Local (email/password) login —————

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Trả về access & refresh tokens' })
  @UseGuards(AuthGuard('local'))
  async loginLocal(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ) {
    // LocalStrategy đã validate và gán req.user
    const user = req.user as any;
    const result = await this.authService.loginLocal(user);
    return result;
  }

  // ————— Set password for OAuth-only accounts —————

  @Post('set-password')
  @ApiOperation({
    summary: 'Set or initialize password for a Google-only account',
  })
  @ApiBody({ type: SetPasswordDto })
  @ApiResponse({ status: 201, description: 'Mật khẩu đã được thiết lập.' })
  async setPassword(@Body() dto: SetPasswordDto) {
    await this.authService.setPassword(dto.email, dto.newPassword);
    return { message: 'Mật khẩu đã được thiết lập.' };
  }

  
@Post('signup')
@ApiOperation({ summary: 'Đăng ký người dùng mới bằng email và mật khẩu' })
@ApiBody({ type: SignupDto })
@ApiResponse({ status: 201, description: 'Người dùng đã được tạo thành công' })
async signup(@Body() dto: SignupDto) {
  const user = await this.authService.register(dto.email, dto.password, dto.fullName);
  return { message: 'Người dùng đăng kí thành công', userId: user.user_id };
}

  @Post('change-password')
  @ApiOperation({ summary: 'Đổi mật khẩu cho người dùng đã đăng nhập' })
  @ApiBearerAuth('access-token')  
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Mật khẩu đã được thay đổi thành công' })
  @UseGuards(AuthGuard('jwt'))               // Đảm bảo user đã login và có JWT
  async changePassword(
    @Req() req,
    @Body() dto: ChangePasswordDto,
  ) {
    // req.user là payload của JWT, trong đó có user_id
  const userId = (req.user as any).userId;
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return { message: 'Mật khẩu đã được thay đổi thành công' };
  }

  
}

