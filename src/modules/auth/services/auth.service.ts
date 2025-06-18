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
  ) {}

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
      await this.prisma.user.update({
        where: { user_id: user.user_id },
        data: { full_name: name },
      });
    }

    return this.generateTokens(user);
  }

  async loginLocal(user: { user_id: string; email: string; role: string }) {
    return this.generateTokens(user);
  }

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

  private async generateTokens(user: any) {
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      isVerified: user.is_verified,
      isActive: user.is_active,
      
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '2h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    //console.log('Generated accessToken with expiresIn: 2h', accessToken); // Thêm log

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
  const exists = await this.prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new BadRequestException('Email already in use');
  }

  const hash = await bcrypt.hash(password, 10);

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

  // Tạo CustomerProfile mặc định
  await this.prisma.customerProfile.create({
    data: {
      user_id: user.user_id,
      gender: null,
      medical_history: '',
      privacy_settings: 'PRIVATE',
    },
  });

  return user;
}

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { user_id: userId },
      data: { password_hash: hash },
    });
  }

  async getCustomerProfile(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { user_id: userId },
    });
    return profile;
  }

  async upsertCustomerProfile(userId: string, dto: UpdateCustomerProfileDto) {
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

  async getConsultantProfile(userId: string) {
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { user_id: userId },
    });
    return profile;
  }

  async upsertConsultantProfile(userId: string, dto: UpdateConsultantProfileDto) {
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