import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto.js';
import { UsersService } from '../users/users.service.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create(dto.email, passwordHash);

    // Respuesta construida a mano: nunca incluye password ni passwordHash.
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
