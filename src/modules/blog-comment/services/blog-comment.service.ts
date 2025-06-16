import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCommentDto } from '../dtos/create-comment.dto';
import { UpdateCommentDto } from '../dtos/update-comment.dto';
import  Filter from 'bad-words';
import { Role } from '@prisma/client';

const filter = new Filter();


@Injectable()
export class BlogCommentService {
  private readonly logger = new Logger(BlogCommentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createComment(postId: string, dto: CreateCommentDto, userId: string) {
    const blog = await this.prisma.blogPost.findUnique({ where: { post_id: postId, deleted_at: null } });
    if (!blog || !blog.is_published) {
      throw new BadRequestException('Bài viết không tồn tại hoặc chưa được duyệt');
    }

    const user = await this.prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    let parentConnect = {};
    if (dto.parent_id) {
      const parentComment = await this.prisma.blogComment.findUnique({ where: { comment_id: dto.parent_id, deleted_at: null } });
      if (!parentComment || parentComment.status !== 'Approved') {
        throw new BadRequestException('Bình luận cha không tồn tại, đã bị xóa hoặc chưa được duyệt');
      }
      parentConnect = { parent: { connect: { comment_id: dto.parent_id } } };
    }

    const content = dto.content.trim();
    const status = filter.isProfane(content) ? 'Rejected' : 'Approved';

    const comment = await this.prisma.blogComment.create({
      data: {
        post: { connect: { post_id: postId } },
        user: { connect: { user_id: userId } },
        ...parentConnect,
        content,
        status,
        created_at: new Date(),
      },
    });

    this.logger.log(`Tạo bình luận ${comment.comment_id} với status ${status} bởi ${userId} cho bài ${postId}`);
    return { comment, message: 'Tạo bình luận hoặc phản hồi thành công' };
  }

  async getCommentsByPostId(postId: string) {
    const comments = await this.prisma.blogComment.findMany({
      where: { post_id: postId, parent_id: null, status: 'Approved', deleted_at: null },
      orderBy: { created_at: 'desc' },
      include: { replies: { where: { status: 'Approved', deleted_at: null }, orderBy: { created_at: 'asc' } } },
    });
    return { comments, message: 'Lấy danh sách bình luận và phản hồi thành công' };
  }

  async getRepliesByCommentId(id: string) {
    const comment = await this.prisma.blogComment.findUnique({ where: { comment_id: id, deleted_at: null } });
    if (!comment || comment.status !== 'Approved') {
      throw new BadRequestException('Bình luận không tồn tại hoặc chưa được duyệt');
    }

    const replies = await this.prisma.blogComment.findMany({
      where: { parent_id: id, status: 'Approved', deleted_at: null },
      orderBy: { created_at: 'asc' },
    });
    return { replies, message: 'Lấy danh sách phản hồi thành công' };
  }

  async updateComment(id: string, dto: UpdateCommentDto, userId: string, role: Role) {
    const comment = await this.prisma.blogComment.findUnique({ where: { comment_id: id } });
    if (!comment) {
      throw new BadRequestException('Bình luận không tồn tại');
    }

    if (role === Role.Customer && comment.user_id !== userId) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa bình luận của chính bạn');
    }

    const content = dto.content?.trim();
    const status = content && filter.isProfane(content) ? 'Rejected' : 'Approved';

    const updatedComment = await this.prisma.blogComment.update({
      where: { comment_id: id },
      data: { content, status, updated_at: new Date() },
    });

    this.logger.log(`Cập nhật bình luận ${id} với status ${status} bởi ${userId}`);
    return { comment: updatedComment, message: 'Cập nhật bình luận thành công' };
  }

  async deleteComment(id: string, userId: string, role: Role) {
    const comment = await this.prisma.blogComment.findUnique({ where: { comment_id: id } });
    if (!comment) {
      throw new BadRequestException('Bình luận không tồn tại');
    }

    if (role === Role.Customer && comment.user_id !== userId) {
      throw new BadRequestException('Chỉ có thể xóa bình luận của chính bạn');
    }

    const updatedComment = await this.prisma.blogComment.update({
      where: { comment_id: id },
      data: { deleted_at: new Date() },
    });

    this.logger.log(`Xóa bình luận ${id} bởi ${userId}`);
    return { comment: updatedComment, message: 'Xóa bình luận thành công' };
  }
}