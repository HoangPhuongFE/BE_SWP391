// src/modules/cycles/cycle.module.ts
import { Module } from '@nestjs/common';
import { CycleController } from './controllers/cycle.controller';
import { CycleService } from './services/cycle.service';
import { CycleCron } from './cron/cycle.cron';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [CycleController],
  providers: [CycleService, CycleCron],
})
export class CycleModule {}