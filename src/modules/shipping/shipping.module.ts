import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ShippingController } from '../shipping/controllers/shipping.controller'
import { GhnService } from '../shipping/services/ghn.service'
import { ShippingService } from '../shipping/services/shipping.service'
import { PrismaModule } from '@/prisma/prisma.module' 
@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [ShippingController],
  providers: [GhnService, ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
