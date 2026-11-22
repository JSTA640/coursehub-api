import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import type { AuthenticatedUser } from '../../../auth/types/jwt-payload.type.js';
import { UserRole } from '../../../users/user-role.enum.js';
import type { Course } from '../../entities/course.entity.js';
import { COURSE_REPOSITORY, type CourseRepository } from '../ports/course.repository.js';
import { UpdateCourseUseCase } from './update-course.use-case.js';

// Sesión 23 · Reglas de negocio con Jest y un repositorio SIMULADO.
// El objeto `courses` sustituye al adaptador TypeORM: no hay HTTP ni PostgreSQL.
// Cada prueba sigue Arrange → Act → Assert y protege una sola regla.

const admin: AuthenticatedUser = { id: 1, email: 'admin@example.com', role: UserRole.ADMIN };
const ownerTeacher: AuthenticatedUser = { id: 4, email: 'docente@example.com', role: UserRole.TEACHER };
const otherTeacher: AuthenticatedUser = { id: 9, email: 'otro@example.com', role: UserRole.TEACHER };

function buildCourse(overrides: Partial<Course> = {}): Course {
  return { id: 7, title: 'NestJS', level: 'beginner', createdByUserId: ownerTeacher.id, ...overrides } as Course;
}

describe('UpdateCourseUseCase (with a mocked repository)', () => {
  const courses = {
    findById: jest.fn<CourseRepository['findById']>(),
    save: jest.fn<CourseRepository['save']>(),
  };
  let useCase: UpdateCourseUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UpdateCourseUseCase, { provide: COURSE_REPOSITORY, useValue: courses }],
    }).compile();

    useCase = module.get(UpdateCourseUseCase);
    // Los mocks se comparten entre pruebas: se limpian para que ninguna dependa de otra.
    jest.clearAllMocks();
  });

  it('allows the owner teacher to update a course', async () => {
    // Arrange
    const course = buildCourse();
    courses.findById.mockResolvedValue(course);
    courses.save.mockImplementation(async (value) => value);

    // Act
    const result = await useCase.execute(7, { title: 'NestJS avanzado' }, ownerTeacher);

    // Assert
    expect(result.title).toBe('NestJS avanzado');
    expect(courses.findById).toHaveBeenCalledWith(7);
    expect(courses.save).toHaveBeenCalledTimes(1);
    expect(courses.save).toHaveBeenCalledWith(course);
  });

  it('allows an admin to update a course created by someone else', async () => {
    courses.findById.mockResolvedValue(buildCourse());
    courses.save.mockImplementation(async (value) => value);

    const result = await useCase.execute(7, { level: 'advanced' }, admin);

    expect(result.level).toBe('advanced');
    expect(courses.save).toHaveBeenCalledTimes(1);
  });

  it('responds 404 when the course does not exist and saves nothing', async () => {
    courses.findById.mockResolvedValue(null);

    await expect(useCase.execute(999, { title: 'Cambio' }, admin)).rejects.toThrow(
      new NotFoundException('El curso con ID 999 no existe'),
    );

    expect(courses.save).not.toHaveBeenCalled();
  });

  it('rejects an update from a different teacher', async () => {
    courses.findById.mockResolvedValue(buildCourse());

    await expect(useCase.execute(7, { title: 'Cambio' }, otherTeacher)).rejects.toThrow(
      ForbiddenException,
    );

    // Un 403 no basta: la regla está incompleta si se guardó antes de rechazar.
    expect(courses.save).not.toHaveBeenCalled();
  });

  it('rejects teachers on legacy courses without an owner', async () => {
    courses.findById.mockResolvedValue(buildCourse({ createdByUserId: null }));

    await expect(useCase.execute(7, { title: 'Cambio' }, ownerTeacher)).rejects.toThrow(
      ForbiddenException,
    );

    expect(courses.save).not.toHaveBeenCalled();
  });
});
