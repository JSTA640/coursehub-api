import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: jest.Mock<UsersService['create']>;
    findByEmailWithPassword: jest.Mock<UsersService['findByEmailWithPassword']>;
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn<UsersService['create']>(),
      findByEmailWithPassword: jest.fn<UsersService['findByEmailWithPassword']>(),
    };
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

  it('authenticates a user and returns only safe fields', async () => {
    const password = 'aprendo-nest-2026';
    const passwordHash = await bcrypt.hash(password, 4);
    const user: User = {
      id: 1,
      email: 'ana@example.com',
      passwordHash,
      createdAt: new Date(),
    };
    usersService.findByEmailWithPassword.mockResolvedValue(user);

    const result = await service.login({ email: user.email, password });

    expect(usersService.findByEmailWithPassword).toHaveBeenCalledWith(user.email);
    expect(result).toEqual({ id: user.id, email: user.email, createdAt: user.createdAt });
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('rejects an incorrect password with a generic unauthorized response', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 1,
      email: 'ana@example.com',
      passwordHash: await bcrypt.hash('aprendo-nest-2026', 4),
      createdAt: new Date(),
    });

    await expect(
      service.login({ email: 'ana@example.com', password: 'otra-clave-2026' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });

  it('rejects a missing user with the same generic unauthorized response', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'aprendo-nest-2026' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });
});
