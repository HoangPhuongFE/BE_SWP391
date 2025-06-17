import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ShippingService } from './services/shipping.service';
import { ShippingController } from './controllers/shipping.controller';
import { GhtkService } from '../ghtk/services/ghtk.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [PrismaService, ShippingService, GhtkService],
  controllers: [ShippingController],
})
export class ShippingModule {}
