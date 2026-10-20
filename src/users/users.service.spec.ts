import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    create: jest.Mock;
    findOneBy: jest.Mock;
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((user) => user),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repository }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('creates a user with the given hash', async () => {
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockImplementation(async (user) => ({ id: 1, ...(user as object) }));

    await expect(service.create('ana@example.com', '$2b$12$hash')).resolves.toMatchObject({
      id: 1,
      email: 'ana@example.com',
    });
    expect(repository.create).toHaveBeenCalledWith({
      email: 'ana@example.com',
      passwordHash: '$2b$12$hash',
    });
  });

  it('rejects an email that is already registered', async () => {
    repository.findOneBy.mockResolvedValue({ id: 1, email: 'ana@example.com' });

    await expect(service.create('ana@example.com', '$2b$12$hash')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('selects the password hash only for email authentication', async () => {
    const user = { id: 1, email: 'ana@example.com', passwordHash: '$2b$12$hash' };
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.findByEmailWithPassword('ana@example.com')).resolves.toBe(user);

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
      email: 'ana@example.com',
    });
  });

  it('maps a concurrent unique violation to 409', async () => {
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockRejectedValue({ driverError: { code: '23505' } });

    await expect(service.create('ana@example.com', '$2b$12$hash')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
