import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from './entities/course.entity.js';
import { CoursesService } from './courses.service.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { UserRole } from '../users/user-role.enum.js';

type AnyFn = (...args: unknown[]) => unknown;
type AsyncFn = (...args: unknown[]) => Promise<unknown>;

describe('CoursesService', () => {
  let service: CoursesService;
  let repository: {
    findAndCount: jest.Mock<AsyncFn>;
    findOneBy: jest.Mock<AsyncFn>;
    create: jest.Mock<AnyFn>;
    save: jest.Mock<AnyFn>;
    remove: jest.Mock<AsyncFn>;
  };

  beforeEach(async () => {
    repository = {
      findAndCount: jest.fn<AsyncFn>(),
      findOneBy: jest.fn<AsyncFn>(),
      create: jest.fn<AnyFn>((data) => ({ ...(data as object) })),
      save: jest.fn<AnyFn>(async (entity) => entity),
      remove: jest.fn<AsyncFn>(async () => undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: getRepositoryToken(Course), useValue: repository },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a filtered and ordered page with pagination metadata', async () => {
    const courses = [{ id: 2, title: 'Databases', level: 'beginner' }];
    repository.findAndCount.mockResolvedValue([courses, 12]);

    await expect(service.findAll({
      level: 'beginner',
      page: 2,
      limit: 5,
      sortBy: 'title',
      order: 'DESC',
    })).resolves.toEqual({
      items: courses,
      meta: { total: 12, page: 2, limit: 5, totalPages: 3 },
    });
    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: { level: 'beginner' },
      order: { title: 'DESC' },
      skip: 5,
      take: 5,
    });
  });

  it('applies defaults and reports zero pages when no courses match', async () => {
    repository.findAndCount.mockResolvedValue([[], 0]);

    await expect(service.findAll({
      page: 1,
      limit: 10,
      sortBy: 'id',
      order: 'ASC',
    })).resolves.toEqual({
      items: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: {},
      order: { id: 'ASC' },
      skip: 0,
      take: 10,
    });
  });

  // Sesión 24: ramas detectadas sin cubrir con `npm run test:cov` (líneas 39-41 y 51-69).
  describe('findOne and remove', () => {
    const course = { id: 7, title: 'NestJS', level: 'beginner', createdByUserId: 4 };

    it('returns 404 with the course id when the course does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        new NotFoundException('El curso con ID 999 no existe'),
      );
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 999 });
    });

    it('removes an existing course and returns it', async () => {
      repository.findOneBy.mockResolvedValue(course);

      await expect(service.remove(7)).resolves.toBe(course);
      expect(repository.remove).toHaveBeenCalledWith(course);
    });

    it('does not try to remove a course that does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('rejects deleting a course with enrollments with 409 (foreign key 23503)', async () => {
      repository.findOneBy.mockResolvedValue(course);
      repository.remove.mockRejectedValue({ driverError: { code: '23503' } });

      await expect(service.remove(7)).rejects.toThrow(
        new ConflictException('No se puede eliminar un curso con matrículas existentes.'),
      );
    });

    it('rethrows unexpected database errors instead of hiding them as 409', async () => {
      const failure = { driverError: { code: '57P01' } };
      repository.findOneBy.mockResolvedValue(course);
      repository.remove.mockRejectedValue(failure);

      await expect(service.remove(7)).rejects.toBe(failure);
    });

    it('rethrows errors without a driverError unchanged', async () => {
      const failure = new Error('connection lost');
      repository.findOneBy.mockResolvedValue(course);
      repository.remove.mockRejectedValue(failure);

      await expect(service.remove(7)).rejects.toBe(failure);
    });
  });

  // La regla de edición vive ahora en UpdateCourseUseCase (ver su spec).
  describe('ownership on create', () => {
    const owner: AuthenticatedUser = { id: 2, email: 'docente@example.com', role: UserRole.TEACHER };

    it('stores the authenticated user as owner on create', async () => {
      await service.create({ title: 'Databases', level: 'beginner' }, owner);

      expect(repository.create).toHaveBeenCalledWith({
        title: 'Databases',
        level: 'beginner',
        createdByUserId: owner.id,
      });
    });
  });
});
