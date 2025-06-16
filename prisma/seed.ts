import { PrismaClient, Role, Gender, AppointmentStatus, PaymentTransactionStatus, QuestionStatus, FeedbackStatus, BlogCommentStatus, NotificationStatus, ReportType, PaymentMethod, AppointmentType, TestResultStatus, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function generateUniqueOrderCode(): Promise<number> {
  let orderCode: number | null = null;
  for (let i = 0; i < 10; i++) {
    const candidate = Number(`${Date.now() % 100000}${Math.floor(Math.random() * 1000)}`.padStart(8, '0'));
    const existed = await prisma.payment.findUnique({ where: { order_code: candidate } });
    if (!existed) {
      orderCode = candidate;
      break;
    }
  }
  if (!orderCode) throw new Error('Cannot generate unique order_code');
  return orderCode;
}

async function main() {
  const defaultPassword = 'a123456';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  const users: any[] = [];

  const coreRoles = ['Admin', 'Manager', 'Staff'];
  for (const role of coreRoles) {
    const email = `${role.toLowerCase()}@gmail.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        role: role as Role,
        full_name: faker.person.fullName(),
        phone_number: faker.phone.number().slice(0, 20),
        address: faker.location.streetAddress(),
        is_verified: true,
      },
    });
    users.push(user);
  }

  const consultants: any[] = [];
  for (let i = 0; i < 5; i++) {
    const email = `consultant${i + 1}@gmail.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        role: Role.Consultant,
        full_name: `Consultant ${i + 1}`,
        phone_number: faker.phone.number().slice(0, 20),
        address: faker.location.streetAddress(),
        is_verified: true,
        consultant: {
          create: {
            qualifications: faker.person.jobTitle(),
            experience: `${faker.number.int({ min: 1, max: 20 })} years`,
            specialization: faker.helpers.arrayElement(['Gynecology', 'Urology', 'General', 'Nutrition', 'Mental Health']),
            is_verified: true,
            average_rating: faker.number.float({ min: 3, max: 5 }),
          },
        },
      },
    });
    consultants.push(user);
  }

  const customersEmail = [
    'customer1@gmail.com','zonduyen25@gmail.com','hoangnpse161446@fpt.edu.vn','hoang093898xxx@gmail.com','hoamgnguyen8@gmail.com','anhphi@gmail.com','thaikhoa@gmail.com','quanghuy@gmail.com','phuonghoang@gmail.com'
  ];

  const customers: any[] = [];
  for (const email of customersEmail) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password_hash: hashedPassword,
        role: Role.Customer,
        full_name: email.split('@')[0],
        phone_number: faker.phone.number().slice(0, 20),
        address: faker.location.streetAddress(),
        is_verified: true,
        customer: {
          create: {
            date_of_birth: faker.date.birthdate(),
            gender: faker.helpers.arrayElement(Object.values(Gender)),
            medical_history: faker.lorem.sentence().slice(0, 255),
            privacy_settings: {},
          },
        },
      },
    });
    customers.push(user);
  }

  const admin = users.find(u => u.role === Role.Admin);
  const staff = users.find(u => u.role === Role.Staff);
  const consultationServices: any[] = [], testingServices: any[] = [];

  for (let i = 0; i < 5; i++) {
    consultationServices.push(await prisma.service.create({
      data: { name: `Consultation ${i+1}`, price: faker.number.int({ min: 100000, max: 300000 }), type: 'Consultation', is_active: true }
    }));
    testingServices.push(await prisma.service.create({
      data: { name: `Testing ${i+1}`, price: faker.number.int({ min: 100000, max: 300000 }), type: 'Testing', is_active: true }
    }));
  }

  for (const customer of customers) {
    for (let i = 0; i < 10; i++) {
      const randomConsultant = faker.helpers.arrayElement(consultants);
      const consultantProfile = await prisma.consultantProfile.findUnique({ where: { user_id: randomConsultant.user_id }});
      const type = faker.helpers.arrayElement(Object.values(AppointmentType));
      const service = type === 'Consultation' ? faker.helpers.arrayElement(consultationServices) : faker.helpers.arrayElement(testingServices);
      
      const appointment = await prisma.appointment.create({
        data: {
          user_id: customer.user_id,
          consultant_id: consultantProfile!.consultant_id,
          type,
          start_time: faker.date.recent(),
          end_time: faker.date.recent(),
          status: faker.helpers.arrayElement(Object.values(AppointmentStatus)),
          location: faker.location.city(),
          payment_status: 'Pending',
          is_free_consultation: faker.datatype.boolean(),
          service_id: service.service_id,
        }
      });

      await prisma.appointmentStatusHistory.create({
        data: {
          appointment_id: appointment.appointment_id,
          status: appointment.status,
          notes: faker.lorem.words(5),
          changed_by: admin.user_id,
        }
      });

      const paymentStatus = faker.helpers.arrayElement(Object.values(PaymentTransactionStatus));
      await prisma.payment.create({
        data: {
          appointment_id: appointment.appointment_id,
          user_id: customer.user_id,
          amount: faker.number.int({ min: 10000, max: 20000 }),
          payment_method: faker.helpers.arrayElement(Object.values(PaymentMethod)),
          status: paymentStatus,
          order_code: await generateUniqueOrderCode(),
        }
      });

      if (type === AppointmentType.Testing) {
        const testResult = await prisma.testResult.create({
          data: {
            test_code: faker.string.uuid(),
            appointment_id: appointment.appointment_id,
            service_id: service.service_id,
            result_data: faker.helpers.arrayElement(['Negative', 'Positive']),
            is_abnormal: faker.datatype.boolean(),
            status: faker.helpers.arrayElement(Object.values(TestResultStatus)),
          }
        });

        await prisma.testResultStatusHistory.create({
          data: {
            result_id: testResult.result_id,
            status: testResult.status,
            notes: faker.lorem.words(4),
            changed_by: admin.user_id
          }
        });
      }
    }

    for (let i = 0; i < 5; i++) {
      const randomConsultant = faker.helpers.arrayElement(consultants);
      const consultantProfile = await prisma.consultantProfile.findUnique({ where: { user_id: randomConsultant.user_id } });

      await prisma.feedback.create({
        data: {
          user_id: customer.user_id,
          consultant_id: consultantProfile!.consultant_id,
          service_id: faker.helpers.arrayElement(consultationServices).service_id,
          rating: faker.number.int({ min: 1, max: 5 }),
          comment: faker.lorem.words(30).slice(0, 240),
          is_public: faker.datatype.boolean(),
          is_anonymous: faker.datatype.boolean(),
          status: faker.helpers.arrayElement(Object.values(FeedbackStatus))
        }
      });

      await prisma.question.create({
        data: {
          user_id: customer.user_id,
          consultant_id: consultantProfile!.consultant_id,
          title: faker.string.sample(200),
          content: faker.string.sample(400),
          is_public: faker.datatype.boolean(),
          is_anonymous: faker.datatype.boolean(),
          status: faker.helpers.arrayElement(Object.values(QuestionStatus)),
          answer: faker.datatype.boolean() ? faker.string.sample(400) : null
        }
      });
    }
  }

  for (let i = 0; i < 5; i++) {
    const post = await prisma.blogPost.create({
      data: {
        title: faker.lorem.sentence().slice(0, 255),
        content: faker.string.sample(1000),
        author_id: staff.user_id,
        is_published: faker.datatype.boolean(),
        views_count: faker.number.int(1000),
      }
    });

    for (let j = 0; j < 3; j++)
    for (let j = 0; j < 3; j++) {
      const randomCustomer = faker.helpers.arrayElement(customers);
      await prisma.blogComment.create({
        data: {
          post_id: post.post_id,
          user_id: randomCustomer.user_id,
          content: faker.string.sample(500),
          status: faker.helpers.arrayElement(Object.values(BlogCommentStatus)),
        }
      });
    }
  }

  // Notifications, Reports, AuditLog, MenstrualCycle
  for (const customer of customers) {
    for (let i = 0; i < 5; i++) {
      await prisma.notification.create({
        data: {
          user_id: customer.user_id,
          type: 'Email',
          title: faker.lorem.sentence().slice(0, 255),
          content: faker.string.sample(500),
          status: faker.helpers.arrayElement(Object.values(NotificationStatus)),
        }
      });

      await prisma.auditLog.create({
        data: {
          user_id: customer.user_id,
          action: faker.lorem.words().slice(0, 100),
          entity_type: 'Appointment',
          entity_id: faker.string.uuid(),
          details: { change: faker.lorem.sentence() },
        }
      });

      await prisma.menstrualCycle.create({
        data: {
          user_id: customer.user_id,
          start_date: faker.date.past(),
          cycle_length: faker.number.int({ min: 25, max: 35 }),
          period_length: faker.number.int({ min: 3, max: 7 }),
          symptoms: faker.lorem.words().slice(0, 240),
          notes: faker.lorem.words().slice(0, 240),
          ovulation_date: faker.date.past(),
          pregnancy_probability: faker.number.float({ min: 0, max: 1 }),
        }
      });
    }
  }

  for (let i = 0; i < 10; i++) {
    await prisma.report.create({
      data: {
        type: faker.helpers.arrayElement(Object.values(ReportType)),
        data: { report: faker.lorem.words() },
        start_date: faker.date.past(),
        end_date: faker.date.recent(),
        created_by: admin.user_id,
      }
    });
  }

  console.log(" FULL SEED FINAL 2025 ĐÃ HOÀN TẤT!");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
