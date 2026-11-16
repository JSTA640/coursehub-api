import { jest } from '@jest/globals';
import type { Repository } from 'typeorm';
import type { Course } from '../entities/course.entity.js';
import { TypeOrmCourseRepository } from './typeorm-course.repository.js';

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

describe('TypeOrmCourseRepository (adapter)', () => {
  const stored = { id: 10, title: 'Databases', level: 'beginner', createdByUserId: 2 } as Course;
  let typeorm: { findOneBy: jest.Mock<AsyncFn>; save: jest.Mock<AsyncFn> };
  let adapter: TypeOrmCourseRepository;

  beforeEach(() => {
    typeorm = {
      findOneBy: jest.fn<AsyncFn>(async () => stored),
      save: jest.fn<AsyncFn>(async (entity) => entity),
    };
    adapter = new TypeOrmCourseRepository(typeorm as unknown as Repository<Course>);
  });

  it('translates findById to TypeORM findOneBy', async () => {
    await expect(adapter.findById(10)).resolves.toBe(stored);
    expect(typeorm.findOneBy).toHaveBeenCalledWith({ id: 10 });
  });

  it('returns null when TypeORM finds nothing', async () => {
    typeorm.findOneBy.mockResolvedValue(null);

    await expect(adapter.findById(99)).resolves.toBeNull();
  });

  it('delegates save to TypeORM save', async () => {
    await expect(adapter.save(stored)).resolves.toBe(stored);
    expect(typeorm.save).toHaveBeenCalledWith(stored);
  });
});
