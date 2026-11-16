import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';

describe('POST /auth/login', () => {
  const password = 'aprendo-nest-2026';
  const userEmail = 'ana@example.com';
  const jwtSecret = 'test-jwt-secret-that-is-at-least-thirty-two-characters';
  let app: INestApplication;
  let usersService: {
    findByEmailWithPassword: jest.Mock<UsersService['findByEmailWithPassword']>;
  };
  let jwtService: JwtService;
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
    jwtService = new JwtService({ secret: jwtSecret, signOptions: { expiresIn: '15m' } });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: jwtSecret }) },
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

  it('returns 200 with safe user fields for valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ' Ana@Example.com ', password });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    expect(usersService.findByEmailWithPassword).toHaveBeenCalledWith(userEmail);
    await expect(jwtService.verifyAsync(response.body.accessToken)).resolves.toMatchObject({
      sub: user.id,
      email: user.email,
    });
  });

  it('returns 200 for /auth/me with a valid Bearer token', async () => {
    const token = await jwtService.signAsync({ sub: user.id, email: user.email });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: user.id, email: user.email });
  });

  it('returns 401 for /auth/me without an Authorization header', async () => {
    const response = await request(app.getHttpServer()).get('/auth/me');

    expect(response.status).toBe(401);
  });

  it('returns 401 for /auth/me with a non-Bearer authorization scheme', async () => {
    const token = await jwtService.signAsync({ sub: user.id, email: user.email });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Token ${token}`);

    expect(response.status).toBe(401);
  });

  it('returns 401 for /auth/me with an altered token', async () => {
    const token = await jwtService.signAsync({ sub: user.id, email: user.email });
    const alteredToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${alteredToken}`);

    expect(response.status).toBe(401);
  });

  it('returns 401 for /auth/me with an expired token', async () => {
    const expiredToken = await jwtService.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: -1 },
    );

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
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
