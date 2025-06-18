// src/modules/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string;
  userId: string;
  email: string;
  role: string;
  fullName: string;
  isVerified: boolean;
  isActive: boolean;
}