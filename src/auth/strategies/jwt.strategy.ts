import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser, JwtPayload } from '../types/jwt-payload.type.js';
import { UserRole } from '../../users/user-role.enum.js';

const VALID_ROLES = new Set<string>(Object.values(UserRole));

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (
      typeof payload.sub !== 'number' ||
      typeof payload.email !== 'string' ||
      payload.email.length === 0 ||
      typeof payload.role !== 'string' ||
      !VALID_ROLES.has(payload.role)
    ) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
