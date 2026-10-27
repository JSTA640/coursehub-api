import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';

describe('POST /auth/login', () => {
  const password = 'aprendo-nest-2026';
  const userEmail = 'ana@example.com';
  let app: INestApplication;
  let usersService: {
    findByEmailWithPassword: jest.Mock<UsersService['findByEmailWithPassword']>;
  };
  let jwtService: { signAsync: jest.Mock<JwtService['signAsync']> };
  let user: User;

  beforeAll(async () => {
    user = {
      id: 1,
      email: userEmail,
      passwordHash: await bcrypt.hash(password, 4),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
  });

  beforeEach(async () => {
    usersService = {
      findByEmailWithPassword: jest.fn<UsersService['findByEmailWithPassword']>(),
    };
    usersService.findByEmailWithPassword.mockImplementation(async (email) =>
      email === userEmail ? user : null,
    );
    jwtService = { signAsync: jest.fn<JwtService['signAsync']>() };
    jwtService.signAsync.mockResolvedValue('signed-test-token');

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
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

  it('returns 200 with safe user fields for valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ' Ana@Example.com ', password });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accessToken: 'signed-test-token',
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    expect(usersService.findByEmailWithPassword).toHaveBeenCalledWith(userEmail);
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: user.id, email: user.email });
  });

  it('returns the generic 401 for an incorrect password', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password: 'otra-clave-2026' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Invalid credentials',
      error: 'Unauthorized',
    });
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('returns the same generic 401 for an unknown email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.com', password });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Invalid credentials',
      error: 'Unauthorized',
    });
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed email without querying users', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ana-at-example.com', password });

    expect(response.status).toBe(400);
    expect(usersService.findByEmailWithPassword).not.toHaveBeenCalled();
  });

  it('returns 400 for a password shorter than eight characters without querying users', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password: '1234567' });

    expect(response.status).toBe(400);
    expect(usersService.findByEmailWithPassword).not.toHaveBeenCalled();
  });
});
