import {
  Body,
  Controller,
  Get,
  INestApplication,
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { IsEmail, IsString, MinLength } from 'class-validator';
import request from 'supertest';
import { HttpErrorFilter } from './filters/http-error.filter.js';
import { TimingInterceptor } from './interceptors/timing.interceptor.js';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware.js';

class SampleDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

@Controller('samples')
class SamplesController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    if (id !== 1) throw new NotFoundException(`Sample ${id} not found`);
    return { id };
  }

  @Post()
  create(@Body() dto: SampleDto) {
    return { email: dto.email };
  }

  @Get('boom/now')
  boom() {
    throw new Error('SELECT secret FROM vault; DB_PASSWORD=hunter2');
  }
}

@Module({
  controllers: [SamplesController],
  providers: [
    { provide: APP_FILTER, useClass: HttpErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
  ],
})
class SampleModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}

describe('HTTP pipeline: middleware, pipes, interceptor and filter', () => {
  let app: INestApplication;
  let logs: string[];

  beforeEach(async () => {
    logs = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => {
        logs.push(String(message));
      });
    }

    const moduleRef = await Test.createTestingModule({ imports: [SampleModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  const httpLogs = () => logs.filter((line) => line.includes('"status"'));
  const timingLogs = () => logs.filter((line) => line.includes('"handler"'));
  // Espera a que el evento 'finish' del middleware se haya registrado.
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('middleware logs method, path, status and duration without sensitive data', async () => {
    const response = await request(app.getHttpServer())
      .post('/samples?token=abc')
      .set('Authorization', 'Bearer super-secret-token')
      .send({ email: 'ana@example.com', password: 'my-password-123' });
    await flush();

    expect(response.status).toBe(201);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    const [entry] = httpLogs().map((line) => JSON.parse(line));
    expect(entry).toEqual({
      requestId: response.headers['x-request-id'],
      method: 'POST',
      path: '/samples',
      status: 201,
      durationMs: expect.any(Number),
    });
    const allLogs = logs.join('\n');
    expect(allLogs).not.toMatch(/super-secret-token|my-password-123|Bearer|token=abc/);
  });

  it('interceptor adds X-Response-Time and logs the handler duration', async () => {
    const response = await request(app.getHttpServer()).get('/samples/1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1 });
    expect(response.headers['x-response-time']).toMatch(/^\d+ms$/);
    expect(JSON.parse(timingLogs()[0])).toEqual({
      handler: 'SamplesController.findOne',
      method: 'GET',
      path: '/samples/1',
      outcome: 'ok',
      durationMs: expect.any(Number),
    });
  });

  it('ValidationPipe errors use the uniform error shape (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/samples')
      .send({ email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.arrayContaining(['email must be an email']),
      path: '/samples',
      timestamp: expect.any(String),
      requestId: response.headers['x-request-id'],
    });
  });

  it('ParseIntPipe rejects a non numeric id with 400 before reaching the controller', async () => {
    const response = await request(app.getHttpServer()).get('/samples/abc');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed (numeric string is expected)',
      path: '/samples/abc',
    });
    // En Nest el interceptor envuelve también a los pipes: mide el rechazo como error.
    expect(JSON.parse(timingLogs()[0])).toMatchObject({ outcome: 'error' });
  });

  it('a missing resource keeps its 404 message in the uniform shape', async () => {
    const response = await request(app.getHttpServer()).get('/samples/99');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Sample 99 not found',
      path: '/samples/99',
    });
    // El interceptor mide también el error, pero no lo oculta.
    expect(JSON.parse(timingLogs()[0])).toMatchObject({ outcome: 'error' });
  });

  it('an unexpected error returns a generic 500 and logs the details only internally', async () => {
    const response = await request(app.getHttpServer()).get('/samples/boom/now');
    await flush();

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      path: '/samples/boom/now',
      timestamp: expect.any(String),
      requestId: response.headers['x-request-id'],
    });
    expect(JSON.stringify(response.body)).not.toMatch(/SELECT|hunter2|stack|at /);
    const errorLog = logs.find((line) => line.includes('SELECT secret FROM vault'));
    expect(errorLog).toBeDefined();
    expect(errorLog).toContain(response.headers['x-request-id']);
    expect(JSON.parse(httpLogs()[0])).toMatchObject({ status: 500, path: '/samples/boom/now' });
  });

  it('unknown routes also get the uniform 404 shape', async () => {
    const response = await request(app.getHttpServer()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404, error: 'Not Found', path: '/does-not-exist' });
  });
});
