// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private _menstrualCycle: any;
  public get menstrualCycle(): any {
    return this._menstrualCycle;
  }
  public set menstrualCycle(value: any) {
    this._menstrualCycle = value;
  }
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    (this as any).$on('beforeExit', async () => {
        await app.close();
      });
      
      
  }
}
