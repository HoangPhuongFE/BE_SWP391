import { PrismaClient, Role, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const coreRoles = ['Admin', 'Manager', 'Staff'];
const consultantEmails = Array.from({ length: 5 }, (_, i) => `consultant${i + 1}@gmail.com`);
const customerEmails = [
  'customer1@gmail.com', 'zonduyen25@gmail.com', 'hoangnpse161446@fpt.edu.vn',
  'hoang093898xxx@gmail.com', 'hoamgnguyen8@gmail.com', 'anhphi@gmail.com',
  'thaikhoa@gmail.com', 'quanghuy@gmail.com', 'phuonghoang@gmail.com'
];

async function main() {
  const defaultPassword = 'a123456';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Core roles: Admin / Manager / Staff
  for (const role of coreRoles) {
    const email = `${role.toLowerCase()}@gmail.com`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        role: role as Role,
        full_name: `${role} User`,
        phone_number: '0901234567',
        address: '123 Đường ABC, TP.HCM',
        is_verified: true,
        is_active: true,
      },
    });
  }

  // Consultants + ConsultantProfile
  for (const email of consultantEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        role: Role.Consultant,
        full_name: email.split('@')[0],
        phone_number: '0901234' + Math.floor(1000 + Math.random() * 9000),
        address: '456 Đường XYZ, Hà Nội',
        is_verified: true,
        is_active: true,
      },
    });

    const existingProfile = await prisma.consultantProfile.findUnique({
      where: { user_id: user.user_id },
    });

    if (!existingProfile) {
      await prisma.consultantProfile.create({
        data: {
          user_id: user.user_id,
          qualifications: 'Bác sĩ chuyên khoa',
          experience: `${Math.floor(Math.random() * 10 + 1)} năm`,
          specialization: 'Gynecology',
          is_verified: true,
          average_rating: 4.5,
        },
      });
    }
  }

  // Customers + CustomerProfile
  for (const email of customerEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        role: Role.Customer,
        full_name: email.split('@')[0],
        phone_number: '0905678' + Math.floor(1000 + Math.random() * 9000),
        address: '789 Đường DEF, Đà Nẵng',
        is_verified: true,
        is_active: true,
      },
    });

    const existingCustomerProfile = await prisma.customerProfile.findUnique({
      where: { user_id: user.user_id },
    });

    if (!existingCustomerProfile) {
      await prisma.customerProfile.create({
        data: {
          user_id: user.user_id,
          date_of_birth: new Date('1995-01-01'),
          gender: Gender.Female,
          medical_history: 'Không có tiền sử bệnh.',
          privacy_settings: {}, // mặc định
        },
      });
    }
  }

  console.log('chạy được rồi nè');
}

main()
  .catch((e) => {
    console.error(' Lỗi khi seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
