// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { PassportModule } from '@nestjs/passport';
import { JwtModule }     from '@nestjs/jwt';
import { ConfigModule,
         ConfigService } from '@nestjs/config';

import { AuthService      } from './services/auth.service';
import { AuthController   } from './controllers/auth.controller';
import { ProfileController} from './controllers/profile.controller';

import { RolesGuard       } from './guards/roles.guard';
import { JwtStrategy      } from './strategies/jwt.strategy';
import { LocalStrategy    } from './strategies/local.strategy';
import { GoogleStrategy   } from './strategies/google.strategy';

import { PrismaModule     } from '@/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    PrismaModule,
  ],
  controllers: [
    AuthController,
    ProfileController,
    // … thêm các controller khác …
  ],
  providers: [
    AuthService,
    GoogleStrategy,
    LocalStrategy,
    JwtStrategy,
    // Đăng ký RolesGuard toàn cục
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}
