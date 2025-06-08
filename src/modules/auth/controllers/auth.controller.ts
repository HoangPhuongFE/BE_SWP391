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
import { SetPasswordDto } from '../dtos/set-password.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ————— Google OAuth —————

  @Get('google')
  @ApiOperation({ summary: 'Redirect user to Google OAuth consent screen' })
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
      throw new BadRequestException('Email not provided by Google');
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
  @ApiOperation({ summary: 'Local login with email & password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Returns access & refresh tokens' })
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
}
