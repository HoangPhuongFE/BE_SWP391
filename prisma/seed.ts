
import { PrismaClient, $Enums } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Số vòng băm cho bcrypt
  const saltRounds = 10;

  // Xóa dữ liệu cũ (cẩn thận khi chạy ở production)
  await prisma.user.deleteMany();
  await prisma.service.deleteMany();
  await prisma.menstrualCycle.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.testResult.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.question.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.blogComment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.token.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.consultantProfile.deleteMany();
  console.log('Cleared existing data');

  // Tạo người dùng mẫu
  const users = [
    // 1 Guest
    {
      email: 'guest@gmail.com',
      password: 'guest123',
      role: $Enums.Role.Guest,
      full_name: 'Guest User',
      is_verified: false,
      is_active: true,
    },
    // 10 Customers
    ...Array.from({ length: 10 }, (_, i) => ({
      email: `customer${i + 1}@gmail.com`,
      password: 'customer123',
      role: $Enums.Role.Customer,
      full_name: `Khách hàng ${i + 1}`,
      phone_number: `+849${10000000 + i}`,
      address: `${i + 1} Đường Láng, Hà Nội`,
      is_verified: true,
      is_active: true,
    })),
    // 5 Consultants
    ...Array.from({ length: 5 }, (_, i) => ({
      email: `consultant${i + 1}@gmail.com`,
      password: 'consultant123',
      role: $Enums.Role.Consultant,
      full_name: `BS. Tư vấn ${i + 1}`,
      phone_number: `+849${20000000 + i}`,
      address: `${i + 1} Lê Văn Sỹ, TP.HCM`,
      is_verified: true,
      is_active: true,
    })),
    // 3 Staff
    ...Array.from({ length: 3 }, (_, i) => ({
      email: `staff${i + 1}@gmail.com`,
      password: 'staff123',
      role: $Enums.Role.Staff,
      full_name: `Nhân viên ${i + 1}`,
      phone_number: `+849${30000000 + i}`,
      address: `${i + 1} Trần Hưng Đạo, Đà Nẵng`,
      is_verified: true,
      is_active: true,
    })),
    // 1 Manager
    {
      email: 'manager@gmail.com',
      password: 'manager123',
      role: $Enums.Role.Manager,
      full_name: 'Quản lý Tuấn',
      phone_number: '+84999887766',
      address: '101 Admin St, Hà Nội',
      is_verified: true,
      is_active: true,
    },
    // 1 Admin
    {
      email: 'admin@gmail.com',
      password: 'admin123',
      role: $Enums.Role.Admin,
      full_name: 'Quản trị viên',
      phone_number: '+84955667788',
      address: '202 System Ave, TP.HCM',
      is_verified: true,
      is_active: true,
    },
  ];

  const createdUsers: { email: string; user_id: string }[] = [];
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, saltRounds);
    const createdUser = await prisma.user.create({
      data: {
        email: user.email,
        password_hash: passwordHash,
        role: user.role,
        full_name: user.full_name,
        phone_number: user.phone_number,
        address: user.address,
        is_verified: user.is_verified,
        is_active: user.is_active,
      },
    });
    createdUsers.push({ email: user.email, user_id: createdUser.user_id });
    console.log(`Created user: ${user.email} with role: ${user.role}`);
  }

  // Tạo hồ sơ khách hàng
  const customers = createdUsers.filter((u) => u.email.includes('customer'));
  for (const customer of customers) {
    await prisma.customerProfile.create({
      data: {
        user_id: customer.user_id,
        date_of_birth: new Date(`199${Math.floor(Math.random() * 5) + 0}-01-15`),
        gender: $Enums.Gender.Female,
        medical_history: 'Không có vấn đề nghiêm trọng',
        privacy_settings: { notifications: true },
      },
    });
    console.log(`Created CustomerProfile for ${customer.email}`);
  }

  // Tạo hồ sơ tư vấn viên
  const consultants = createdUsers.filter((u) => u.email.includes('consultant'));
  const consultantProfiles: { user_id: string; consultant_id: string }[] = [];
  for (const consultant of consultants) {
    const profile = await prisma.consultantProfile.create({
      data: {
        user_id: consultant.user_id,
        qualifications: `MD, Chuyên khoa ${Math.random() > 0.5 ? 'Phụ khoa' : 'STIs'}`,
        experience: `${5 + Math.floor(Math.random() * 10)} năm kinh nghiệm`,
        specialization: Math.random() > 0.5 ? 'STIs' : 'Sức khỏe sinh sản',
        is_verified: true,
        average_rating: 3.5 + Math.random() * 1.5,
      },
    });
    consultantProfiles.push({ user_id: consultant.user_id, consultant_id: profile.consultant_id });
    console.log(`Created ConsultantProfile for ${consultant.email}`);
  }

  // Tạo dịch vụ xét nghiệm
  const services = [
    { name: 'Gói cơ bản STIs', description: 'HIV, Syphilis', price: 800000, is_active: true },
    { name: 'Gói toàn diện STIs', description: 'HIV, HPV, Chlamydia', price: 1500000, is_active: true },
    { name: 'Gói HPV riêng', description: 'Xét nghiệm HPV', price: 500000, is_active: true },
    { name: 'Gói Chlamydia', description: 'Xét nghiệm Chlamydia', price: 600000, is_active: true },
    { name: 'Tư vấn sức khỏe', description: 'Tư vấn trực tuyến', price: 100000, is_active: true },
  ];
  const createdServices: { name: string; service_id: string }[] = [];
  for (const service of services) {
    const createdService = await prisma.service.create({
      data: {
        name: service.name,
        description: service.description,
        price: service.price,
        is_active: service.is_active,
      },
    });
    createdServices.push({ name: service.name, service_id: createdService.service_id });
    console.log(`Created service: ${service.name}`);
  }

  // Tạo chu kỳ kinh nguyệt
  for (const customer of customers) {
    const cycles = Array.from({ length: 5 }, (_, i) => ({
      user_id: customer.user_id,
      start_date: new Date(`2025-0${3 + i}-01`),
      period_length: 4 + Math.floor(Math.random() * 3),
      cycle_length: 26 + Math.floor(Math.random() * 5),
      symptoms: Math.random() > 0.5 ? 'Đau bụng nhẹ' : 'Tâm trạng khó chịu',
    }));
    await prisma.menstrualCycle.createMany({ data: cycles });
    console.log(`Created 5 MenstrualCycles for ${customer.email}`);
  }

  // Tạo lịch hẹn
  const appointments: { appointment_id: string; user_id: string; type: string }[] = [];
  for (const customer of customers) {
    const customerAppointments = Array.from({ length: 3 }, (_, i) => ({
      user_id: customer.user_id,
      consultant_id: i === 2 ? consultantProfiles[Math.floor(Math.random() * consultantProfiles.length)].consultant_id : null,
      type: i < 2 ? $Enums.AppointmentType.Testing : $Enums.AppointmentType.Consultation,
      start_time: new Date(`2025-06-${10 + i * 2}T${10 + i * 2}:00:00Z`),
      end_time: new Date(`2025-06-${10 + i * 2}T${10 + i * 2}:30:00Z`),
      status: [$Enums.AppointmentStatus.Pending, $Enums.AppointmentStatus.Confirmed, $Enums.AppointmentStatus.Completed, $Enums.AppointmentStatus.Cancelled][Math.floor(Math.random() * 4)],
      location: i < 2 ? `Phòng khám ${['A', 'B'][i % 2]}, TP.HCM` : null,
      payment_status: [$Enums.PaymentStatus.Pending, $Enums.PaymentStatus.Paid, $Enums.PaymentStatus.Failed][Math.floor(Math.random() * 3)],
    }));
    const createdAppointments = await prisma.appointment.createMany({ data: customerAppointments });
    const fetchedAppointments = await prisma.appointment.findMany({
      where: { user_id: customer.user_id },
      select: { appointment_id: true, user_id: true, type: true },
    });
    appointments.push(...fetchedAppointments);
    console.log(`Created ${createdAppointments.count} appointments for ${customer.email}`);
  }

  // Tạo kết quả xét nghiệm
  const testingAppointments = appointments.filter((a) => a.type === $Enums.AppointmentType.Testing);
  for (const appointment of testingAppointments.slice(0, 15)) {
    const service = createdServices[Math.floor(Math.random() * createdServices.length)];
    await prisma.testResult.create({
      data: {
        appointment_id: appointment.appointment_id,
        service_id: service.service_id,
        result_data: JSON.stringify({
          HIV: Math.random() > 0.8 ? 'Dương tính' : 'Âm tính',
          HPV: Math.random() > 0.8 ? 'Dương tính' : 'Âm tính',
        }),
        status: [$Enums.TestResultStatus.Pending, $Enums.TestResultStatus.Processing, $Enums.TestResultStatus.Completed][Math.floor(Math.random() * 3)],
        notes: Math.random() > 0.5 ? 'Cần tư vấn thêm' : null,
      },
    });
    console.log(`Created TestResult for appointment ${appointment.appointment_id}`);
  }

  // Tạo thanh toán
  for (const appointment of appointments.slice(0, 20)) {
    await prisma.payment.create({
      data: {
        appointment_id: appointment.appointment_id,
        user_id: appointment.user_id,
        amount: 500000 + Math.random() * 1000000,
        payment_method: [$Enums.PaymentMethod.BankCard, $Enums.PaymentMethod.MobileApp, $Enums.PaymentMethod.Cash][Math.floor(Math.random() * 3)],
        status: [$Enums.PaymentTransactionStatus.Pending, $Enums.PaymentTransactionStatus.Completed, $Enums.PaymentTransactionStatus.Failed, $Enums.PaymentTransactionStatus.Refunded][Math.floor(Math.random() * 4)],
      },
    });
    console.log(`Created Payment for appointment ${appointment.appointment_id}`);
  }

  // Tạo đánh giá
  for (const appointment of appointments.slice(0, 15)) {
    const consultant = consultantProfiles[Math.floor(Math.random() * consultantProfiles.length)];
    const service = createdServices[Math.floor(Math.random() * createdServices.length)];
    await prisma.feedback.create({
      data: {
        user_id: appointment.user_id,
        consultant_id: consultant.consultant_id,
        service_id: service.service_id,
        rating: 3 + Math.floor(Math.random() * 3),
        comment: Math.random() > 0.5 ? 'Rất hữu ích!' : 'Cần cải thiện tốc độ phản hồi',
        is_public: Math.random() > 0.5,
        status: [$Enums.FeedbackStatus.Pending, $Enums.FeedbackStatus.Approved, $Enums.FeedbackStatus.Rejected][Math.floor(Math.random() * 3)],
      },
    });
    console.log(`Created Feedback for appointment ${appointment.appointment_id}`);
  }

  // Tạo câu hỏi
  for (const customer of customers) {
    const questions = Array.from({ length: 2 }, () => ({
      user_id: customer.user_id,
      consultant_id: consultantProfiles[Math.floor(Math.random() * consultantProfiles.length)].consultant_id,
      title: Math.random() > 0.5 ? 'Về chu kỳ kinh nguyệt' : 'Tư vấn STIs',
      content: 'Tôi có thắc mắc về sức khỏe, xin tư vấn.',
      is_public: Math.random() > 0.5,
      status: [$Enums.QuestionStatus.Pending, $Enums.QuestionStatus.Answered, $Enums.QuestionStatus.Rejected][Math.floor(Math.random() * 3)],
      answer: Math.random() > 0.5 ? 'Vui lòng đặt lịch tư vấn chi tiết.' : null,
    }));
    await prisma.question.createMany({ data: questions });
    console.log(`Created 2 Questions for ${customer.email}`);
  }

  // Tạo bài blog
  for (const consultant of consultants.slice(0, 2)) {
    const posts = Array.from({ length: 5 }, () => ({
      title: `Bài viết về ${Math.random() > 0.5 ? 'Sức khỏe sinh sản' : 'STIs'}`,
      content: 'Nội dung giáo dục về sức khỏe...',
      author_id: consultant.user_id,
      is_published: Math.random() > 0.3,
    }));
    const createdPosts = await prisma.blogPost.createMany({ data: posts });
    const fetchedPosts = await prisma.blogPost.findMany({
      where: { author_id: consultant.user_id },
      select: { post_id: true },
    });
    for (const post of fetchedPosts.slice(0, 10)) {
      await prisma.blogComment.create({
        data: {
          post_id: post.post_id,
          user_id: customers[Math.floor(Math.random() * customers.length)].user_id,
          content: 'Bài viết rất hữu ích!',
          status: [$Enums.BlogCommentStatus.Pending, $Enums.BlogCommentStatus.Approved, $Enums.BlogCommentStatus.Rejected][Math.floor(Math.random() * 3)],
        },
      });
    }
    console.log(`Created ${createdPosts.count} BlogPosts and comments for ${consultant.email}`);
  }

  // Tạo thông báo
  for (const customer of customers) {
    const notifications = Array.from({ length: 5 }, () => ({
      user_id: customer.user_id,
      type: [$Enums.NotificationType.Email, $Enums.NotificationType.Push, $Enums.NotificationType.SMS][Math.floor(Math.random() * 3)],
      title: Math.random() > 0.5 ? 'Nhắc nhở chu kỳ' : 'Kết quả xét nghiệm',
      content: Math.random() > 0.5 ? 'Chu kỳ sắp bắt đầu' : 'Kết quả sẵn sàng',
      status: [$Enums.NotificationStatus.Pending, $Enums.NotificationStatus.Sent, $Enums.NotificationStatus.Failed][Math.floor(Math.random() * 3)],
    }));
    await prisma.notification.createMany({ data: notifications });
    console.log(`Created 5 Notifications for ${customer.email}`);
  }

  // Tạo báo cáo
  const manager = createdUsers.find((u) => u.email === 'manager@gmail.com');
  if (manager) {
    const reports = Array.from({ length: 5 }, () => ({
      type: [$Enums.ReportType.Appointment, $Enums.ReportType.Testing, $Enums.ReportType.Revenue, $Enums.ReportType.Consultant][Math.floor(Math.random() * 4)],
      data: JSON.stringify({ total: Math.random() * 10000000 }),
      start_date: new Date('2025-06-01'),
      end_date: new Date('2025-06-30'),
      created_by: manager.user_id,
    }));
    await prisma.report.createMany({ data: reports });
    console.log('Created 5 Reports');
  }

  // Tạo nhật ký kiểm toán
  const admin = createdUsers.find((u) => u.email === 'admin@gmail.com');
  if (admin) {
    const logs = Array.from({ length: 10 }, () => ({
      user_id: admin.user_id,
      action: ['Create User', 'Update Appointment'][Math.floor(Math.random() * 2)],
      entity_type: 'User',
      entity_id: customers[Math.floor(Math.random() * customers.length)].user_id,
      details: JSON.stringify({ note: 'Hành động hệ thống' }),
    }));
    await prisma.auditLog.createMany({ data: logs });
    console.log('Created 10 AuditLogs');
  }

  // Tạo refresh token
  for (const customer of customers) {
    const tokenHash = await bcrypt.hash(`refresh_token_${customer.email}`, saltRounds);
    await prisma.token.create({
      data: {
        user_id: customer.user_id,
        refresh_token_hash: tokenHash,
        expires_at: new Date('2025-07-07'),
        is_revoked: Math.random() > 0.8,
      },
    });
    console.log(`Created Token for ${customer.email}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });