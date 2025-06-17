import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GhtkService } from './services/ghtk.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [GhtkService],
  exports: [GhtkService],
})
export class GhtkModule {}
