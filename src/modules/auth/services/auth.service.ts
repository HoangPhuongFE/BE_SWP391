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
  const { email, name } = userData;

  if (!email) {
    throw new Error('Email is required for Google login');
  }

  // Tìm user theo email
  let user = await this.prisma.user.findUnique({ where: { email } });

  // Nếu không có, tạo mới với role enum Customer
  if (!user) {
    user = await this.prisma.user.create({
      data: {
        email,
        full_name: name,
        role: 'Customer', // Gán trực tiếp giá trị enum nếu role là enum
        password_hash: '',
        is_verified: true,
        is_active: true,
      },
    });
  }

  // Tạo payload cho JWT
  const payload = {
    sub: user.user_id,
    email: user.email,
    role: user.role,          // lấy trực tiếp từ enum
  };

  // Tạo access & refresh token
  const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
  const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

  // Lưu refresh token
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