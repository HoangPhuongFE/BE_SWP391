import { PrismaClient, Role, Gender, AppointmentType, AppointmentStatus, PaymentStatus, TestResultStatus, FeedbackStatus, QuestionStatus, ServiceType, ServiceMode, ShippingStatus, PaymentMethod, PaymentTransactionStatus, NotificationType, NotificationStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const coreRoles = ['Admin', 'Manager', 'Staff'];
const consultantEmails = Array.from({ length: 8 }, (_, i) => `consultant${i + 1}@gmail.com`);
const customerEmails = [
  'customer1@gmail.com', 'zonduyen25@gmail.com', 'hoangnpse161446@fpt.edu.vn',
  'hoang093898xxx@gmail.com', 'hoamgnguyen8@gmail.com', 'anhphi@gmail.com',
  'thaikhoa0109@gmail.com', 'quanghuy@gmail.com', 'phuonghoang@gmail.com',
  'trangnguyen@gmail.com', 'minhvu@gmail.com', 'lananh@gmail.com'
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

  // System User (cố định)
  const systemUserId = '550e8400-e29b-41d4-a716-446655440000';
  await prisma.user.upsert({
    where: { user_id: systemUserId },
    update: {},
    create: {
      user_id: systemUserId,
      email: 'system@yourapp.com',
      password_hash: hashedPassword,
      role: Role.System,
      full_name: 'System User',
      phone_number: '0909999999',
      address: 'System Address, TP.HCM',
      is_verified: true,
      is_active: true,
    },
  });

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
        address: ['Hà Nội', 'TP.HCM', 'Đà Nẵng'][Math.floor(Math.random() * 3)],
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
          qualifications: ['Bác sĩ chuyên khoa', 'Thạc sĩ y học', 'Tiến sĩ y khoa'][Math.floor(Math.random() * 3)],
          experience: `${Math.floor(Math.random() * 15 + 1)} năm`,
          specialization: ['Gynecology', 'Fertility', 'General Medicine'][Math.floor(Math.random() * 3)],
          is_verified: true,
          average_rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
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
        address: ['789 Đường DEF, Đà Nẵng', '456 Đường XYZ, Hà Nội', '123 Đường GHI, TP.HCM'][Math.floor(Math.random() * 3)],
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
          date_of_birth: new Date(1985 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 12), 1),
          gender: [Gender.Female, Gender.Male, Gender.Other][Math.floor(Math.random() * 3)],
          medical_history: ['Không có', 'Tiểu đường', 'Cao huyết áp', 'Dị ứng'][Math.floor(Math.random() * 4)],
          privacy_settings: { showFullName: Math.random() > 0.5 },
        },
      });
    }
  }
  // Customers + CustomerProfile + MenstrualCycle
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
        address: ['789 Đường DEF, Đà Nẵng', '456 Đường XYZ, Hà Nội', '123 Đường GHI, TP.HCM'][Math.floor(Math.random() * 3)],
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
          date_of_birth: new Date(1985 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 12), 1),
          gender: [Gender.Female, Gender.Male, Gender.Other][Math.floor(Math.random() * 3)],
          medical_history: ['Không có', 'Tiểu đường', 'Cao huyết áp', 'Dị ứng'][Math.floor(Math.random() * 4)],
          privacy_settings: { showFullName: Math.random() > 0.5 },
        },
      });
    }

    // Customers + CustomerProfile + MenstrualCycle
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
          address: ['789 Đường DEF, Đà Nẵng', '456 Đường XYZ, Hà Nội', '123 Đường GHI, TP.HCM'][Math.floor(Math.random() * 3)],
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
            date_of_birth: new Date(1985 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 12), 1),
            gender: [Gender.Female, Gender.Male, Gender.Other][Math.floor(Math.random() * 3)],
            medical_history: ['Không có', 'Tiểu đường', 'Cao huyết áp', 'Dị ứng'][Math.floor(Math.random() * 4)],
            privacy_settings: { showFullName: Math.random() > 0.5 },
          },
        });
      }

      // MenstrualCycle (2-3 cycles for 1-2 female customers, 3-5 for others)
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { user_id: user.user_id },
      });

      if (customerProfile?.gender === Gender.Female) {
        // Chọn ngẫu nhiên 1-2 khách hàng nữ có 2-3 chu kỳ
        const femaleCustomers = await prisma.customerProfile.findMany({ where: { gender: Gender.Female } });
        const isLimitedCycleUser = femaleCustomers.length > 2 && Math.random() < 0.3; // ~1-2 khách hàng
        const numCycles = isLimitedCycleUser ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 3) + 3; // 2-3 hoặc 3-5 chu kỳ

        let currentDate = new Date(2025, 0, 1 + Math.floor(Math.random() * 15)); // Start from Jan 2025
        const now = new Date('2025-07-16'); // Current date for validation

        for (let j = 0; j < numCycles; j++) {
          // Ensure start_date is not in the future
          if (currentDate > now) {
            currentDate = new Date(now.getTime() - (Math.random() * 30 + 20) * 24 * 60 * 60 * 1000);
          }

          const cycleLength = Math.floor(Math.random() * 15) + 21; // 21-35 days
          const periodLength = Math.floor(Math.random() * 6) + 2; // 2-7 days
          const ovulationDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000); // Ovulation: start_date + 14 days
          const nextCycleStart = new Date(currentDate.getTime() + cycleLength * 24 * 60 * 60 * 1000);

          // Create MenstrualCycle
          const cycle = await prisma.menstrualCycle.create({
            data: {
              user_id: user.user_id,
              start_date: currentDate,
              is_predicted: Math.random() > 0.5,
              cycle_length: cycleLength,
              period_length: periodLength,
              symptoms: ['Đau bụng', 'Mệt mỏi', 'Đau lưng', 'Buồn nôn', 'Bình thường', 'Đau đầu', 'Khó chịu', null][Math.floor(Math.random() * 8)],
              notes: ['Chu kỳ đều', 'Cần kiểm tra bác sĩ', 'Triệu chứng bất thường', 'Theo dõi thêm', 'Kỳ ngắn hơn bình thường', null][Math.floor(Math.random() * 6)],
              ovulation_date: ovulationDate,
              pregnancy_probability: Math.random() > 0.6 ? parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)) : null,
            },
          });

          // Create notifications (synced with createNotifications in CycleService)
          const notifications = [
            {
              title: 'Chu kỳ sắp bắt đầu (48h)',
              content: 'Chu kỳ của bạn dự kiến bắt đầu sau 2 ngày.',
              sendAt: new Date(nextCycleStart.getTime() - 48 * 60 * 60 * 1000),
            },
            {
              title: 'Chu kỳ sắp bắt đầu (24h)',
              content: 'Chu kỳ của bạn dự kiến bắt đầu ngày mai.',
              sendAt: new Date(nextCycleStart.getTime() - 24 * 60 * 60 * 1000),
            },
            {
              title: 'Chu kỳ hôm nay',
              content: 'Hôm nay là ngày dự kiến bắt đầu chu kỳ, hãy ghi nhận.',
              sendAt: nextCycleStart,
            },
            {
              title: 'Ngày rụng trứng sắp đến',
              content: 'Ngày rụng trứng dự kiến sau 2 ngày.',
              sendAt: new Date(ovulationDate.getTime() - 48 * 60 * 60 * 1000),
            },
          ];

          for (const notif of notifications) {
            await prisma.notification.create({
              data: {
                user_id: user.user_id,
                type: NotificationType.Email,
                title: notif.title,
                content: notif.content,
                status: NotificationStatus.Pending,
                created_at: notif.sendAt,
              },
            });
          }

          // Move to next cycle start date (ensure at least 20 days apart)
          currentDate = new Date(currentDate.getTime() + Math.max(cycleLength, 20) * 24 * 60 * 60 * 1000);
        }
      }
    }
    // Services: 4 Testing + 3 Consultation
    const services = [
      {
        name: 'STI Testing - Basic',
        description: 'Xét nghiệm STI cơ bản (HIV, Syphilis)',
        price: 10000,
        category: 'STI',
        type: ServiceType.Testing,
        available_modes: [ServiceMode.AT_HOME, ServiceMode.AT_CLINIC],
        return_address: '123 Lab St, Hanoi',
        return_phone: '0901234567',
      },
      {
        name: 'STI Testing - Gold',
        description: 'Xét nghiệm STI nâng cao (HIV, Syphilis, Chlamydia)',
        price: 15000,
        category: 'STI',
        type: ServiceType.Testing,
        available_modes: [ServiceMode.AT_HOME, ServiceMode.AT_CLINIC],
        return_address: '456 Lab St, HCMC',
        return_phone: '0907654321',
      },
      {
        name: 'STI Testing - Premium',
        description: 'Xét nghiệm STI toàn diện (HIV, Syphilis, Chlamydia, HPV)',
        price: 20000,
        category: 'STI',
        type: ServiceType.Testing,
        available_modes: [ServiceMode.AT_CLINIC],
        return_address: '789 Lab St, Da Nang',
        return_phone: '0909876543',
      },
      {
        name: 'STI Testing - Platinum',
        description: 'Xét nghiệm STI cao cấp (HIV, Syphilis, Chlamydia, HPV, Herpes)',
        price: 25000,
        category: 'STI',
        type: ServiceType.Testing,
        available_modes: [ServiceMode.AT_HOME, ServiceMode.AT_CLINIC],
        return_address: '101 Lab St, Hanoi',
        return_phone: '0901112233',
      },
      {
        name: 'Gynecology Consultation',
        description: 'Tư vấn phụ khoa tổng quát',
        price: 10000,
        category: 'Gynecology',
        type: ServiceType.Consultation,
        available_modes: [ServiceMode.AT_HOME, ServiceMode.AT_CLINIC],
      },
      {
        name: 'Fertility Consultation',
        description: 'Tư vấn chuyên sâu về sinh sản',
        price: 20000,
        category: 'Fertility',
        type: ServiceType.Consultation,
        available_modes: [ServiceMode.AT_CLINIC],
      },
      {
        name: 'General Health Consultation',
        description: 'Tư vấn sức khỏe tổng quát',
        price: 25000,
        category: 'General',
        type: ServiceType.Consultation,
        available_modes: [ServiceMode.AT_HOME, ServiceMode.AT_CLINIC],
      },
    ];

    for (const service of services) {
      const existingService = await prisma.service.findFirst({
        where: { name: service.name, category: service.category, deleted_at: null },
      });

      if (existingService) {
        await prisma.service.update({
          where: { service_id: existingService.service_id },
          data: {
            description: service.description,
            price: service.price,
            category: service.category,
            is_active: true,
            type: service.type,
            available_modes: service.available_modes,
            return_address: service.return_address,
            return_phone: service.return_phone,
            testing_hours: service.type === ServiceType.Testing ? { morning: { start: '07:00', end: '11:00' }, afternoon: { start: '13:00', end: '17:00' } } : Prisma.JsonNull,
            daily_capacity: service.type === ServiceType.Testing ? 20 : 10,
          },
        });
      } else {
        await prisma.service.create({
          data: {
            name: service.name,
            description: service.description,
            price: service.price,
            category: service.category,
            is_active: true,
            type: service.type,
            available_modes: service.available_modes,
            return_address: service.return_address,
            return_phone: service.return_phone,
            testing_hours: service.type === ServiceType.Testing ? { morning: { start: '07:00', end: '11:00' }, afternoon: { start: '13:00', end: '17:00' } } : Prisma.JsonNull,
            daily_capacity: service.type === ServiceType.Testing ? 20 : 10,
          },
        });
      }
    }

    // Schedules for Consultants
    const consultants = await prisma.consultantProfile.findMany();
    const consultationServices = await prisma.service.findMany({ where: { type: ServiceType.Consultation } });
    for (const consultant of consultants) {
      for (let i = 0; i < 5; i++) {
        const startTime = new Date(2025, 6, 21 + i, 9 + i % 4, 0); // Tháng 6 (0-based: 6 là tháng 7)
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        const service = consultationServices[Math.floor(Math.random() * consultationServices.length)];

        // Kiểm tra trùng lặp dựa trên consultant_id, start_time, service_id
        const existingSchedule = await prisma.schedule.findFirst({
          where: {
            consultant_id: consultant.consultant_id,
            start_time: startTime,
            service_id: service.service_id,
            deleted_at: null,
          },
        });

        if (!existingSchedule) {
          await prisma.schedule.create({
            data: {
              consultant_id: consultant.consultant_id,
              service_id: service.service_id,
              start_time: startTime,
              end_time: endTime,
              is_booked: false,
              max_appointments_per_day: 5,
            },
          });
        }
      }
    }

    // Appointments with varied statuses, including free consultations
    const appointmentStatuses: AppointmentStatus[] = [
      AppointmentStatus.Pending,
      AppointmentStatus.Confirmed,
      AppointmentStatus.SampleCollected,
      AppointmentStatus.Completed,
      AppointmentStatus.Cancelled
    ];
    const customers = await prisma.user.findMany({ where: { role: Role.Customer } });
    const servicesCreated = await prisma.service.findMany();
    const schedules = await prisma.schedule.findMany();

    const testingAppointments: any[] = [];
    for (let i = 0; i < 15; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const service = servicesCreated.filter(s => s.type === ServiceType.Testing)[Math.floor(Math.random() * 4)];
      const status = appointmentStatuses[Math.floor(Math.random() * appointmentStatuses.length)];
      const startTime = new Date(2025, 6, 21 + i % 10, 9 + (i % 4), 0);

      // Testing Appointments
      const appointment = await prisma.appointment.create({
        data: {
          user_id: customer.user_id,
          consultant_id: null,
          type: AppointmentType.Testing,
          start_time: startTime,
          end_time: new Date(startTime.getTime() + 30 * 60 * 1000),
          status: status,
          location: ['Lab Hanoi', 'Lab HCMC', 'Lab Da Nang'][Math.floor(Math.random() * 3)],
          payment_status: status === AppointmentStatus.Completed ? PaymentStatus.Paid : status === AppointmentStatus.Cancelled ? PaymentStatus.Failed : PaymentStatus.Pending,
          is_free_consultation: false,
          service_id: service.service_id,
          mode: Array.isArray(service.available_modes)
            ? service.available_modes[Math.floor(Math.random() * service.available_modes.length)] as ServiceMode
            : ServiceMode.AT_CLINIC,
          free_consultation_valid_until: status === AppointmentStatus.Completed ? new Date(2025, 7, 21 + i % 10) : null,
        },
      });

      // Payment for Testing appointments
      if (status !== AppointmentStatus.Cancelled) {
        let orderCode: number | undefined = undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          const generatedCode = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
          const existing = await prisma.payment.findUnique({ where: { order_code: generatedCode } });
          if (!existing) {
            orderCode = generatedCode;
            break;
          }
          if (attempt === 2) throw new Error(`Không thể tạo order_code duy nhất cho payment-test-${i + 1}`);
        }

        if (service.type !== ServiceType.Testing) {
          throw new Error(`Service ${service.name} is not a Testing service`);
        }
        if (orderCode === undefined) {
          throw new Error('orderCode was not generated');
        }
        await prisma.payment.create({
          data: {
            appointment_id: appointment.appointment_id,
            user_id: customer.user_id,
            amount: service.price,
            payment_method: PaymentMethod.BankCard,
            status: status === AppointmentStatus.Completed ? PaymentTransactionStatus.Completed : PaymentTransactionStatus.Pending,
            order_code: orderCode,
          },
        });
      }

      // ShippingInfo and ReturnShippingInfo for Testing AT_HOME
      if (appointment.mode === ServiceMode.AT_HOME && status !== AppointmentStatus.Cancelled) {
        await prisma.shippingInfo.upsert({
          where: { appointment_id: appointment.appointment_id },
          update: {},
          create: {
            appointment_id: appointment.appointment_id,
            provider: 'GHTK',
            provider_order_code: `GHTK${1000 + i}`,
            shipping_status: status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed ? ShippingStatus.ReturnedToLab : [ShippingStatus.Pending, ShippingStatus.Shipped, ShippingStatus.DeliveredToCustomer, ShippingStatus.PickupRequested, ShippingStatus.SampleInTransit][Math.floor(Math.random() * 5)],
            contact_name: customer.full_name || 'Khách hàng',
            contact_phone: customer.phone_number || '0901234567',
            shipping_address: customer.address || '123 Đường ABC, TP.HCM',
            province: ['Hanoi', 'HCMC', 'Da Nang'][Math.floor(Math.random() * 3)],
            district: ['Ba Dinh', 'District 1', 'Hai Chau'][Math.floor(Math.random() * 3)],
            ward: ['Ngoc Ha', 'Ben Nghe', 'Thanh Binh'][Math.floor(Math.random() * 3)],
          },
        });

        await prisma.returnShippingInfo.upsert({
          where: { appointment_id: appointment.appointment_id },
          update: {},
          create: {
            appointment_id: appointment.appointment_id,
            provider: 'GHTK',
            provider_order_code: `GHTK-RETURN${1000 + i}`,
            shipping_status: status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed ? ShippingStatus.ReturnedToLab : ShippingStatus.Pending,
            contact_name: 'Lab Staff',
            contact_phone: service.return_phone || '0901234567',
            pickup_address: service.return_address || '123 Lab St, Hanoi',
            pickup_province: ['Hanoi', 'HCMC', 'Da Nang'][Math.floor(Math.random() * 3)],
            pickup_district: ['Ba Dinh', 'District 1', 'Hai Chau'][Math.floor(Math.random() * 3)],
            pickup_ward: ['Ngoc Ha', 'Ben Nghe', 'Thanh Binh'][Math.floor(Math.random() * 3)],
          },
        });
      }

      // TestResult for Testing
      if (status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed) {
        const testResult = await prisma.testResult.upsert({
          where: { test_code: `TEST${1000 + i}` },
          update: {},
          create: {
            test_code: `TEST${1000 + i}`,
            appointment_id: appointment.appointment_id,
            service_id: service.service_id,
            result_data: status === AppointmentStatus.Completed ? JSON.stringify({
              HIV: 'Negative',
              Syphilis: Math.random() > 0.9 ? 'Positive' : 'Negative',
              Chlamydia: service.name.includes('Gold') || service.name.includes('Premium') || service.name.includes('Platinum') ? Math.random() > 0.95 ? 'Positive' : 'Negative' : null,
              HPV: service.name.includes('Premium') || service.name.includes('Platinum') ? Math.random() > 0.95 ? 'Positive' : 'Negative' : null,
              Herpes: service.name.includes('Platinum') ? Math.random() > 0.95 ? 'Positive' : 'Negative' : null,
            }) : 'Awaiting results',
            is_abnormal: status === AppointmentStatus.Completed && Math.random() > 0.9,
            status: status === AppointmentStatus.Completed ? TestResultStatus.Completed : TestResultStatus.Processing,
            notes: status === AppointmentStatus.Completed ? 'Results verified' : null,
            viewed_at: status === AppointmentStatus.Completed && Math.random() > 0.5 ? new Date() : null,
          },
        });

        // AppointmentStatusHistory
        await prisma.appointmentStatusHistory.create({
          data: {
            appointment_id: appointment.appointment_id,
            status: status,
            notes: `Trạng thái: ${status}`,
            changed_by: customer.user_id,
          },
        });

        // TestResultStatusHistory
        if (status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed) {
          await prisma.testResultStatusHistory.create({
            data: {
              result_id: testResult.result_id,
              status: status === AppointmentStatus.Completed ? TestResultStatus.Completed : TestResultStatus.Processing,
              notes: `TestResult: ${status}`,
              changed_by: customer.user_id,
            },
          });
        }

        // Notification
        await prisma.notification.create({
          data: {
            user_id: customer.user_id,
            type: NotificationType.Email,
            title: `Cập nhật lịch hẹn xét nghiệm ${appointment.appointment_id}`,
            content: `Lịch hẹn xét nghiệm của bạn đang ở trạng thái ${status}.`,
            status: [NotificationStatus.Pending, NotificationStatus.Sent][Math.floor(Math.random() * 2)],
          },
        });

        // AuditLog
        await prisma.auditLog.create({
          data: {
            user_id: customer.user_id,
            action: 'CREATE_TESTING_APPOINTMENT',
            entity_type: 'Appointment',
            entity_id: appointment.appointment_id,
            details: { status, service: service.name },
          },
        });

        if (status === AppointmentStatus.Completed) {
          testingAppointments.push(appointment);
        }
      }
    }

    // Consultation Appointments, including free consultations
    for (let i = 0; i < 10; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const consultant = consultants[Math.floor(Math.random() * consultants.length)];
      const service = servicesCreated.filter(s => s.type === ServiceType.Consultation)[Math.floor(Math.random() * 3)];
      const status = appointmentStatuses[Math.floor(Math.random() * appointmentStatuses.length)];
      const startTime = new Date(2025, 6, 17 + i % 10, 9 + (i % 4), 0); // Tháng 6 (0-based: 6 là tháng 7)
      const isFree = i < 3 && testingAppointments.length > i;
      const relatedAppt = isFree ? testingAppointments[i] : null;

      // Tìm schedule chưa được đặt
      const schedule = await prisma.schedule.findFirst({
        where: {
          consultant_id: consultant.consultant_id,
          is_booked: false,
          deleted_at: null,
          appointment: null,
        },
      });

      const appointment = await prisma.appointment.create({
        data: {
          user_id: customer.user_id,
          consultant_id: consultant.consultant_id,
          type: AppointmentType.Consultation,
          start_time: startTime,
          end_time: new Date(startTime.getTime() + 30 * 60 * 1000),
          status: status,
          location: ['Clinic Hanoi', 'Clinic HCMC', 'Clinic Da Nang'][Math.floor(Math.random() * 3)],
          payment_status: isFree || status === 'Completed' ? PaymentStatus.Paid : status === 'Cancelled' ? PaymentStatus.Failed : PaymentStatus.Pending,
          is_free_consultation: isFree,
          service_id: service.service_id,
          schedule_id: schedule?.schedule_id,
          related_appointment_id: relatedAppt?.appointment_id,
          mode: Array.isArray(service.available_modes)
            ? service.available_modes[Math.floor(Math.random() * service.available_modes.length)] as ServiceMode
            : ServiceMode.AT_CLINIC,
        },
      });

      if (schedule) {
        await prisma.schedule.update({
          where: { schedule_id: schedule.schedule_id },
          data: { is_booked: true },
        });
      }

      // Payment for non-free consultations
      if (!isFree && status !== 'Cancelled') {
        let orderCode: number | undefined = undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          const generatedCode = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
          const existing = await prisma.payment.findUnique({ where: { order_code: generatedCode } });
          if (!existing) {
            orderCode = generatedCode;
            break;
          }
          if (attempt === 2) throw new Error(`Không thể tạo order_code duy nhất cho payment-consult-${i + 1}`);
        }

        if (orderCode === undefined) {
          throw new Error('orderCode was not generated');
        }

        await prisma.payment.create({
          data: {
            appointment_id: appointment.appointment_id,
            user_id: customer.user_id,
            amount: service.price,
            payment_method: PaymentMethod.BankCard,
            status: status === 'Completed' ? PaymentTransactionStatus.Completed : PaymentTransactionStatus.Pending,
            order_code: orderCode,
          },
        });
      }

      // AppointmentStatusHistory
      await prisma.appointmentStatusHistory.create({
        data: {
          appointment_id: appointment.appointment_id,
          status: status,
          notes: isFree ? `Tư vấn miễn phí từ xét nghiệm ${relatedAppt?.appointment_id}` : `Trạng thái: ${status}`,
          changed_by: consultant.user_id,
        },
      });

      // Notification
      await prisma.notification.create({
        data: {
          user_id: customer.user_id,
          type: NotificationType.Email,
          title: `Cập nhật lịch hẹn tư vấn ${appointment.appointment_id}`,
          content: `Lịch hẹn tư vấn của bạn đang ở trạng thái ${status}.`,
          status: [NotificationStatus.Pending, NotificationStatus.Sent][Math.floor(Math.random() * 2)],
        },
      });

      // AuditLog
      await prisma.auditLog.create({
        data: {
          user_id: customer.user_id,
          action: 'CREATE_CONSULTATION_APPOINTMENT',
          entity_type: 'Appointment',
          entity_id: appointment.appointment_id,
          details: { status, service: service.name, isFree },
        },
      });
    }

    // Feedback (1 per customer, tied to consultation appointment)
    const feedbackStatuses: FeedbackStatus[] = [
      FeedbackStatus.Pending,
      FeedbackStatus.Approved,
      FeedbackStatus.Rejected
    ];
    for (const customer of customers) {
      // Tìm lịch hẹn tư vấn của khách hàng
      const consultationAppointment = await prisma.appointment.findFirst({
        where: {
          user_id: customer.user_id,
          type: AppointmentType.Consultation,
          deleted_at: null,
        },
      });

      if (consultationAppointment) {
        const service = await prisma.service.findUnique({
          where: { service_id: consultationAppointment.service_id ?? undefined },
        });
        const consultant = await prisma.consultantProfile.findUnique({
          where: { consultant_id: consultationAppointment.consultant_id ?? undefined },
        });

        if (service && consultant) {
          await prisma.feedback.create({
            data: {
              user_id: customer.user_id,
              consultant_id: consultant.consultant_id,
              service_id: service.service_id,
              appointment_id: consultationAppointment.appointment_id,
              rating: Math.floor(Math.random() * 5) + 1,
              comment: `Phản hồi cho ${service.name}: ${['Rất tốt', 'Cần cải thiện', 'Hài lòng'][Math.floor(Math.random() * 3)]}`,
              is_public: true,
              is_anonymous: false,
              status: FeedbackStatus.Approved,
              response: 'Cảm ơn phản hồi của bạn!',
            },
          });
        }
      }
    }


  }
  console.log('Chạy được rồi "Cạp Cạp"');

}

main()
  .catch((e) => {
    console.error('Lỗi khi seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());