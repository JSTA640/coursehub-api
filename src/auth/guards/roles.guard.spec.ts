import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { UserRole } from '../../users/user-role.enum.js';

function contextFor(user: unknown, handler: () => void = () => undefined): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function handlerWithRoles(...roles: UserRole[]) {
  const handler = () => undefined;
  Reflect.defineMetadata(ROLES_KEY, roles, handler);
  return handler;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without @Roles metadata', () => {
    expect(guard.canActivate(contextFor({ id: 1, role: UserRole.STUDENT }))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    const handler = handlerWithRoles(UserRole.ADMIN, UserRole.TEACHER);
    expect(guard.canActivate(contextFor({ id: 1, role: UserRole.TEACHER }, handler))).toBe(true);
  });

  it('denies a user whose role is not listed', () => {
    const handler = handlerWithRoles(UserRole.ADMIN);
    expect(guard.canActivate(contextFor({ id: 1, role: UserRole.STUDENT }, handler))).toBe(false);
  });

  it('denies when no authenticated user is present', () => {
    const handler = handlerWithRoles(UserRole.ADMIN);
    expect(guard.canActivate(contextFor(undefined, handler))).toBe(false);
  });
});
