import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user-role.enum.js';

export const ROLES_KEY = 'roles';

// Solo declara la política junto a la ruta; RolesGuard es quien la aplica.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
