import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { UserRole } from '../users/user-role.enum.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { UpdateCourseUseCase } from './application/use-cases/update-course.use-case.js';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-thirty-two-characters';

// Cuentas de práctica ficticias: nunca reutilizar credenciales reales.
const admin: AuthenticatedUser = { id: 1, email: 'admin@example.com', role: UserRole.ADMIN };
const owner: AuthenticatedUser = { id: 2, email: 'docente@example.com', role: UserRole.TEACHER };
const otherTeacher: AuthenticatedUser = { id: 3, email: 'otro@example.com', role: UserRole.TEACHER };
const student: AuthenticatedUser = { id: 4, email: 'estudiante@example.com', role: UserRole.STUDENT };

// El curso 10 pertenece al docente "owner"; el mock replica la regla real de propiedad.
const course = { id: 10, title: 'Databases', level: 'beginner', createdByUserId: owner.id };

type AnyAsync = (...args: unknown[]) => Promise<unknown>;

describe('Courses authorization (roles + ownership)', () => {
  const jwtService = new JwtService({ secret: JWT_SECRET, signOptions: { expiresIn: '15m' } });
  let app: INestApplication;
  let coursesService: {
    create: jest.Mock<AnyAsync>;
    remove: jest.Mock<AnyAsync>;
  };
  let updateCourse: { execute: jest.Mock<AnyAsync> };

  const tokenFor = (user: AuthenticatedUser) =>
    jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });

  beforeEach(async () => {
    coursesService = {
      create: jest.fn<AnyAsync>(async (dto, actor) => ({
        id: 11,
        ...(dto as object),
        createdByUserId: (actor as AuthenticatedUser).id,
      })),
      remove: jest.fn<AnyAsync>(async () => course),
    };
    updateCourse = {
      execute: jest.fn<AnyAsync>(async (_id, dto, actor) => {
        const user = actor as AuthenticatedUser;
        if (user.role !== UserRole.ADMIN && user.id !== course.createdByUserId) {
          throw new ForbiddenException('You cannot modify this course');
        }
        return { ...course, ...(dto as object) };
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [CoursesController],
      providers: [
        { provide: CoursesService, useValue: coursesService },
        { provide: UpdateCourseUseCase, useValue: updateCourse },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET }) },
        JwtAuthGuard,
        RolesGuard,
        JwtStrategy,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function send(
    method: 'post' | 'patch' | 'delete',
    path: string,
    user?: AuthenticatedUser,
    body?: object,
  ) {
    let req = request(app.getHttpServer())[method](path);
    if (user) req = req.set('Authorization', `Bearer ${await tokenFor(user)}`);
    return body ? req.send(body) : req;
  }

  describe('POST /courses', () => {
    const body = { title: 'Databases', level: 'beginner' };

    it('returns 401 without a token and does not call the service', async () => {
      expect((await send('post', '/courses', undefined, body)).status).toBe(401);
      expect(coursesService.create).not.toHaveBeenCalled();
    });

    it('returns 403 for a student', async () => {
      expect((await send('post', '/courses', student, body)).status).toBe(403);
      expect(coursesService.create).not.toHaveBeenCalled();
    });

    it('returns 201 for a teacher and passes the authenticated identity as owner', async () => {
      const response = await send('post', '/courses', owner, body);

      expect(response.status).toBe(201);
      expect(coursesService.create).toHaveBeenCalledWith(body, owner);
      expect(response.body.createdByUserId).toBe(owner.id);
    });

    it('returns 400 when the client tries to choose the owner in the body', async () => {
      const response = await send('post', '/courses', otherTeacher, {
        ...body,
        createdByUserId: owner.id,
      });

      expect(response.status).toBe(400);
      expect(coursesService.create).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid course DTO even with a valid token', async () => {
      const response = await send('post', '/courses', admin, {
        title: '',
        level: 'not-a-course-level',
      });

      expect(response.status).toBe(400);
      expect(coursesService.create).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /courses/:id', () => {
    const path = `/courses/${course.id}`;
    const body = { title: 'SQL' };

    it('returns 401 without a token', async () => {
      expect((await send('patch', path, undefined, body)).status).toBe(401);
      expect(updateCourse.execute).not.toHaveBeenCalled();
    });

    it('returns 403 for a student before reaching the service', async () => {
      expect((await send('patch', path, student, body)).status).toBe(403);
      expect(updateCourse.execute).not.toHaveBeenCalled();
    });

    it('returns 403 for a teacher who does not own the course', async () => {
      const response = await send('patch', path, otherTeacher, body);

      expect(response.status).toBe(403);
      expect(updateCourse.execute).toHaveBeenCalledWith(course.id, body, otherTeacher);
    });

    it('returns 200 for the owning teacher', async () => {
      const response = await send('patch', path, owner, body);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('SQL');
    });

    it('returns 200 for an admin', async () => {
      expect((await send('patch', path, admin, body)).status).toBe(200);
    });

    it('returns 400 when trying to reassign the owner through the body', async () => {
      const response = await send('patch', path, otherTeacher, { createdByUserId: otherTeacher.id });

      expect(response.status).toBe(400);
      expect(updateCourse.execute).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /courses/:id', () => {
    const path = `/courses/${course.id}`;

    it('returns 401 without a token', async () => {
      expect((await send('delete', path)).status).toBe(401);
      expect(coursesService.remove).not.toHaveBeenCalled();
    });

    it('returns 403 for a student', async () => {
      expect((await send('delete', path, student)).status).toBe(403);
      expect(coursesService.remove).not.toHaveBeenCalled();
    });

    it('returns 403 even for the owning teacher (delete is admin-only)', async () => {
      expect((await send('delete', path, owner)).status).toBe(403);
      expect(coursesService.remove).not.toHaveBeenCalled();
    });

    it('returns 200 for an admin', async () => {
      const response = await send('delete', path, admin);

      expect(response.status).toBe(200);
      expect(coursesService.remove).toHaveBeenCalledWith(course.id);
    });
  });
});
