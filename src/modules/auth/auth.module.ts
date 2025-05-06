// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';

import { PrismaModule } from '@/prisma/prisma.module'; 

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, FacebookStrategy],
})
export class AuthModule {}
