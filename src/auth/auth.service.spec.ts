import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { create: jest.Mock<UsersService['create']> };

  beforeEach(async () => {
    usersService = { create: jest.fn<UsersService['create']>() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: UsersService, useValue: usersService }],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('stores a bcrypt hash and returns only safe fields', async () => {
    const createdAt = new Date();
    usersService.create.mockImplementation(async (email, passwordHash) => ({
      id: 1,
      email,
      passwordHash,
      createdAt,
    }));

    const result = await service.register({ email: 'ana@example.com', password: 'aprendo-nest-2026' });

    const [, passwordHash] = usersService.create.mock.calls[0];
    expect(passwordHash).not.toBe('aprendo-nest-2026');
    expect(passwordHash).toMatch(/^\$2[aby]\$12\$/);
    await expect(bcrypt.compare('aprendo-nest-2026', passwordHash)).resolves.toBe(true);
    expect(result).toEqual({ id: 1, email: 'ana@example.com', createdAt });
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('propagates a duplicate email conflict', async () => {
    usersService.create.mockRejectedValue(new ConflictException('Email already registered'));

    await expect(
      service.register({ email: 'ana@example.com', password: 'otra-clave-2026' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
