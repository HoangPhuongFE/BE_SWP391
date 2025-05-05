import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  // Cách này sẽ tự động ngắt kết nối khi ứng dụng tắt
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
