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
  };

  beforeEach(async () => {
    repository = {
      findAndCount: jest.fn<AsyncFn>(),
      findOneBy: jest.fn<AsyncFn>(),
      create: jest.fn<AnyFn>((data) => ({ ...(data as object) })),
      save: jest.fn<AnyFn>(async (entity) => entity),
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
