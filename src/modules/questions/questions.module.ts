import { Module } from '@nestjs/common';
import { QuestionsController } from './controllers/questions.controller';
import { QuestionsService } from './services/questions.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}