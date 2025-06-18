import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Định nghĩa tạm thời nếu chưa generate
enum Role {
  Guest = 'Guest',
  Customer = 'Customer',
  Consultant = 'Consultant',
  Staff = 'Staff',
  Manager = 'Manager',
  Admin = 'Admin',
}

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = 'a123456';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Danh sách email cho các role
  const coreRoles = ['Admin', 'Manager', 'Staff'];
  const consultantEmails = Array.from({ length: 5 }, (_, i) => `consultant${i + 1}@gmail.com`);
  const customerEmails = [
    'customer1@gmail.com', 'zonduyen25@gmail.com', 'hoangnpse161446@fpt.edu.vn',
    'hoang093898xxx@gmail.com', 'hoamgnguyen8@gmail.com', 'anhphi@gmail.com',
    'thaikhoa@gmail.com', 'quanghuy@gmail.com', 'phuonghoang@gmail.com'
  ];

  // Tạo User cho các role core
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

  // Tạo User cho Consultant
  for (const email of consultantEmails) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        role: Role.Consultant,
        full_name: email.split('@')[0],
        phone_number: '090123456' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
        address: '456 Đường XYZ, Hà Nội',
        is_verified: true,
        is_active: true,
      },
    });
  }

  // Tạo User cho Customer
  for (const email of customerEmails) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        role: Role.Customer,
        full_name: email.split('@')[0],
        phone_number: '090123456' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
        address: '789 Đường DEF, Đà Nẵng',
        is_verified: true,
        is_active: true,
      },
    });
  }

  console.log("Seed completed with roles and basic user info only!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());