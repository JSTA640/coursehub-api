import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Student } from './entities/student.entity.js';
import { StudentsService } from './students.service.js';

describe('StudentsService', () => {
  let service: StudentsService;
  let repository: {
    create: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((student) => student),
      find: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: getRepositoryToken(Student), useValue: repository },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  it('creates a student with a normalized unique email and active default', async () => {
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockImplementation(async (student) => ({ id: 7, ...student }));

    await expect(service.create({
      name: 'Ana Torres',
      email: ' Ana.Torres@Example.edu ',
      age: 20,
      career: 'Software',
      semester: 4,
    })).resolves.toMatchObject({
      id: 7,
      email: 'ana.torres@example.edu',
      isActive: true,
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({ email: 'ana.torres@example.edu' });
  });

  it('rejects an email already used by another student', async () => {
    repository.findOneBy.mockResolvedValue({ id: 1, email: 'ana@example.edu' });

    await expect(service.create({
      name: 'Ana',
      email: 'ANA@example.edu',
      age: 20,
      career: 'Software',
      semester: 4,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('converts a concurrent database email uniqueness violation to conflict', async () => {
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockRejectedValue({
      driverError: {
        code: '23505',
        detail: 'Key (email)=(ana@example.edu) already exists.',
      },
    });

    await expect(service.create({
      name: 'Ana',
      email: 'ana@example.edu',
      age: 20,
      career: 'Software',
      semester: 4,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a student and checks changed emails for conflicts', async () => {
    repository.findOneBy
      .mockResolvedValueOnce({ id: 1, email: 'old@example.edu' })
      .mockResolvedValueOnce({ id: 2, email: 'used@example.edu' });

    await expect(service.update(1, { email: 'used@example.edu' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('combines career, semester, and false active filters', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll({ career: ' Software ', semester: 4, isActive: false });

    const [{ where }] = repository.find.mock.calls[0];
    expect(where.career).toBeDefined();
    expect(where.semester).toBe(4);
    expect(where.isActive).toBe(false);
  });

  it('returns not found for a missing student', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to delete an inactive student', async () => {
    repository.findOneBy.mockResolvedValue({ id: 1, isActive: false });

    await expect(service.remove(1)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('refuses to delete a student with existing enrollments', async () => {
    repository.findOneBy.mockResolvedValue({ id: 1, isActive: true });
    repository.remove.mockRejectedValue({ driverError: { code: '23503' } });

    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
  });
});
