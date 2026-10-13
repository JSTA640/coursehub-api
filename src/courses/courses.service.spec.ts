import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from './entities/course.entity.js';
import { CoursesService } from './courses.service.js';

describe('CoursesService', () => {
  let service: CoursesService;
  let repository: { findAndCount: jest.Mock };

  beforeEach(async () => {
    repository = { findAndCount: jest.fn() };
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
});
