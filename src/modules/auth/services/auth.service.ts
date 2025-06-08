import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateCustomerProfileDto } from '../dtos/update-customer-profile.dto';
import { UpdateConsultantProfileDto } from '../dtos/update-consultant-profile.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) { }

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
  async register(email: string, password: string, fullName: string) {
    // Kiểm tra email đã tồn tại chưa
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new BadRequestException('Email already in use');
    }

    // Hash mật khẩu
    const hash = await bcrypt.hash(password, 10);

    // Tạo user mới
    const user = await this.prisma.user.create({
      data: {
        email,
        password_hash: hash,
        full_name: fullName,
        role: 'Customer',
        is_verified: false,
        is_active: true,
      },
    });

    // (Optionally) tự login ngay sau signup:
    // return this.loginLocal(user);

    return user;
  }
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Lấy user
    const user = await this.prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');

    // Kiểm tra mật khẩu hiện tại
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');

    // Hash mật khẩu mới và cập nhật
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { user_id: userId },
      data: { password_hash: hash },
    });
  }
  /** Lấy CustomerProfile theo userId */
  async getCustomerProfile(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { user_id: userId },
    });
    return profile;
  }
  async upsertCustomerProfile(
    userId: string,
    dto: UpdateCustomerProfileDto,
  ) {
    return this.prisma.customerProfile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        date_of_birth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        medical_history: dto.medicalHistory,
        privacy_settings: dto.privacySettings ?? undefined,
      },
      update: {
        ...(dto.dateOfBirth !== undefined && { date_of_birth: new Date(dto.dateOfBirth) }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.medicalHistory !== undefined && { medical_history: dto.medicalHistory }),
        ...(dto.privacySettings !== undefined && { privacy_settings: dto.privacySettings }),
      },
    });
  }
  /** Lấy ConsultantProfile theo userId */
  async getConsultantProfile(userId: string) {
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { user_id: userId },
    });
    return profile;
  }
  /** Upsert ConsultantProfile (1-1) */
  async upsertConsultantProfile(
    userId: string,
    dto: UpdateConsultantProfileDto,
  ) {
    return this.prisma.consultantProfile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        qualifications: dto.qualifications,
        experience: dto.experience,
        specialization: dto.specialization,
      },
      update: {
        ...(dto.qualifications !== undefined && { qualifications: dto.qualifications }),
        ...(dto.experience !== undefined && { experience: dto.experience }),
        ...(dto.specialization !== undefined && { specialization: dto.specialization }),
      },
    });
  }
}