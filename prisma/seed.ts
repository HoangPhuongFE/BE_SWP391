
import { PrismaClient, Role, Gender, AppointmentType, AppointmentStatus, PaymentStatus, TestResultStatus, FeedbackStatus, ServiceType, ServiceMode,
   ShippingStatus, PaymentMethod, PaymentTransactionStatus, NotificationType, NotificationStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const coreRoles = ['Admin', 'Manager', 'Staff'];
const consultantEmails = ['consultant1@gmail.com', 'consultant2@gmail.com', 'consultant3@gmail.com', 'consultant4@gmail.com'];
const customerEmails = ['customer1@gmail.com', 'customer2@gmail.com', 'customer3@gmail.com', 'customer4@gmail.com', 'customer5@gmail.com', 'customer6@gmail.com'];

async function main() {
  const defaultPassword = 'a123456';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Xóa dữ liệu cũ với thứ tự hợp lý
  await prisma.$transaction([
    prisma.token.deleteMany(),
    prisma.question.deleteMany(),
    prisma.blogComment.deleteMany(),
    prisma.blogPost.deleteMany(),
    prisma.feedback.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.testResultStatusHistory.deleteMany(),
    prisma.testResult.deleteMany(),
    prisma.returnShippingInfo.deleteMany(),
    prisma.shippingInfo.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.appointmentStatusHistory.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.schedule.deleteMany(),
    prisma.service.deleteMany(),
    prisma.menstrualCycle.deleteMany(),
    prisma.customerProfile.deleteMany(),
    prisma.consultantProfile.deleteMany(),
    prisma.report.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
  ]);
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

  // System User
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

    await prisma.consultantProfile.upsert({
      where: { user_id: user.user_id },
      update: {},
      create: {
        user_id: user.user_id,
        qualifications: ['Bác sĩ chuyên khoa', 'Thạc sĩ y học', 'Tiến sĩ y khoa'][Math.floor(Math.random() * 3)],
        experience: `${Math.floor(Math.random() * 15 + 1)} năm`,
        specialization: ['Gynecology', 'Fertility', 'General Medicine'][Math.floor(Math.random() * 3)],
        is_verified: true,
        average_rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
      },
    });
  }

  // Customers + CustomerProfile
  const genders = [Gender.Female, Gender.Female, Gender.Female, Gender.Male, Gender.Male, Gender.Other]; // Đảm bảo ít nhất 3 Female
  for (let i = 0; i < customerEmails.length; i++) {
    const email = customerEmails[i];
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

    await prisma.customerProfile.upsert({
      where: { user_id: user.user_id },
      update: {},
      create: {
        user_id: user.user_id,
        date_of_birth: new Date(1985 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 12), 1),
        gender: genders[i], // Gán giới tính cố định
        medical_history: ['Không có', 'Tiểu đường', 'Cao huyết áp', 'Dị ứng'][Math.floor(Math.random() * 4)],
        privacy_settings: { showFullName: Math.random() > 0.5 },
      },
    });
  }

  // MenstrualCycle (3 cycles for 1 customer, 2 cycles for 1 customer, 4 cycles for 1 customer)
  const femaleCustomers = await prisma.customerProfile.findMany({ where: { gender: Gender.Female } });
  if (femaleCustomers.length === 0) {
    console.warn('Không có khách hàng nữ để tạo chu kỳ kinh nguyệt');
    return;
  }
  const cycleCounts = femaleCustomers.length >= 3 ? [3, 2, 4] : femaleCustomers.length === 2 ? [3, 2] : [3]; // Phân phối chu kỳ linh hoạt
  for (let i = 0; i < femaleCustomers.length; i++) {
    const cycles = await createMenstrualCycles(femaleCustomers[i].user_id, cycleCounts[i % cycleCounts.length]);
    await prisma.$transaction(cycles);
  }
  // Hàm createMenstrualCycles
  async function createMenstrualCycles(userId: string, numCycles: number) {
    const cycles: Prisma.PrismaPromise<any>[] = [];
    let currentDate = new Date('2025-01-01');
    const now = new Date('2025-07-17');
    const symptomsOptions = ['Đau bụng nhẹ', 'Mệt mỏi', 'Đau đầu', 'Buồn nôn', 'Không có triệu chứng'];
    const notesOptions = ['Bình thường', 'Cần theo dõi thêm', 'Có sử dụng thuốc giảm đau', 'Chu kỳ ổn định'];

    for (let j = 0; j < numCycles; j++) {
      if (currentDate >= now) {
        currentDate = new Date(now.getTime() - (Math.random() * 90 + 30) * 24 * 60 * 60 * 1000); // Lùi 30-90 ngày
      }
      const cycleLength = Math.floor(Math.random() * 15) + 21; // 21-35 ngày
      const periodLength = Math.floor(Math.random() * 6) + 2; // 2-7 ngày
      const ovulationDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      const nextCycleStart = new Date(currentDate.getTime() + cycleLength * 24 * 60 * 60 * 1000);
      const symptoms = symptomsOptions[Math.floor(Math.random() * symptomsOptions.length)];
      const notes = notesOptions[Math.floor(Math.random() * notesOptions.length)];

      cycles.push(
        prisma.menstrualCycle.create({
          data: {
            user_id: userId,
            start_date: currentDate,
            is_predicted: Math.random() > 0.5,
            cycle_length: cycleLength,
            period_length: periodLength,
            ovulation_date: ovulationDate,
            pregnancy_probability: Math.random() > 0.6 ? parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)) : null,
            symptoms,
            notes,
          },
        }),
        prisma.notification.create({
          data: {
            user_id: userId,
            type: NotificationType.Email,
            title: 'Chu kỳ sắp bắt đầu (48h)',
            content: 'Chu kỳ của bạn dự kiến bắt đầu sau 2 ngày.',
            status: NotificationStatus.Pending,
            created_at: new Date(nextCycleStart.getTime() - 48 * 60 * 60 * 1000),
          },
        }),
        prisma.notification.create({
          data: {
            user_id: userId,
            type: NotificationType.Email,
            title: 'Chu kỳ sắp bắt đầu (24h)',
            content: 'Chu kỳ của bạn dự kiến bắt đầu ngày mai.',
            status: NotificationStatus.Pending,
            created_at: new Date(nextCycleStart.getTime() - 24 * 60 * 60 * 1000),
          },
        }),
        prisma.notification.create({
          data: {
            user_id: userId,
            type: NotificationType.Email,
            title: 'Chu kỳ hôm nay',
            content: 'Hôm nay là ngày dự kiến bắt đầu chu kỳ, hãy ghi nhận.',
            status: NotificationStatus.Pending,
            created_at: nextCycleStart,
          },
        }),
        prisma.notification.create({
          data: {
            user_id: userId,
            type: NotificationType.Email,
            title: 'Ngày rụng trứng sắp đến',
            content: 'Ngày rụng trứng dự kiến sau 2 ngày.',
            status: NotificationStatus.Pending,
            created_at: new Date(ovulationDate.getTime() - 48 * 60 * 60 * 1000),
          },
        }),
      );
      currentDate = new Date(currentDate.getTime() + cycleLength * 24 * 60 * 60 * 1000);
    }
    return cycles;
  }

  // Services
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
      available_modes: [ServiceMode.AT_HOME, ServiceMode.AT_CLINIC, ServiceMode.ONLINE],
    },
    {
      name: 'Fertility Consultation',
      description: 'Tư vấn chuyên sâu về sinh sản',
      price: 20000,
      category: 'Fertility',
      type: ServiceType.Consultation,
      available_modes: [ServiceMode.AT_CLINIC, ServiceMode.ONLINE],
    },
    {
      name: 'General Health Consultation',
      description: 'Tư vấn sức khỏe tổng quát',
      price: 25000,
      category: 'General',
      type: ServiceType.Consultation,
      available_modes: [ServiceMode.AT_HOME, ServiceMode.AT_CLINIC, ServiceMode.ONLINE],
    },
  ];

  for (const service of services) {
    const existingService = await prisma.service.findFirst({
      where: { name: service.name, category: service.category, deleted_at: null },
    });

    await prisma.service.upsert({
      where: { service_id: existingService?.service_id || 'temp-id' }, // ID tạm nếu không tồn tại
      update: {
        ...service,
        testing_hours: service.type === ServiceType.Testing ? { morning: { start: '07:00', end: '11:00' }, afternoon: { start: '13:00', end: '17:00' } } : Prisma.JsonNull,
        daily_capacity: service.type === ServiceType.Testing ? 20 : 10,
      },
      create: {
        ...service,
        testing_hours: service.type === ServiceType.Testing ? { morning: { start: '07:00', end: '11:00' }, afternoon: { start: '13:00', end: '17:00' } } : Prisma.JsonNull,
        daily_capacity: service.type === ServiceType.Testing ? 20 : 10,
      },
    });
  }

  // Schedules for Consultants
  const consultants = await prisma.consultantProfile.findMany();
  const consultationServices = await prisma.service.findMany({ where: { type: ServiceType.Consultation } });
  for (const consultant of consultants) {
    for (let i = 0; i < 3; i++) {
      const startTime = new Date(2025, 6, 21 + i, 9 + i % 3, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      const service = consultationServices[Math.floor(Math.random() * consultationServices.length)];

      const existingSchedule = await prisma.schedule.findFirst({
        where: { consultant_id: consultant.consultant_id, start_time: startTime, service_id: service.service_id, deleted_at: null },
      });

      await prisma.schedule.upsert({
        where: { schedule_id: existingSchedule?.schedule_id || `schedule-${Math.random().toString(36).slice(2)}` },
        update: {},
        create: {
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

  // Appointments
  const customers = await prisma.user.findMany({ where: { role: Role.Customer } });
  const servicesCreated = await prisma.service.findMany();
  const schedules = await prisma.schedule.findMany();
  const testingStatuses: AppointmentStatus[] = [AppointmentStatus.Pending, AppointmentStatus.Confirmed, AppointmentStatus.SampleCollected, AppointmentStatus.Completed, AppointmentStatus.Cancelled];
  const consultationStatuses: AppointmentStatus[] = [AppointmentStatus.Pending, AppointmentStatus.Confirmed, AppointmentStatus.InProgress, AppointmentStatus.Completed, AppointmentStatus.Cancelled];

  const testingAppointments: any[] = [];
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < 8; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const service = servicesCreated.filter(s => s.type === ServiceType.Testing)[Math.floor(Math.random() * 4)];
      const status = testingStatuses[Math.floor(Math.random() * testingStatuses.length)];
      const startTime = new Date(2025, 6, 21 + (i % 5), 9 + (i % 3), 0);
      const mode = Array.isArray(service.available_modes) ? service.available_modes[Math.floor(Math.random() * service.available_modes.length)] as ServiceMode : ServiceMode.AT_CLINIC;

      const appointment = await tx.appointment.create({
        data: {
          user_id: customer.user_id,
          consultant_id: null,
          type: AppointmentType.Testing,
          start_time: startTime,
          end_time: new Date(startTime.getTime() + 30 * 60 * 1000),
          status,
          location: ['Lab Hanoi', 'Lab HCMC', 'Lab Da Nang'][Math.floor(Math.random() * 3)],
          payment_status: status === AppointmentStatus.Completed ? PaymentStatus.Paid : status === AppointmentStatus.Cancelled ? PaymentStatus.Failed : PaymentStatus.Pending,
          is_free_consultation: false,
          service_id: service.service_id,
          mode,
          free_consultation_valid_until: status === AppointmentStatus.Completed ? new Date(2025, 7, 21 + (i % 10)) : null,
        },
      });

      if (status !== AppointmentStatus.Cancelled) {
        // Tạo orderCode trong khoảng 10000000 đến 99999999
        const orderCode = Math.floor(10000000 + Math.random() * 90000000);

        // Kiểm tra trùng lặp order_code
        const existingPayment = await tx.payment.findUnique({
          where: { order_code: orderCode },
        });

        if (existingPayment) {
          throw new Error(`order_code ${orderCode} đã tồn tại`);
        }

        await tx.payment.create({
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

      if ((status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed) && appointment.mode === ServiceMode.AT_HOME) {
        const mockGhnData = {
          order_code: `GHN${Date.now()}${Math.floor(Math.random() * 1000)}`,
          expected_delivery_time: new Date(startTime.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          label: null,
        };

        await tx.shippingInfo.create({
          data: {
            appointment_id: appointment.appointment_id,
            provider: 'GHN',
            provider_order_code: mockGhnData.order_code,
            shipping_status: ShippingStatus.Shipped,
            contact_name: customer.full_name || 'Khách hàng',
            contact_phone: customer.phone_number || '0901234567',
            shipping_address: customer.address || '123 Đường ABC, TP.HCM',
            province: ['Hanoi', 'HCMC', 'Da Nang'][Math.floor(Math.random() * 3)],
            district: ['Ba Dinh', 'District 1', 'Hai Chau'][Math.floor(Math.random() * 3)],
            ward: ['Ngoc Ha', 'Ben Nghe', 'Thanh Binh'][Math.floor(Math.random() * 3)],
            expected_delivery_time: new Date(mockGhnData.expected_delivery_time),
            label_url: mockGhnData.label,
          },
        });

        const returnOrderCode = `GHN-RETURN${Date.now()}${Math.floor(Math.random() * 1000)}`;
        await tx.returnShippingInfo.create({
          data: {
            appointment_id: appointment.appointment_id,
            provider: 'GHN',
            provider_order_code: returnOrderCode,
            shipping_status: status === AppointmentStatus.SampleCollected ? ShippingStatus.PickupRequested : ShippingStatus.ReturnedToLab,
            contact_name: customer.full_name || 'Khách hàng',
            contact_phone: customer.phone_number || '0901234567',
            pickup_address: customer.address || '123 Đường ABC, TP.HCM',
            pickup_province: ['Hanoi', 'HCMC', 'Da Nang'][Math.floor(Math.random() * 3)],
            pickup_district: ['Ba Dinh', 'District 1', 'Hai Chau'][Math.floor(Math.random() * 3)],
            pickup_ward: ['Ngoc Ha', 'Ben Nghe', 'Thanh Binh'][Math.floor(Math.random() * 3)],
          },
        });
      }

      if (status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed) {
        const testCode = `TEST${Date.now()}${Math.floor(Math.random() * 1000)}`.padStart(10, '0');
        const testResult = await tx.testResult.create({
          data: {
            test_code: testCode,
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

        await tx.testResultStatusHistory.create({
          data: {
            result_id: testResult.result_id,
            status: status === AppointmentStatus.Completed ? TestResultStatus.Completed : TestResultStatus.Processing,
            notes: `TestResult: ${status}`,
            changed_by: customer.user_id,
          },
        });
      }

      await tx.appointmentStatusHistory.create({
        data: {
          appointment_id: appointment.appointment_id,
          status: AppointmentStatus.Pending,
          notes: 'Tạo lịch hẹn xét nghiệm',
          changed_by: customer.user_id,
        },
      });

      if (status === AppointmentStatus.Confirmed || status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed) {
        await tx.appointmentStatusHistory.create({
          data: {
            appointment_id: appointment.appointment_id,
            status: AppointmentStatus.Confirmed,
            notes: 'Xác nhận lịch hẹn xét nghiệm',
            changed_by: customer.user_id,
          },
        });
      }

      if (status === AppointmentStatus.SampleCollected || status === AppointmentStatus.Completed) {
        await tx.appointmentStatusHistory.create({
          data: {
            appointment_id: appointment.appointment_id,
            status: AppointmentStatus.SampleCollected,
            notes: 'Mẫu đã được thu thập',
            changed_by: customer.user_id,
          },
        });
      }

      if (status === AppointmentStatus.Completed) {
        await tx.appointmentStatusHistory.create({
          data: {
            appointment_id: appointment.appointment_id,
            status: AppointmentStatus.Completed,
            notes: 'Xét nghiệm hoàn tất',
            changed_by: customer.user_id,
          },
        });
      }

      await tx.notification.create({
        data: {
          user_id: customer.user_id,
          type: NotificationType.Email,
          title: `Cập nhật lịch hẹn xét nghiệm ${appointment.appointment_id}`,
          content: `Lịch hẹn xét nghiệm của bạn đang ở trạng thái ${status}.`,
          status: [NotificationStatus.Pending, NotificationStatus.Sent][Math.floor(Math.random() * 2)],
        },
      });

      await tx.auditLog.create({
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
  });

  const consultationAppointments: any[] = [];
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < 6; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const consultant = consultants[Math.floor(Math.random() * consultants.length)];
      const service = servicesCreated.filter(s => s.type === ServiceType.Consultation)[Math.floor(Math.random() * 3)];
      const status = consultationStatuses[Math.floor(Math.random() * consultationStatuses.length)];
      const startTime = new Date(2025, 6, 21 + (i % 5), 9 + (i % 3), 0);
      const isFree = i < 2 && testingAppointments.length > i;
      const relatedAppt = isFree ? testingAppointments[i] : null;
      const mode = Array.isArray(service.available_modes) ? service.available_modes[Math.floor(Math.random() * service.available_modes.length)] as ServiceMode : ServiceMode.AT_CLINIC;
      const payment_status = isFree || status === AppointmentStatus.Completed || status === AppointmentStatus.InProgress ? PaymentStatus.Paid : status === AppointmentStatus.Cancelled ? PaymentStatus.Failed : PaymentStatus.Pending;

      const schedule = await tx.schedule.findFirst({
        where: {
          consultant_id: consultant.consultant_id,
          is_booked: false,
          deleted_at: null,
          appointment: null,
          start_time: { gte: startTime, lte: new Date(startTime.getTime() + 60 * 60 * 1000) },
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          user_id: customer.user_id,
          consultant_id: consultant.consultant_id,
          type: AppointmentType.Consultation,
          start_time: schedule ? schedule.start_time : startTime,
          end_time: schedule ? schedule.end_time : new Date(startTime.getTime() + 30 * 60 * 1000),
          status,
          location: mode === ServiceMode.ONLINE ? null : ['Clinic Hanoi', 'Clinic HCMC', 'Clinic Da Nang'][Math.floor(Math.random() * 3)],
          payment_status,
          is_free_consultation: isFree,
          service_id: service.service_id,
          schedule_id: schedule?.schedule_id,
          related_appointment_id: isFree ? relatedAppt?.appointment_id : null,
          mode,
          meeting_link: mode === ServiceMode.ONLINE ? `https://meet.google.com/test-${Math.floor(Math.random() * 1000)}` : null,
          consultation_notes: status === AppointmentStatus.Completed ? 'Buổi tư vấn hoàn tất với kết quả tốt' : null,
        },
      });

      if (schedule) {
        await tx.schedule.update({
          where: { schedule_id: schedule.schedule_id },
          data: { is_booked: true },
        });
      }

      if (!isFree && status !== AppointmentStatus.Cancelled) {
        const orderCode = Math.floor(10000000 + Math.random() * 90000000); // Tạo số 8 chữ số

        // Kiểm tra trùng lặp order_code
        const existingPayment = await tx.payment.findUnique({
          where: { order_code: orderCode },
        });

        if (existingPayment) {
          throw new Error(`order_code ${orderCode} đã tồn tại`);
        }

        await tx.payment.create({
          data: {
            appointment_id: appointment.appointment_id,
            user_id: customer.user_id,
            amount: service.price,
            payment_method: PaymentMethod.BankCard,
            status: status === AppointmentStatus.Completed || status === AppointmentStatus.InProgress ? PaymentTransactionStatus.Completed : PaymentTransactionStatus.Pending,
            order_code: orderCode,
          },
        });
      }

      await tx.appointmentStatusHistory.create({
        data: {
          appointment_id: appointment.appointment_id,
          status: AppointmentStatus.Pending,
          notes: isFree ? `Tư vấn miễn phí từ xét nghiệm ${relatedAppt?.appointment_id}` : `Tạo lịch hẹn tư vấn`,
          changed_by: customer.user_id,
        },
      });

      if (status === AppointmentStatus.Confirmed || status === AppointmentStatus.InProgress || status === AppointmentStatus.Completed) {
        await tx.appointmentStatusHistory.create({
          data: {
            appointment_id: appointment.appointment_id,
            status: AppointmentStatus.Confirmed,
            notes: 'Xác nhận lịch hẹn',
            changed_by: consultant.user_id,
          },
        });
      }

      if (status === AppointmentStatus.InProgress || status === AppointmentStatus.Completed) {
        await tx.appointmentStatusHistory.create({
          data: {
            appointment_id: appointment.appointment_id,
            status: AppointmentStatus.InProgress,
            notes: 'Buổi tư vấn đã bắt đầu',
            changed_by: consultant.user_id,
          },
        });
        await tx.notification.create({
          data: {
            user_id: customer.user_id,
            type: NotificationType.Email,
            title: 'Buổi tư vấn đã bắt đầu',
            content: `Buổi tư vấn của bạn với mã ${appointment.appointment_id} đã bắt đầu.`,
            status: NotificationStatus.Pending,
          },
        });
      }

      if (status === AppointmentStatus.Completed) {
        await tx.appointmentStatusHistory.create({
          data: {
            appointment_id: appointment.appointment_id,
            status: AppointmentStatus.Completed,
            notes: 'Buổi tư vấn đã hoàn tất',
            changed_by: consultant.user_id,
          },
        });
        await tx.notification.create({
          data: {
            user_id: customer.user_id,
            type: NotificationType.Email,
            title: 'Buổi tư vấn đã hoàn tất',
            content: `Buổi tư vấn của bạn (mã ${appointment.appointment_id}) đã hoàn tất. Vui lòng gửi feedback.`,
            status: NotificationStatus.Pending,
          },
        });
      }

      await tx.notification.create({
        data: {
          user_id: customer.user_id,
          type: NotificationType.Email,
          title: `Cập nhật lịch hẹn tư vấn ${appointment.appointment_id}`,
          content: `Lịch hẹn tư vấn của bạn đang ở trạng thái ${status}.`,
          status: [NotificationStatus.Pending, NotificationStatus.Sent][Math.floor(Math.random() * 2)],
        },
      });

      await tx.auditLog.create({
        data: {
          user_id: customer.user_id,
          action: 'CREATE_CONSULTATION_APPOINTMENT',
          entity_type: 'Appointment',
          entity_id: appointment.appointment_id,
          details: { status: appointment.status, service: service.name, isFree },
        },
      });

      consultationAppointments.push(appointment);
    }
  });

  // Feedback
  const feedbackStatuses: FeedbackStatus[] = [FeedbackStatus.Pending, FeedbackStatus.Approved, FeedbackStatus.Rejected];
  for (const customer of customers.slice(0, 4)) {
    const consultationAppointment = await prisma.appointment.findFirst({
      where: { user_id: customer.user_id, type: AppointmentType.Consultation, deleted_at: null },
    });

    if (consultationAppointment) {
      const service = await prisma.service.findUnique({ where: { service_id: consultationAppointment.service_id ?? undefined } });
      const consultant = await prisma.consultantProfile.findUnique({ where: { consultant_id: consultationAppointment.consultant_id ?? undefined } });

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

  console.log('Chạy được rồi "Cạp Cạp"');
}

function createMenstrualCycles(userId: string, numCycles: number) {
  const cycles: Prisma.PrismaPromise<any>[] = [];
  let currentDate = new Date(2025, 0, 1);
  const now = new Date('2025-07-16');
  for (let j = 0; j < numCycles; j++) {
    if (currentDate > now) currentDate = new Date(now.getTime() - (Math.random() * 30 + 20) * 24 * 60 * 60 * 1000);
    const cycleLength = Math.floor(Math.random() * 15) + 21;
    const periodLength = Math.floor(Math.random() * 6) + 2;
    const ovulationDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const nextCycleStart = new Date(currentDate.getTime() + cycleLength * 24 * 60 * 60 * 1000);

    cycles.push(
      prisma.menstrualCycle.create({
        data: {
          user_id: userId,
          start_date: currentDate,
          is_predicted: Math.random() > 0.5,
          cycle_length: cycleLength,
          period_length: periodLength,
          ovulation_date: ovulationDate,
          pregnancy_probability: Math.random() > 0.6 ? parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)) : null,
        },
      }),
      prisma.notification.create({
        data: {
          user_id: userId,
          type: NotificationType.Email,
          title: 'Chu kỳ sắp bắt đầu (24h)',
          content: 'Chu kỳ của bạn dự kiến bắt đầu ngày mai.',
          status: NotificationStatus.Pending,
          created_at: new Date(nextCycleStart.getTime() - 24 * 60 * 60 * 1000),
        },
      }),
      prisma.notification.create({
        data: {
          user_id: userId,
          type: NotificationType.Email,
          title: 'Ngày rụng trứng sắp đến',
          content: 'Ngày rụng trứng dự kiến sau 2 ngày.',
          status: NotificationStatus.Pending,
          created_at: new Date(ovulationDate.getTime() - 48 * 60 * 60 * 1000),
        },
      }),
    );
    currentDate = new Date(currentDate.getTime() + Math.max(cycleLength, 20) * 24 * 60 * 60 * 1000);
  }
  return cycles;
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
