import { Module } from '@nestjs/common';
import { GoogleStrategy } from '../strategies/google.strategy';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { PassportModule } from '@nestjs/passport/dist/passport.module';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy],
})
export class AuthModule {}
