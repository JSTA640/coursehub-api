import type { UserRole } from '../../users/user-role.enum.js';

export type JwtPayload = {
  sub: number;
  email: string;
  role: UserRole;
};

// Identidad mínima para autorizar: id (propiedad) y role (permisos).
export type AuthenticatedUser = {
  id: number;
  email: string;
  role: UserRole;
};
