import { Controller, Post, Get, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { BlogCommentService } from '../services/blog-comment.service';
import { CreateCommentDto } from '../dtos/create-comment.dto';
import { UpdateCommentDto } from '../dtos/update-comment.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('blog-comments')
@Controller('blog-comments')
export class BlogCommentController {
  constructor(private readonly blogCommentService: BlogCommentService) {}

  @Post(':postId')
  @Roles(Role.Customer)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Tạo bình luận hoặc phản hồi cho bài viết' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateCommentDto })
  @ApiParam({ name: 'postId', description: 'ID bài viết' })
  async createComment(@Param('postId') postId: string, @Body() dto: CreateCommentDto, @Req() req) {
    const userId = (req.user as any).userId;
    return this.blogCommentService.createComment(postId, dto, userId);
  }

  @Get(':postId')
  @Roles(Role.Customer, Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy tất cả bình luận và phản hồi của bài viết' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'postId', description: 'ID bài viết' })
  async getCommentsByPostId(@Param('postId') postId: string) {
    return this.blogCommentService.getCommentsByPostId(postId);
  }

  @Get(':id/replies')
  @Roles(Role.Customer, Role.Staff, Role.Manager)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lấy tất cả phản hồi của một bình luận' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID bình luận' })
  async getRepliesByCommentId(@Param('id') id: string) {
    return this.blogCommentService.getRepliesByCommentId(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cập nhật bình luận' })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateCommentDto })
  @ApiParam({ name: 'id', description: 'ID bình luận' })
  async updateComment(@Param('id') id: string, @Body() dto: UpdateCommentDto, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.blogCommentService.updateComment(id, dto, userId, role);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Xóa bình luận (xóa mềm)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID bình luận' })
  async deleteComment(@Param('id') id: string, @Req() req) {
    const userId = (req.user as any).userId;
    const role = (req.user as any).role;
    return this.blogCommentService.deleteComment(id, userId, role);
  }
}