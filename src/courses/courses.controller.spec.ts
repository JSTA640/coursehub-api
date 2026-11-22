import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { PassportModule } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { UserRole } from '../users/user-role.enum.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { UpdateCourseUseCase } from './application/use-cases/update-course.use-case.js';
import { CoursesQueryDto } from './dto/courses-query.dto.js';

// Sesión 24 · Pruebas del controlador como puente HTTP.
// Se simulan sus dependencias (CoursesService y UpdateCourseUseCase), nunca el
// propio controlador. Aquí NO se prueba la regla de propiedad (eso es del caso de
// uso): se prueba que el controlador no pierde el id, no altera el DTO, entrega la
// identidad autenticada y deja pasar los errores sin convertirlos en un falso 200.

type AnyAsync = (...args: unknown[]) => Promise<unknown>;
type AuthenticatedRequest = Request & { user: AuthenticatedUser };

const teacher: AuthenticatedUser = { id: 4, email: 'docente@example.com', role: UserRole.TEACHER };
const admin: AuthenticatedUser = { id: 1, email: 'admin@example.com', role: UserRole.ADMIN };

// Lo que el JwtAuthGuard deja en la solicitud tras validar el token.
const requestFrom = (user: AuthenticatedUser) => ({ user }) as AuthenticatedRequest;

describe('CoursesController', () => {
  const coursesService = {
    findAll: jest.fn<AnyAsync>(),
    findOne: jest.fn<AnyAsync>(),
    create: jest.fn<AnyAsync>(),
    remove: jest.fn<AnyAsync>(),
  };
  const updateCourse = { execute: jest.fn<AnyAsync>() };
  let controller: CoursesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [CoursesController],
      providers: [
        { provide: CoursesService, useValue: coursesService },
        { provide: UpdateCourseUseCase, useValue: updateCourse },
      ],
    }).compile();

    controller = module.get(CoursesController);
    jest.clearAllMocks();
  });

  describe('update (PATCH /courses/:id)', () => {
    it('delegates update with the id, body and authenticated user', async () => {
      const dto = { title: 'NestJS avanzado' };
      updateCourse.execute.mockResolvedValue({ id: 7, ...dto });

      await expect(controller.update(7, dto, requestFrom(teacher))).resolves.toEqual({
        id: 7,
        ...dto,
      });
      expect(updateCourse.execute).toHaveBeenCalledTimes(1);
      expect(updateCourse.execute).toHaveBeenCalledWith(7, dto, teacher);
    });

    it('does not modify the body before passing it to the use case', async () => {
      const dto = { title: 'SQL', level: 'advanced' };
      const snapshot = { ...dto };
      updateCourse.execute.mockResolvedValue({ id: 7, ...dto });

      await controller.update(7, dto, requestFrom(teacher));

      expect(dto).toEqual(snapshot);
      expect(updateCourse.execute.mock.calls[0][1]).toBe(dto);
    });

    it('propagates a ForbiddenException from the use case instead of returning a fake 200', async () => {
      updateCourse.execute.mockRejectedValue(new ForbiddenException('You cannot modify this course'));

      await expect(controller.update(7, { title: 'Cambio' }, requestFrom(teacher))).rejects.toThrow(
        new ForbiddenException('You cannot modify this course'),
      );
    });

    it('propagates a NotFoundException from the use case', async () => {
      updateCourse.execute.mockRejectedValue(new NotFoundException('El curso con ID 999 no existe'));

      await expect(controller.update(999, { title: 'Cambio' }, requestFrom(admin))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not use CoursesService for updates', async () => {
      updateCourse.execute.mockResolvedValue({ id: 7 });

      await controller.update(7, { title: 'SQL' }, requestFrom(admin));

      for (const method of Object.values(coursesService)) expect(method).not.toHaveBeenCalled();
    });
  });

  describe('read and write delegation to CoursesService', () => {
    it('passes the validated query DTO to findAll', async () => {
      const query = Object.assign(new CoursesQueryDto(), {
        level: 'beginner',
        page: 2,
        limit: 5,
        sortBy: 'title',
        order: 'DESC',
      });
      const page = { items: [], meta: { total: 0, page: 2, limit: 5, totalPages: 0 } };
      coursesService.findAll.mockResolvedValue(page);

      await expect(controller.findAll(query)).resolves.toBe(page);
      expect(coursesService.findAll).toHaveBeenCalledWith(query);
    });

    it('delegates findOne with the parsed id and propagates its 404', async () => {
      coursesService.findOne.mockRejectedValue(new NotFoundException('El curso con ID 5 no existe'));

      await expect(controller.findOne(5)).rejects.toThrow(NotFoundException);
      expect(coursesService.findOne).toHaveBeenCalledWith(5);
    });

    it('delegates create with the body and the authenticated user as owner', async () => {
      const dto = { title: 'Databases', level: 'beginner' };
      coursesService.create.mockResolvedValue({ id: 11, ...dto, createdByUserId: teacher.id });

      await expect(controller.create(dto, requestFrom(teacher))).resolves.toMatchObject({
        createdByUserId: teacher.id,
      });
      expect(coursesService.create).toHaveBeenCalledWith(dto, teacher);
    });

    it('delegates remove with the parsed id', async () => {
      coursesService.remove.mockResolvedValue({ id: 7 });

      await expect(controller.remove(7)).resolves.toEqual({ id: 7 });
      expect(coursesService.remove).toHaveBeenCalledWith(7);
    });
  });
});
