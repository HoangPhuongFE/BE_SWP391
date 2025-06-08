// src/modules/auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Lấy mảng roles từ metadata trên handler
    const requiredRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      ctx.getHandler(),
    );
    // Nếu không có @Roles() trên method, cho qua
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.role) {
      throw new ForbiddenException('User chưa xác thực hoặc không có role');
    }

    // Nếu role của user nằm trong requiredRoles, cho phép
    if (requiredRoles.includes(user.role)) {
      return true;
    }

    throw new ForbiddenException('Bạn không có quyền truy cập');
  }
}
