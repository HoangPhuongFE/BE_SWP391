import { Module } from '@nestjs/common';
import { StatsService } from './services/stats.service';
import { StatsController } from './controllers/stats.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}