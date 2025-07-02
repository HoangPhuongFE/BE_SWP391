import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateBlogDto } from '../dtos/create-blog.dto';
import { UpdateBlogDto } from '../dtos/update-blog.dto';
import { ApproveBlogDto } from '../dtos/approve-blog.dto';
import { Role } from '@prisma/client';

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(private readonly prisma: PrismaService) { }

  async createBlog(dto: CreateBlogDto, userId: string, role: string) {
    const isStaff = role === Role.Staff;
    const isConsultant = role === Role.Consultant;
    if (!isStaff && !isConsultant) {
      throw new BadRequestException('Không có quyền truy cập');
    }

    const blog = await this.prisma.blogPost.create({
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        author_id: userId,
        is_published: isStaff ? true : false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    this.logger.log(`Tạo bài viết ${blog.post_id} bởi ${userId}`);
    return { blog, message: 'Tạo bài viết thành công' };
  }

  async getAllBlogs() {
    const blogs = await this.prisma.blogPost.findMany({
      where: { is_published: true, deleted_at: null },
      orderBy: { created_at: 'desc' },
      select: {
        post_id: true,
        title: true,
        content: true,
        category: true,
        author: { select: { full_name: true } },
        is_published: true,
        views_count: true,
        created_at: true,
        updated_at: true,
      },
    });
    return { blogs, message: 'Lấy danh sách bài viết thành công' };
  }

  async getAllPublicBlogs() {
    const blogs = await this.prisma.blogPost.findMany({
      where: { is_published: true, deleted_at: null },
      orderBy: { created_at: 'desc' },
      select: {
        post_id: true,
        title: true,
        content: true,
        category: true,
        author: { select: { full_name: true } },
        is_published: true,
        views_count: true,
        created_at: true,
        updated_at: true,
      },
    });
    return { blogs, message: 'Lấy danh sách bài viết công khai thành công' };
  }

  async getPendingBlogs() {
    const blogs = await this.prisma.blogPost.findMany({
      where: {
        is_published: false,
        deleted_at: null,
        author: {
          role: Role.Consultant,
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return { blogs, message: 'Lấy danh sách bài viết chưa duyệt thành công' };
  }

  async getBlogById(id: string, userId: string, role: Role) {
    const blog = await this.prisma.blogPost.findUnique({
      where: { post_id: id, deleted_at: null },
      select: {
        post_id: true,
        title: true,
        content: true,
        category: true,
        author_id: true,
        author: { select: { full_name: true } },
        is_published: true,
        views_count: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!blog) throw new BadRequestException('Bài viết không tồn tại');
    if (!blog.is_published && role !== Role.Staff && role !== Role.Manager && blog.author_id !== userId) {
      throw new ForbiddenException('Bài viết chưa được xuất bản hoặc bạn không có quyền truy cập');
    }
    return { blog, message: 'Lấy chi tiết bài viết thành công' };
  }

  async getPublicBlogById(id: string) {
    const blog = await this.prisma.blogPost.findUnique({
      where: { post_id: id, deleted_at: null },
      select: {
        post_id: true,
        title: true,
        content: true,
        category: true,
        author: { select: { full_name: true } },
        is_published: true,
        views_count: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!blog) throw new BadRequestException('Bài viết không tồn tại');
    if (!blog.is_published) throw new ForbiddenException('Bài viết chưa được xuất bản');

    return { blog, message: 'Lấy chi tiết bài viết công khai thành công' };
  }


  async getRelatedBlogs(category: string, postId?: string) {
    if (!category?.trim()) {
      throw new BadRequestException('Danh mục là bắt buộc');
    }

    const decodedCategory = decodeURIComponent(category).trim();

    const result = await this.prisma.$queryRawUnsafe<any>(`
    SELECT 
      bp.post_id, bp.title, bp.content, bp.category, 
      bp.is_published, bp.views_count, bp.created_at, bp.updated_at,
      u.full_name as author_full_name
    FROM \`BlogPost\` bp
    LEFT JOIN \`User\` u ON u.user_id = bp.author_id
    WHERE bp.deleted_at IS NULL
      AND bp.is_published = true
      AND bp.category LIKE CONCAT('%', ?, '%')
      ${postId ? `AND bp.post_id != ?` : ''}
    ORDER BY bp.created_at DESC
    LIMIT 6
  `, ...(postId ? [decodedCategory, postId] : [decodedCategory]));

    const blogs = result.map(row => ({
      post_id: row.post_id,
      title: row.title,
      content: row.content,
      category: row.category,
      is_published: row.is_published,
      views_count: row.views_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        full_name: row.author_full_name,
      },
    }));

    return {
      blogs,
      message: blogs.length > 0
        ? 'Lấy danh sách bài viết liên quan thành công'
        : `Không tìm thấy bài viết liên quan với danh mục "${decodedCategory}"`,
    };
  }




  async updateBlog(id: string, dto: UpdateBlogDto, userId: string, role: Role) {
    const blog = await this.prisma.blogPost.findUnique({ where: { post_id: id } });
    if (!blog) {
      throw new BadRequestException('Bài viết không tồn tại');
    }

    if (role === Role.Customer) {
      throw new BadRequestException('Khách hàng không có quyền chỉnh sửa bài viết');
    }
    if (role === Role.Consultant && blog.author_id !== userId) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa bài viết của chính bạn');
    }

    const updatedBlog = await this.prisma.blogPost.update({
      where: { post_id: id },
      data: { ...dto, updated_at: new Date() },
    });

    this.logger.log(`Cập nhật bài viết ${id} bởi ${userId}`);
    return { blog: updatedBlog, message: 'Cập nhật bài viết thành công' };
  }

  async deleteBlog(id: string, userId: string, role: Role) {
    const blog = await this.prisma.blogPost.findUnique({ where: { post_id: id } });
    if (!blog) {
      throw new BadRequestException('Bài viết không tồn tại');
    }

    if (role === Role.Customer) {
      throw new BadRequestException('Khách hàng không có quyền xóa bài viết');
    }
    if (role === Role.Consultant && blog.author_id !== userId) {
      throw new BadRequestException('Chỉ có thể xóa bài viết của chính bạn');
    }

    const updatedBlog = await this.prisma.blogPost.update({
      where: { post_id: id },
      data: { deleted_at: new Date() },
    });

    this.logger.log(`Xóa bài viết ${id} bởi ${userId}`);
    return { blog: updatedBlog, message: 'Xóa bài viết thành công' };
  }

  async approveBlog(id: string, dto: ApproveBlogDto, userRole: string) {
    if (userRole !== Role.Staff && userRole !== Role.Manager) {
      throw new BadRequestException('Không có quyền truy cập');
    }

    const blog = await this.prisma.blogPost.findUnique({ where: { post_id: id, deleted_at: null } });
    if (!blog || blog.is_published) {
      throw new BadRequestException('Bài viết không tồn tại hoặc đã được duyệt');
    }

    const updatedBlog = await this.prisma.blogPost.update({
      where: { post_id: id },
      data: { is_published: true, updated_at: new Date() },
    });

    this.logger.log(`Duyệt bài viết ${id} bởi ${userRole}`);
    return { blog: updatedBlog, message: 'Duyệt bài viết thành công' };
  }
}