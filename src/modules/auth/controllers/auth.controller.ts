import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
  BadRequestException,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dtos/login.dto';
import { SignupDto } from '../dtos/signup.dto';
import { SetPasswordDto } from '../dtos/set-password.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { ForgotPasswordSendOtpDto } from '../dtos/forgot-password-send-otp.dto';
import { ResetPasswordWithOtpDto } from '../dtos/reset-password-with-otp.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ChangeRoleDto } from '../dtos/change-role.dto';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from '../guards/roles.guard';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { SendOtpDto } from '../dtos/send-otp.dto';
@ApiTags('Auth (quản lý người dùng)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // ————— Google OAuth —————

  @Get('google')
  @ApiOperation({ summary: 'Chuyển hướng người dùng đến màn hình đồng ý Google OAuth' })
  @UseGuards(AuthGuard('google'))
  googleLogin() {
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
  @ApiOperation({ summary: 'Đăng ký người dùng mới bằng OTP' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'Người dùng đã được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Mã OTP không hợp lệ hoặc email đã tồn tại' })
  async signup(@Body() dto: SignupDto) {
    const user = await this.authService.registerWithOtp(
      dto.email,
      dto.password,
      dto.fullName,
      dto.otpCode,
    );
    return { message: 'Người dùng đăng kí thành công', userId: user.user_id };
  }


  @Post('change-password')
  @ApiOperation({ summary: 'Đổi mật khẩu cho người dùng đã đăng nhập' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Mật khẩu đã được thay đổi thành công' })
  @UseGuards(AuthGuard('jwt'))              
  async changePassword(
    @Req() req,
    @Body() dto: ChangePasswordDto,
  ) {
    // req.user là payload của JWT, trong đó có user_id
    const userId = (req.user as any).userId;
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return { message: 'Mật khẩu đã được thay đổi thành công' };
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Đăng xuất và xóa refresh token' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @UseGuards(AuthGuard('jwt'))
  async checkout(@Req() req: Request) {
    const userId = (req.user as any).sub;
    await this.authService.revokeRefreshToken(userId);
    return { message: 'Đăng xuất thành công' };
  }

  @Patch('change-role')
  @ApiOperation({ summary: 'Thay đổi vai trò người dùng (dành cho Manager)' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: ChangeRoleDto })
  @ApiResponse({ status: 200, description: 'Vai trò đã được thay đổi thành công' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Manager , Role.Admin) 
  async changeRole(@Req() req: Request & { user?: JwtPayload }, @Body() dto: ChangeRoleDto) {
    console.log('AuthController - req.user:', req.user);
    const managerId = req.user?.sub;
    if (!managerId) {
      throw new BadRequestException('Không tìm thấy ID quản lý trong token');
    }
    await this.authService.changeUserRole(managerId, dto.userId, dto.newRole);
    return { message: 'Vai trò đã được thay đổi thành công' };
  }

  @Post('signup/send-otp')
  @ApiOperation({ summary: 'Gửi mã OTP xác thực tới email người dùng' })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({ status: 200, description: 'OTP đã được gửi' })
  @ApiResponse({ status: 400, description: 'Email đã được sử dụng' })
  async sendOtp(@Body() dto: SendOtpDto) {
    const exists = await this.authService.isEmailTaken(dto.email);
    if (exists) throw new BadRequestException('Email đã được sử dụng');

    await this.authService.sendOtp(dto.email);
    return { message: 'Mã OTP đã được gửi đến email của bạn' };
  }
  @Post('forgot-password/send-otp')
  @ApiOperation({ summary: 'Gửi mã OTP để reset mật khẩu' })
  @ApiBody({ type: ForgotPasswordSendOtpDto })
  @ApiResponse({ status: 200, description: 'Đã gửi OTP' })
  @ApiResponse({ status: 400, description: 'Email không tồn tại' })
  async sendForgotPasswordOtp(@Body() dto: ForgotPasswordSendOtpDto) {
    const exists = await this.authService.isEmailTaken(dto.email);
    if (!exists) throw new BadRequestException('Email chưa được đăng ký');
    await this.authService.sendOtp(dto.email);
    return { message: 'Mã OTP đã được gửi đến email của bạn' };
  }

  @Post('forgot-password/reset')
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng mã OTP' })
  @ApiBody({ type: ResetPasswordWithOtpDto })
  @ApiResponse({ status: 200, description: 'Đã đổi mật khẩu' })
  @ApiResponse({ status: 400, description: 'OTP sai hoặc email không hợp lệ' })
  async resetPassword(@Body() dto: ResetPasswordWithOtpDto) {
    await this.authService.resetPasswordWithOtp(dto.email, dto.otpCode, dto.newPassword);
    return { message: 'Mật khẩu đã được đặt lại thành công' };
  }
  @Get('users')
  @ApiOperation({ summary: 'Lấy danh sách toàn bộ người dùng (với hồ sơ nếu có)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Manager, Role.Admin)
  async getAllUsers() {
    return this.authService.getAllUsersWithProfiles();
  }

}

