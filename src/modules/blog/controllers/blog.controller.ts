import { Controller, Post, Get, Put, Delete, Body, Param, Req, UseGuards, HttpCode, Query } from '@nestjs/common';
import { BlogService } from '../services/blog.service';
import { CreateBlogDto } from '../dtos/create-blog.dto';
import { UpdateBlogDto } from '../dtos/update-blog.dto';
import { ApproveBlogDto } from '../dtos/approve-blog.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { Role } from '@prisma/client';

@ApiTags('blogs')
@Controller('blogs')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @Roles(Role.Staff, Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo bài viết mới' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateBlogDto })
  async createBlog(@Body() dto: CreateBlogDto, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.blogService.createBlog(dto, userId, role);
  }

  @Get()
  @Roles(Role.Staff, Role.Manager, Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy tất cả bài viết đã xuất bản (đăng nhập)' })
  @ApiBearerAuth('access-token')
  async getAllBlogs() {
    return this.blogService.getAllBlogs();
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Lấy tất cả bài viết đã xuất bản cho guest/customer' })
  async getPublicBlogs() {
    return this.blogService.getAllPublicBlogs();
  }

  @Get('pending')
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy danh sách bài viết của Consultant chưa duyệt' })
  @ApiBearerAuth('access-token')
  async getPendingBlogs() {
    return this.blogService.getPendingBlogs();
  }

  @Get(':id')
  @Roles(Role.Staff, Role.Manager, Role.Customer, Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xem chi tiết bài viết theo ID (đăng nhập)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID bài viết' })
  async getBlogById(@Param('id') id: string, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.blogService.getBlogById(id, userId, role);
  }

  @Get('public/:id')
  @Public()
  @ApiOperation({ summary: 'Xem chi tiết bài viết công khai theo ID cho guest/customer' })
  @ApiParam({ name: 'id', description: 'ID bài viết' })
  async getPublicBlogById(@Param('id') id: string) {
    return this.blogService.getPublicBlogById(id);
  }

  @Put(':id')
  @Roles(Role.Staff, Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật bài viết' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateBlogDto })
  @ApiParam({ name: 'id', description: 'ID bài viết' })
  async updateBlog(@Param('id') id: string, @Body() dto: UpdateBlogDto, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.blogService.updateBlog(id, dto, userId, role);
  }

  @Delete(':id')
  @Roles(Role.Staff, Role.Consultant)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xóa bài viết (xóa mềm)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID bài viết' })
  @HttpCode(204)
  async deleteBlog(@Param('id') id: string, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.blogService.deleteBlog(id, userId, role);
  }

  @Put(':id/approve')
  @Roles(Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Duyệt bài viết' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: ApproveBlogDto })
  @ApiParam({ name: 'id', description: 'ID bài viết' })
  async approveBlog(@Param('id') id: string, @Body() dto: ApproveBlogDto, @Req() req) {
    const userRole = (req.user as any).role;
    return this.blogService.approveBlog(id, dto, userRole);
  }
}