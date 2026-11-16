import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { UsersService } from '../users/users.service.js';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-thirty-two-characters';

describe('POST /auth/login rate limit', () => {
  let app: INestApplication;
  let usersService: { findByEmailWithPassword: jest.Mock<UsersService['findByEmailWithPassword']> };

  beforeEach(async () => {
    usersService = {
      findByEmailWithPassword: jest.fn<UsersService['findByEmailWithPassword']>(),
    };
    usersService.findByEmailWithPassword.mockResolvedValue(null);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        // Misma configuración que AppModule.
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60_000, limit: 20 }],
          errorMessage: 'Too many requests, please try again later',
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: new JwtService({ secret: JWT_SECRET }) },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET }) },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        JwtAuthGuard,
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

  const attempt = () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ana@example.com', password: 'clave-incorrecta' });

  it('allows five attempts per minute and answers the sixth with a generic 429', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await attempt()).status).toBe(401);
    }

    const sixth = await attempt();

    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({
      statusCode: 429,
      message: 'Too many requests, please try again later',
    });
    expect(sixth.headers['retry-after']).toBeDefined();
    // No revela si el correo existe ni si la contraseña era correcta.
    expect(JSON.stringify(sixth.body)).not.toMatch(/email|password|credential|user/i);
    // El sexto intento ni siquiera consulta la base de datos.
    expect(usersService.findByEmailWithPassword).toHaveBeenCalledTimes(5);
  });

  it('keeps the general limit (not the login one) for other routes', async () => {
    for (let i = 0; i < 6; i++) {
      expect((await request(app.getHttpServer()).get('/auth/me')).status).toBe(401);
    }
  });
});
