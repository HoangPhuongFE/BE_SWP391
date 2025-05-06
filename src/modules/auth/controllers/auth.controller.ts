import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Redirects to Google OAuth
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user as {
      providerId: string;
      provider: string;
      email?: string;
      name?: string;
      picture?: string;
    };
  
    const result = await this.authService.handleOAuthLogin(user, 'google');
  
    const frontendUrl =
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL_PROD
        : process.env.FRONTEND_URL_LOCAL;
  
    const redirectUrl = `${frontendUrl}/login-success?token=${result.accessToken}&refresh=${result.refreshToken}`;
    return res.redirect(redirectUrl);
  }
  

@Get('facebook')
@UseGuards(AuthGuard('facebook'))
facebookLogin() {}

@Get('facebook/redirect')
@UseGuards(AuthGuard('facebook'))
async facebookRedirect(@Req() req: Request, @Res() res: Response) {
  const user = req.user as {
    providerId: string;
    provider: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  const result = await this.authService.handleOAuthLogin(user, 'facebook');

  const frontendUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL_PROD
      : process.env.FRONTEND_URL_LOCAL;

  const redirectUrl = `${frontendUrl}/login-success?token=${result.accessToken}&refresh=${result.refreshToken}`;
  return res.redirect(redirectUrl);
}

}
