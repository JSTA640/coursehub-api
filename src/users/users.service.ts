import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  // Recibe un hash ya calculado: este servicio nunca ve la contraseña original.
  async create(email: string, passwordHash: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const user = this.usersRepository.create({ email, passwordHash });
    try {
      return await this.usersRepository.save(user);
    } catch (error: unknown) {
      // La restricción unique de PostgreSQL resuelve carreras entre solicitudes.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('driverError' in error)) {
    return false;
  }
  const driverError = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === '23505'
  );
}
