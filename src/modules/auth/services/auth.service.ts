import { Injectable, BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateCustomerProfileDto } from '../dtos/update-customer-profile.dto';
import { UpdateConsultantProfileDto } from '../dtos/update-consultant-profile.dto';
import { EmailService } from '@/modules/email/email.service';
import { CloudinaryService } from 'nestjs-cloudinary';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { Readable } from 'stream';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }


  async handleOAuthLogin(userData: {
    provider: string;
    providerId: string;
    email: string;
    name?: string;
    picture?: string;
  }) {
    const { email, name } = userData;
    if (!email) throw new BadRequestException('Email là bắt buộc');

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
      throw new UnauthorizedException('Thông tin xác thực không hợp lệ');
    }
    if (!user.password_hash) {
      throw new UnauthorizedException('Vui lòng đặt mật khẩu trước');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw new UnauthorizedException('Thông tin xác thực không hợp lệ');
    }
    return user;
  }

  async setPassword(email: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    if (user.password_hash) {
      throw new BadRequestException('Mật khẩu đã được đặt');
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
      throw new BadRequestException('Email đã được sử dụng');
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

  async revokeRefreshToken(userId: string): Promise<void> {
    await this.prisma.token.updateMany({
      where: { user_id: userId, is_revoked: false },
      data: { is_revoked: true },
    });
  }

  async changeUserRole(managerId: string, userId: string, newRole: string): Promise<void> {
    if (!managerId) {
      throw new BadRequestException('ID quản lý không hợp lệ');
    }

    const manager = await this.prisma.user.findUnique({
      where: { user_id: managerId },
    });
    if (!manager || manager.role !== 'Manager' && manager.role !== 'Admin') {
      throw new ForbiddenException('Chỉ có Manager và Admin mới có quyền thay đổi vai trò');
    }

    const validRoles: Role[] = [Role.Customer, Role.Consultant, Role.Manager, Role.Staff, Role.Guest, Role.Admin];
    if (!validRoles.includes(newRole as Role)) {
      throw new BadRequestException('Vai trò không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
    });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    await this.prisma.user.update({
      where: { user_id: userId },
      data: { role: newRole as Role },
    });
  }
  async getCustomerProfile(userId: string) {
    // Lấy thông tin User trước để kiểm tra role
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        email: true,
        full_name: true,
        phone_number: true,
        address: true,
        image: true,
        role: true,
        is_verified: true,
        is_active: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Lấy CustomerProfile
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            full_name: true,
            phone_number: true,
            address: true,
            image: true,
            role: true,
            is_verified: true,
            is_active: true,
          },
        },
      },
    });

    // Lấy ConsultantProfile nếu user là Consultant
    let consultantProfile: {
      consultant_id: string;
      qualifications: string | null;
      experience: string | null;
      specialization: string | null;
      is_verified: boolean;
      average_rating: number | null;
      created_at: Date;
      updated_at: Date;
    } | null = null;
    if (user.role === 'Consultant') {
      consultantProfile = await this.prisma.consultantProfile.findUnique({
        where: { user_id: userId },
        select: {
          consultant_id: true,
          qualifications: true,
          experience: true,
          specialization: true,
          is_verified: true,
          average_rating: true,
          created_at: true,
          updated_at: true,
        },
      });
    }

    // Trả về dữ liệu kết hợp
    return {
      user,
      customerProfile: customerProfile || null,
      consultantProfile: consultantProfile || null,
    };
  }

  async upsertCustomerProfile(userId: string, dto: UpdateCustomerProfileDto, file?: Express.Multer.File) {
    let imageUrl: string | undefined;

    // Xử lý upload hình ảnh
    if (file) {
      try {
        const uploadResult = await this.cloudinaryService.uploadFile(file, {
          folder: 'profiles',
        });
        imageUrl = uploadResult.secure_url;
      } catch (error) {
        throw new BadRequestException('Lỗi khi upload hình ảnh: ' + error.message);
      }
    }

    // Cập nhật bảng User
    await this.prisma.user.update({
      where: { user_id: userId },
      data: {
        ...(imageUrl && { image: imageUrl }),
        ...(dto.fullName !== undefined && { full_name: dto.fullName }),
        ...(dto.phoneNumber !== undefined && { phone_number: dto.phoneNumber }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
    });

    // Cập nhật hoặc tạo mới CustomerProfile
    // Cập nhật hoặc tạo mới CustomerProfile, bao gồm dữ liệu User
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
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            full_name: true,
            phone_number: true,
            address: true,
            image: true,
            role: true,
            is_verified: true,
            is_active: true,
          },
        },
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

  async getAllCustomerProfiles() {
    return this.prisma.customerProfile.findMany({
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            full_name: true,
            role: true,
            image: true,
            phone_number: true,
            address: true,
            is_verified: true,
            is_active: true,
          },
        },
      },

    });
  }

  async getAllConsultantProfiles() {
    return this.prisma.user.findMany({
      where: { role: 'Consultant' }, // Adjust role value as needed
      include: {
        consultant: true, // Will be null if not exists
      },
    });
  }

  async sendOtp(email: string) {
    const code = randomInt(100000, 999999).toString(); // Tạo mã OTP 6 chữ số
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    await this.prisma.otpCode.create({
      data: { email, code, expiresAt },
    });

    await this.emailService.sendEmail(email, 'Mã OTP đăng ký', `Mã xác nhận: ${code}`);
  }

  async registerWithOtp(email: string, password: string, fullName: string, otpCode: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Email đã được sử dụng');

    const validOtp = await this.prisma.otpCode.findFirst({
      where: {
        email,
        code: otpCode,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!validOtp) throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');

    await this.prisma.otpCode.update({
      where: { id: validOtp.id },
      data: { isUsed: true },
    });

    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        password_hash: hash,
        full_name: fullName,
        role: 'Customer',
        is_verified: true,
        is_active: true,
      },
    });

    await this.prisma.customerProfile.create({
      data: {
        user_id: user.user_id,
        medical_history: '',
        privacy_settings: 'PRIVATE',
      },
    });

    return user;
  }
  async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return !!user;
  }
  async resetPasswordWithOtp(email: string, otpCode: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Email chưa được đăng ký');

    const validOtp = await this.prisma.otpCode.findFirst({
      where: {
        email,
        code: otpCode,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!validOtp) throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');

    await this.prisma.otpCode.update({
      where: { id: validOtp.id },
      data: { isUsed: true },
    });

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { email },
      data: { password_hash: hash },
    });
  }

  async getAllUsersWithProfiles() {
    const users = await this.prisma.user.findMany({
      include: {
        customer: true,
        consultant: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return users.map((user) => ({
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      phone_number: user.phone_number,
      address: user.address,

      role: user.role,
      is_verified: user.is_verified,
      is_active: user.is_active,
      created_at: user.created_at,
      customerProfile: user.customer ?? null,
      consultantProfile: user.consultant ?? null,
    }));
  }

  async deleteUser(managerId: string, userId: string): Promise<void> {
    // Kiểm tra quyền Manager hoặc Admin
    const manager = await this.prisma.user.findUnique({
      where: { user_id: managerId },
    });
    if (!manager || (manager.role !== Role.Manager && manager.role !== Role.Admin)) {
      throw new ForbiddenException('Chỉ có Manager hoặc Admin mới có quyền xóa người dùng');
    }

    // Kiểm tra người dùng tồn tại
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
    });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // Không cho phép tự xóa
    if (managerId === userId) {
      throw new BadRequestException('Không thể tự xóa tài khoản của chính bạn');
    }

    // Soft delete người dùng bằng cách cập nhật deleted_at
    await this.prisma.user.update({
      where: { user_id: userId },
      data: {
        deleted_at: new Date(),
        is_active: false, // Đánh dấu không hoạt động
      },
    });

    // Soft delete các bảng liên quan (nếu cần)
    // Ví dụ: CustomerProfile, ConsultantProfile
    await this.prisma.customerProfile.updateMany({
      where: { user_id: userId },
      data: { deleted_at: new Date() },
    });

    await this.prisma.consultantProfile.updateMany({
      where: { user_id: userId },
      data: { deleted_at: new Date() },
    });

    // Xóa hoặc đánh dấu các token liên quan
    await this.prisma.token.updateMany({
      where: { user_id: userId, is_revoked: false },
      data: { is_revoked: true },
    });

  }
}