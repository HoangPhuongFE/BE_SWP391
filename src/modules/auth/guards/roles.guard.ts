import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, ctx.getHandler());
    console.log('RolesGuard - Required roles:', requiredRoles);

    if (!requiredRoles || requiredRoles.length === 0) {
      console.log('RolesGuard - No roles required, allowing access');
      return true;
    }

    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    console.log('RolesGuard - Full request.user object:', user);
    console.log('RolesGuard - Request headers:', request.headers);

    if (!user) {
      console.log('RolesGuard - No user found in request');
      throw new ForbiddenException('User chưa xác thực');
    }

    if (!user.role) {
      console.log('RolesGuard - User object missing role:', user);
      throw new ForbiddenException('User không có role');
    }

    if (requiredRoles.includes(user.role)) {
      console.log('RolesGuard - User role matches required roles');
      return true;
    }

    console.log('RolesGuard - User role does not match required roles');
    throw new ForbiddenException('Bạn không có quyền truy cập');
  }
}