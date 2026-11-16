import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { buildCorsOptions, parseCorsOrigins } from './cors.config.js';

const ALLOWED = 'http://localhost:5173';
const BLOCKED = 'http://evil.example.com';

@Controller('probe')
class ProbeController {
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @Get('protected')
  @UseGuards(JwtAuthGuard)
  protectedRoute() {
    return { ok: true };
  }
}

describe('CORS configuration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [ProbeController],
      providers: [
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
    app.enableCors(buildCorsOptions(parseCorsOrigins(`${ALLOWED}, `)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('parses a comma separated list of origins', () => {
    expect(parseCorsOrigins(' http://a.test , http://b.test:8080,')).toEqual([
      'http://a.test',
      'http://b.test:8080',
    ]);
  });

  it('lets an allowed origin read the response', async () => {
    const response = await request(app.getHttpServer()).get('/probe/public').set('Origin', ALLOWED);

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('does not grant a non-allowed origin (the browser blocks the read)', async () => {
    const response = await request(app.getHttpServer()).get('/probe/public').set('Origin', BLOCKED);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers the preflight with the allowed methods and headers', async () => {
    const response = await request(app.getHttpServer())
      .options('/probe/protected')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'DELETE')
      .set('Access-Control-Request-Headers', 'Authorization');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,DELETE');
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type,Authorization');
  });

  it('still requires a JWT on protected routes for an allowed origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/protected')
      .set('Origin', ALLOWED);

    expect(response.status).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('is not enforced for clients without Origin such as Postman or scripts', async () => {
    const response = await request(app.getHttpServer()).get('/probe/public');

    expect(response.status).toBe(200);
  });
});
