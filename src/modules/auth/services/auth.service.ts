import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleOAuthLogin(
    userData: {
      providerId: string;
      provider: string;
      email?: string;
      name?: string;
      picture?: string;
    },
    provider: string,
  ) {
    const { providerId, email, name, picture } = userData;

    let user = await this.prisma.user.findFirst({
      where: {
        provider,
        providerId,
      },
    });

    // Nếu không có → fallback tìm theo email (nếu có)
    if (!user && email) {
      user = await this.prisma.user.findUnique({ where: { email } });
    }

    // Nếu vẫn không có thì tạo mới
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          avatar: picture,
          provider,
          providerId,
          role: 'student',
        },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // Lưu refresh token vào DB
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }
}
