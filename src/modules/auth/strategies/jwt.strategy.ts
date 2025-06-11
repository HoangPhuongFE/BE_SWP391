import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const jwtSecret = config.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in configuration');
    }
    console.log('JwtStrategy initialized with secret:', jwtSecret);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    console.log('JwtStrategy - Payload:', payload); // Thêm log
    if (!payload.sub || !payload.email || !payload.role) {
      console.log('JwtStrategy - Invalid payload:', payload);
      throw new UnauthorizedException('Token payload không hợp lệ');
    }
    const user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    console.log('JwtStrategy - Returning user:', user); // Thêm log
    return user;
  }
}