import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';

describe('POST /courses authentication', () => {
  const jwtService = new JwtService({
    secret: 'test-jwt-secret-that-is-at-least-thirty-two-characters',
    signOptions: { expiresIn: '15m' },
  });
  let app: INestApplication;
  let coursesService: { create: jest.Mock };

  beforeEach(async () => {
    coursesService = {
      create: jest.fn().mockResolvedValue({ id: 1, title: 'Databases', level: 'beginner' }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [CoursesController],
      providers: [
        { provide: CoursesService, useValue: coursesService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_SECRET: 'test-jwt-secret-that-is-at-least-thirty-two-characters',
          }),
        },
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

  it('rejects course creation without a token and does not call the service', async () => {
    const response = await request(app.getHttpServer())
      .post('/courses')
      .send({ title: 'Databases', level: 'beginner' });

    expect(response.status).toBe(401);
    expect(coursesService.create).not.toHaveBeenCalled();
  });

  it('allows course creation with a valid token while retaining DTO validation', async () => {
    const token = await jwtService.signAsync({ sub: 1, email: 'ana@example.com' });
    const body = { title: 'Databases', level: 'beginner' };

    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(response.status).toBe(201);
    expect(coursesService.create).toHaveBeenCalledWith(body);
  });

  it('returns 400 for an invalid course DTO even with a valid token', async () => {
    const token = await jwtService.signAsync({ sub: 1, email: 'ana@example.com' });

    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '', level: 'not-a-course-level' });

    expect(response.status).toBe(400);
    expect(coursesService.create).not.toHaveBeenCalled();
  });
});
