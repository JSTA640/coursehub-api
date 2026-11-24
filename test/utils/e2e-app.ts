import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { User } from '../../src/users/entities/user.entity.js';
import { UserRole } from '../../src/users/user-role.enum.js';

export const PRACTICE_PASSWORD = 'practice-password-2026';

// Misma tubería HTTP que main.ts; el límite de tasa tiene su propia prueba
// (auth.throttle.spec.ts) y aquí se desactiva para no recibir 429.
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}

// Borra y recrea el esquema completo: cada caso empieza con tablas vacías e ids desde 1.
// Barrera de seguridad: solo actúa sobre una base cuyo nombre termina en _test.
export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const database = String(dataSource.options.database);
  if (process.env.NODE_ENV !== 'test' || !database.endsWith('_test')) {
    throw new Error(`Refusing to reset "${database}": e2e tests only run against a *_test database`);
  }
  await dataSource.synchronize(true);
}

// Identidad de práctica: se registra por HTTP, se le asigna el rol en la base
// (no existe endpoint público para elegir rol) y se inicia sesión para obtener el token.
export async function tokenFor(app: INestApplication, role: UserRole): Promise<string> {
  const server = app.getHttpServer();
  const email = `${role}-e2e@example.edu`;
  const registration = await request(server)
    .post('/auth/register')
    .send({ email, password: PRACTICE_PASSWORD })
    .expect(201);
  if (role !== UserRole.STUDENT) {
    await app.get(DataSource).getRepository(User).update(registration.body.id, { role });
  }
  const login = await request(server)
    .post('/auth/login')
    .send({ email, password: PRACTICE_PASSWORD })
    .expect(200);
  return login.body.accessToken;
}
