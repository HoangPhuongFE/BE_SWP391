import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@modules/email/email.service';
import { v2 as cloudinary } from 'cloudinary';
import { CreateQuestionDto } from '../dtos/create-question.dto';
import { UpdateQuestionDto } from '../dtos/update-question.dto';
import { UpdateQuestionPatchDto } from '../dtos/update-question-patch.dto';
import { QuestionStatus, Role } from '@prisma/client';
import { Readable } from 'stream';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async createQuestion(userId: string, dto: CreateQuestionDto) {
    const { title, content, consultant_id, image, category } = dto;

    // Kiểm tra user và consultant với include quan hệ user
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: { consultant: true, customer: true },
    });
    if (!user || user.role !== 'Customer') throw new UnauthorizedException('Chỉ khách hàng mới có thể tạo câu hỏi');

    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { consultant_id },
      include: { user: true },
    });
    if (!consultant || !consultant.user) throw new NotFoundException('Không tìm thấy tư vấn viên');

    // Upload hình ảnh lên Cloudinary nếu có và là file hợp lệ
    let image_url: string | null = null;
    if (image && image.buffer) {
      try {
        image_url = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: 'questions' },
            (error, result) => {
              if (error) {
                this.logger.error(`Lỗi upload hình ảnh: ${error.message}`);
                return reject(new BadRequestException('Lỗi khi upload hình ảnh'));
              }
              resolve(result?.secure_url || null);
            }
          );
          const bufferStream = new Readable();
          bufferStream.push(image.buffer);
          bufferStream.push(null); // Kết thúc stream
          bufferStream.pipe(uploadStream);
        });
      } catch (error) {
        this.logger.error(`Lỗi upload hình ảnh cho câu hỏi: ${error.message}`);
        throw new BadRequestException('Lỗi khi upload hình ảnh');
      }
    } else if (image && !image.buffer) {
      this.logger.warn('Image provided but not a valid file, skipping upload');
    }

    // Tạo câu hỏi với is_anonymous mặc định là true
    const question = await this.prisma.question.create({
      data: {
        user_id: userId,
        consultant_id,
        title,
        content,
        is_anonymous: true, // Mặc định ẩn danh
        image_url,
        status: QuestionStatus.Pending,
        category,
      },
    });

    // Ghi log AuditLog
    await this.prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE_QUESTION',
        entity_type: 'Question',
        entity_id: question.question_id,
        details: { title },
      },
    });

    // Gửi email cho Consultant
    await this.emailService.sendEmail(
      consultant.user.email,
      `Câu hỏi mới: ${title}`,
      `Bạn có một câu hỏi mới từ ${user.full_name}. Nội dung: ${content}`, // Không cần kiểm tra is_anonymous vì luôn ẩn
    );

    this.logger.log(`Tạo câu hỏi ${question.question_id} bởi user ${userId}`);
    return question;
  }

  async answerQuestion(questionId: string, userId: string, answer: string) {
    const question = await this.prisma.question.findUnique({ where: { question_id: questionId } });
    if (!question) throw new NotFoundException('Câu hỏi không tìm thấy');
    const consultant = await this.prisma.consultantProfile.findFirst({
      where: { user_id: userId },
      include: { user: true },
    });
    if (!consultant || !consultant.user || consultant.consultant_id !== question.consultant_id) {
      throw new UnauthorizedException('Chỉ tư vấn viên được gán mới có quyền trả lời');
    }

    const updatedQuestion = await this.prisma.question.update({
      where: { question_id: questionId },
      data: { answer, status: QuestionStatus.Answered, updated_at: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'ANSWER_QUESTION',
        entity_type: 'Question',
        entity_id: questionId,
        details: { answer },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { user_id: question.user_id },
      select: { email: true, full_name: true },
    });
    if (!user || !user.email) throw new BadRequestException('Bạn không tìm thấy người dùng hoặc email');
    await this.emailService.sendEmail(
      user.email,
      'Câu hỏi của bạn đã được trả lời',
      `Câu hỏi của bạn "${question.title}" đã được trả lời: ${answer}`,
    );

    this.logger.log(`Trả lời câu hỏi ${questionId} bởi consultant ${userId}`);
    return updatedQuestion;
  }

  async deleteQuestion(questionId: string, userId: string, reason?: string) {
    const question = await this.prisma.question.findUnique({ where: { question_id: questionId } });
    if (!question) throw new NotFoundException('Câu hỏi không tìm thấy');
    const consultant = await this.prisma.consultantProfile.findFirst({
      where: { user_id: userId },
      include: { user: true },
    });
    if (!consultant || !consultant.user || consultant.consultant_id !== question.consultant_id) {
      throw new UnauthorizedException('Chỉ tư vấn viên được gán mới có quyền xóa');
    }

    const deletedQuestion = await this.prisma.question.update({
      where: { question_id: questionId },
      data: { status: QuestionStatus.Deleted, deleted_at: new Date(), updated_at: new Date() },
    });

    // Xóa hình ảnh trên Cloudinary nếu có
    if (question.image_url) {
      const publicId = question.image_url.split('/').pop()?.split('.')[0];
      await cloudinary.uploader.destroy(`questions/${publicId}`);
    }

    await this.prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE_QUESTION',
        entity_type: 'Question',
        entity_id: questionId,
        details: { reason },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { user_id: question.user_id },
      select: { email: true, full_name: true },
    });
    if (!user || !user.email) throw new BadRequestException('Bạn không tìm thấy người dùng hoặc email');
    await this.emailService.sendEmail(
      user.email,
      'Bạn đã xóa câu hỏi',
      `Câu hỏi của bạn "${question.title}" đã bị xóa do ${reason || 'vấn đề nội dung'}.`,
    );

    this.logger.log(`Xóa câu hỏi ${questionId} bởi consultant ${userId} với lý do: ${reason || 'không có'}`);
    return deletedQuestion;
  }

  async getAllQuestions() {
    const questions = await this.prisma.question.findMany({
      where: { deleted_at: null },
      include: {
        user: { select: { user_id: true, full_name: true, email: true } },
        consultant: { include: { user: { select: { full_name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      questions: questions.map(q => ({
        question_id: q.question_id,
        title: q.title,
        content: q.content,
        status: q.status,
        category: q.category,
        answer: q.answer,
        image_url: q.image_url,
        user: { user_id: q.user.user_id, full_name: q.user.full_name },
        consultant_name: q.consultant?.user?.full_name || null,
      })),
      message: 'Lấy danh sách câu hỏi thành công',
    };
  }
async getAssignedQuestions(userId: string) {
    const consultant = await this.prisma.consultantProfile.findFirst({
      where: { user_id: userId },
    });
    if (!consultant) {
      this.logger.warn(`No consultant profile found for userId: ${userId}`);
      throw new NotFoundException('Tư vấn viên không tìm thấy');
    }

    const questions = await this.prisma.question.findMany({
      where: { consultant_id: consultant.consultant_id, deleted_at: null },
      include: {
        user: { select: { user_id: true, full_name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    if (questions.length === 0) {
      this.logger.warn(`No assigned questions found for consultant_id: ${consultant.consultant_id}`);
      throw new NotFoundException('Không có câu hỏi nào được gán');
    }

    return {
      questions: questions.map(q => ({
        question_id: q.question_id,
        title: q.title,
        content: q.content,
        status: q.status,
        category: q.category,
        answer: q.answer,
        image_url: q.image_url,
        consultant_id: q.consultant_id,
        user_id: q.user.user_id,
        user_full_name: q.user.full_name,
        user_email: q.user.email,
        user: { user_id: q.user.user_id, full_name: q.user.full_name },
      })),
      message: 'Lấy danh sách câu hỏi được gán thành công',
    };
  } 
  async getQuestionById(questionId: string, userId: string, role: Role) {
    const question = await this.prisma.question.findUnique({
      where: { question_id: questionId, deleted_at: null },
      include: {
        user: { select: { user_id: true, full_name: true, email: true } },
        consultant: { include: { user: { select: { full_name: true } } } },
      },
    });
    if (!question) throw new NotFoundException('Câu hỏi không tìm thấy');

    // Kiểm tra quyền truy cập
    if (role === Role.Customer && question.user_id !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể xem câu hỏi của mình');
    }
    if (role === Role.Consultant) {
      const consultant = await this.prisma.consultantProfile.findFirst({ where: { user_id: userId } });
      if (!consultant || consultant.consultant_id !== question.consultant_id) {
        throw new ForbiddenException('Bạn không có quyền truy cập câu hỏi này');
      }
    }

    return {
      question: {
        question_id: question.question_id,
        title: question.title,
        content: question.content,
        status: question.status,
        category: question.category,
        answer: question.answer,
        image_url: question.image_url,

        user: { user_id: question.user.user_id, full_name: question.user.full_name },
        consultant_name: question.consultant?.user?.full_name || null,
      },
      message: 'Lấy chi tiết câu hỏi thành công',
    };
  }

  async updateQuestion(questionId: string, userId: string, dto: UpdateQuestionPatchDto) {
    const question = await this.prisma.question.findUnique({ where: { question_id: questionId } });
    if (!question) throw new NotFoundException('Câu hỏi không tìm thấy');
    if (question.user_id !== userId) throw new UnauthorizedException('Chỉ người tạo mới có thể cập nhật câu hỏi');
    if (question.status !== QuestionStatus.Pending) throw new BadRequestException('Chỉ câu hỏi đang chờ mới có thể được cập nhật');

    const updatedQuestion = await this.prisma.question.update({
      where: { question_id: questionId },
      data: {
        title: dto.title || question.title,
        content: dto.content || question.content,
        updated_at: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE_QUESTION',
        entity_type: 'Question',
        entity_id: questionId,
        details: { title: dto.title, content: dto.content },
      },
    });

    this.logger.log(`Cập nhật câu hỏi ${questionId} bởi user ${userId}`);
    return updatedQuestion;
  }

  async getMyQuestions(userId: string) {
    const questions = await this.prisma.question.findMany({
      where: { user_id: userId, deleted_at: null },
      include: {
        user: { select: { full_name: true } },
        consultant: { include: { user: { select: { full_name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      questions: questions.map(q => ({
        question_id: q.question_id,
        title: q.title,
        content: q.content,
        status: q.status,
        category: q.category,
        answer: q.answer,
        image_url: q.image_url,
        user_id: q.user_id,
        user_full_name: q.user?.full_name || null,
        consultant_id: q.consultant?.consultant_id || null,
        consultant_name: q.consultant?.user?.full_name || null,
      })),
      message: 'Lấy danh sách câu hỏi của bạn thành công',
    };
  }

  
}