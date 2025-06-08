// src/modules/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
/**
 * Gán metadata về các Role được phép xử lý route này.
 * Ví dụ: @Roles('Admin', 'Manager')
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
