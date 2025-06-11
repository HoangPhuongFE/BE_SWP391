import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = 'a123456';
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

  // Danh sách các users cần seed
  const usersToSeed = [
    {
      email: 'guest@gmail.com',
      role: 'Guest',
      full_name: 'Guest User',
      phone_number: '0900000000',
    },
    {
      email: 'customer@gmail.com',
      role: 'Customer',
      full_name: 'John Customer',
      phone_number: '0900000001',
      customerProfile: {
        date_of_birth: new Date('1995-05-10'),
        gender: Gender.Male,
        medical_history: 'No known allergies',
        privacy_settings: {},
      },
    },
    {
      email: 'consultant@gmail.com',
      role: 'Consultant',
      full_name: 'Jane Consultant',
      phone_number: '0900000002',
      consultantProfile: {
        qualifications: 'MD, PhD',
        experience: '5 years experience',
        specialization: 'Gynecology',
        is_verified: true,
        average_rating: 4.8,
      },
    },
    {
      email: 'staff@gmail.com',
      role: 'Staff',
      full_name: 'Staff Member',
      phone_number: '0900000003',
    },
    {
      email: 'manager@gmail.com',
      role: 'Manager',
      full_name: 'Manager User',
      phone_number: '0900000004',
    },
    {
      email: 'admin@gmail.com',
      role: 'Admin',
      full_name: 'Admin User',
      phone_number: '0900000005',
    },
  ];

  for (const user of usersToSeed) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        password_hash: hashedPassword,
        role: user.role as any, // cast nhẹ vì type của prisma enum
        full_name: user.full_name,
        phone_number: user.phone_number,
        address: `${user.role} Address`,
        is_verified: true,
        ...(user.customerProfile && {
          customer: { create: user.customerProfile },
        }),
        ...(user.consultantProfile && {
          consultant: { create: user.consultantProfile },
        }),
      },
    });
  }

  console.log(' All roles seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
