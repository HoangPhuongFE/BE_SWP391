import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // OAuth login handler
  async handleOAuthLogin(userData: {
    provider: string;
    providerId: string;
    email: string;
    name?: string;
    picture?: string;
  }) {
    const { email, name } = userData;
    if (!email) throw new BadRequestException('Email is required');

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          full_name: name,
          role: 'Customer',
          password_hash: '',
          is_verified: true,
          is_active: true,
        },
      });
    } else {
      // Update profile if desired, keep existing password_hash
      await this.prisma.user.update({
        where: { user_id: user.user_id },
        data: { full_name: name },
      });
    }

    return this.generateTokens(user);
  }

  // Local login JWT generation
  async loginLocal(user: { user_id: string; email: string; role: string }) {
    return this.generateTokens(user);
  }

  // Validate email/password
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.password_hash) {
      throw new UnauthorizedException('Please set a password first');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  // Set or reset password (only if not set)
  async setPassword(email: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.password_hash) {
      throw new BadRequestException('Password already set');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { email },
      data: { password_hash: hash },
    });
  }

  // Internal helper: generate access & refresh tokens, persist refresh
  private async generateTokens(user: any) {
    const payload = { sub: user.user_id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.prisma.token.create({
      data: {
        user_id: user.user_id,
        refresh_token_hash: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_revoked: false,
      },
    });

    return { accessToken, refreshToken, user };
  }
}