import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserRole } from '../src/users/user-role.enum.js';
import { createTestApp, resetDatabase, tokenFor } from './utils/e2e-app.js';

// Sesión 25: la operación /courses recorrida por HTTP real (rutas, guards, pipes,
// controlador, caso de uso y PostgreSQL) sobre la base aislada coursehub_test.
describe('Courses (e2e)', () => {
  let app: INestApplication<App>;

  // Preparación: aplicación nueva y base reinicializada en cada caso → no depende del orden.
  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /courses', () => {
    it('returns 200 with an empty page on a fresh database', async () => {
      const response = await request(app.getHttpServer()).get('/courses').expect(200);

      expect(response.body).toEqual({
        items: expect.any(Array),
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });
      expect(response.body.items).toHaveLength(0);
    });

    it('lists the courses created in this case, filtered by level', async () => {
      const token = await tokenFor(app, UserRole.ADMIN);
      const auth = { Authorization: `Bearer ${token}` };
      for (const [title, level] of [
        ['Álgebra', 'beginner'],
        ['Bases de datos', 'intermediate'],
        ['Compiladores', 'advanced'],
      ]) {
        await request(app.getHttpServer()).post('/courses').set(auth).send({ title, level }).expect(201);
      }

      const response = await request(app.getHttpServer())
        .get('/courses?level=intermediate')
        .expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({ id: 2, title: 'Bases de datos', level: 'intermediate' }),
      ]);
      expect(response.body.meta.total).toBe(1);
    });

    it('rejects an invalid query with 400', async () => {
      await request(app.getHttpServer()).get('/courses?limit=500').expect(400);
    });
  });

  describe('POST /courses (authenticated write)', () => {
    it('creates a course as admin and persists it', async () => {
      const token = await tokenFor(app, UserRole.ADMIN);

      const created = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Pruebas e2e con Supertest', level: 'intermediate' })
        .expect(201);

      // La base empieza vacía en cada caso, así que el id es siempre 1: resultado repetible.
      expect(created.body).toMatchObject({
        id: 1,
        title: 'Pruebas e2e con Supertest',
        level: 'intermediate',
        createdByUserId: 1,
      });

      const fetched = await request(app.getHttpServer()).get('/courses/1').expect(200);
      expect(fetched.body).toMatchObject({ id: 1, title: 'Pruebas e2e con Supertest' });
    });

    it('allows a teacher to create a course they own', async () => {
      const token = await tokenFor(app, UserRole.TEACHER);

      const created = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Diseño de APIs', level: 'advanced' })
        .expect(201);

      expect(created.body.createdByUserId).toBe(1);
    });

    it('validates the body before saving (400) and stores nothing', async () => {
      const token = await tokenFor(app, UserRole.ADMIN);

      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nivel inventado', level: 'expert' })
        .expect(400);

      const list = await request(app.getHttpServer()).get('/courses').expect(200);
      expect(list.body.meta.total).toBe(0);
    });
  });

  describe('access denied', () => {
    it('returns 401 without a token', async () => {
      const response = await request(app.getHttpServer())
        .post('/courses')
        .send({ title: 'Sin token', level: 'beginner' })
        .expect(401);

      expect(response.body).toMatchObject({ statusCode: 401, path: '/courses' });
    });

    it('returns 401 with a tampered token', async () => {
      const token = await tokenFor(app, UserRole.ADMIN);

      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}x`)
        .send({ title: 'Token alterado', level: 'beginner' })
        .expect(401);
    });

    it('returns 403 for a student (insufficient role) and stores nothing', async () => {
      const token = await tokenFor(app, UserRole.STUDENT);

      const response = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Curso no autorizado', level: 'beginner' })
        .expect(403);

      expect(response.body).toMatchObject({ statusCode: 403, error: 'Forbidden' });
      const list = await request(app.getHttpServer()).get('/courses').expect(200);
      expect(list.body.meta.total).toBe(0);
    });

    it('returns 403 when a teacher tries to delete (admin only)', async () => {
      const admin = await tokenFor(app, UserRole.ADMIN);
      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${admin}`)
        .send({ title: 'Curso protegido', level: 'beginner' })
        .expect(201);
      const teacher = await tokenFor(app, UserRole.TEACHER);

      await request(app.getHttpServer())
        .delete('/courses/1')
        .set('Authorization', `Bearer ${teacher}`)
        .expect(403);
      await request(app.getHttpServer()).get('/courses/1').expect(200);
    });
  });
});
