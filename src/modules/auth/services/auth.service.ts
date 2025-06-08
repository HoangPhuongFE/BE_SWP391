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

    // Kiểm tra email có tồn tại không
    if (!email) {
      throw new Error('Email is required for Google login');
    }

    // Tìm vai trò Customer
    const customerRole = await this.prisma.role.findFirst({
      where: { name: 'Customer' },
    });

    if (!customerRole) {
      throw new Error('Customer role not found');
    }

    // Tìm người dùng theo email
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Nếu không có, tạo người dùng mới với vai trò Customer
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          full_name: name,
          role_id: customerRole.role_id,
          password_hash: '', // Để trống vì đăng nhập Google không cần mật khẩu
          is_verified: true, // Đánh dấu là đã xác thực
          is_active: true,
        },
      });
    }

    // Tạo payload cho JWT
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: customerRole.name, // Sử dụng tên vai trò Customer
    };

    // Tạo access token
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    // Tạo refresh token
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // Lưu refresh token vào bảng Token
    await this.prisma.token.create({
      data: {
        user_id: user.user_id,
        refresh_token_hash: refreshToken, // Lưu token trực tiếp (hoặc hash nếu cần bảo mật)
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
        is_revoked: false,
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }
}