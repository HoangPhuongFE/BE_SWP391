import { Module } from '@nestjs/common';
import { BlogCommentService } from './services/blog-comment.service';
import { BlogCommentController } from './controllers/blog-comment.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule],
  controllers: [BlogCommentController],
  providers: [BlogCommentService],
})
export class BlogCommentModule {}