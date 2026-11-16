import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../auth/types/jwt-payload.type.js';
import { UserRole } from '../../../users/user-role.enum.js';
import type { Course } from '../../entities/course.entity.js';
import type { CourseRepository } from '../ports/course.repository.js';
import { UpdateCourseUseCase } from './update-course.use-case.js';

// Repositorio falso en memoria: cumple el puerto sin TypeORM, PostgreSQL ni HTTP.
class InMemoryCourseRepository implements CourseRepository {
  readonly saved: Course[] = [];
  private readonly courses = new Map<number, Course>();

  constructor(initial: Course[] = []) {
    for (const course of initial) this.courses.set(course.id, { ...course });
  }

  async findById(id: number): Promise<Course | null> {
    const course = this.courses.get(id);
    return course ? { ...course } : null;
  }

  async save(course: Course): Promise<Course> {
    this.courses.set(course.id, { ...course });
    this.saved.push({ ...course });
    return course;
  }
}

const admin: AuthenticatedUser = { id: 1, email: 'admin@example.com', role: UserRole.ADMIN };
const owner: AuthenticatedUser = { id: 2, email: 'docente@example.com', role: UserRole.TEACHER };
const otherTeacher: AuthenticatedUser = { id: 3, email: 'otro@example.com', role: UserRole.TEACHER };

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: 10,
    title: 'Databases',
    level: 'beginner',
    createdByUserId: owner.id,
    enrollments: [],
    ...overrides,
  } as Course;
}

describe('UpdateCourseUseCase (with an in-memory repository)', () => {
  let repository: InMemoryCourseRepository;
  let useCase: UpdateCourseUseCase;

  beforeEach(() => {
    repository = new InMemoryCourseRepository([course(), course({ id: 20, createdByUserId: null })]);
    // Sin contenedor de Nest: el caso de uso es una clase normal que recibe el puerto.
    useCase = new UpdateCourseUseCase(repository);
  });

  it('lets the owning teacher update the course and persists the change', async () => {
    const result = await useCase.execute(10, { title: 'SQL' }, owner);

    expect(result).toMatchObject({ id: 10, title: 'SQL', level: 'beginner' });
    expect(await repository.findById(10)).toMatchObject({ title: 'SQL' });
  });

  it('lets an admin update a course created by someone else', async () => {
    await expect(useCase.execute(10, { level: 'advanced' }, admin)).resolves.toMatchObject({
      level: 'advanced',
    });
  });

  it('forbids a teacher who does not own the course and saves nothing', async () => {
    await expect(useCase.execute(10, { title: 'SQL' }, otherTeacher)).rejects.toThrow(
      new ForbiddenException('You cannot modify this course'),
    );
    expect(repository.saved).toHaveLength(0);
    expect(await repository.findById(10)).toMatchObject({ title: 'Databases' });
  });

  it('forbids teachers on legacy courses without an owner', async () => {
    await expect(useCase.execute(20, { title: 'SQL' }, owner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('keeps the existing 404 message when the course does not exist', async () => {
    await expect(useCase.execute(999, { title: 'SQL' }, admin)).rejects.toThrow(
      new NotFoundException('El curso con ID 999 no existe'),
    );
  });
});
