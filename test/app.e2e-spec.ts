import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Course } from '../src/courses/entities/course.entity.js';
import { Enrollment } from '../src/enrollments/entities/enrollment.entity.js';
import { Student } from '../src/students/entities/student.entity.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let studentId: number | undefined;
  let enrollmentId: number | undefined;
  let courseIds: number[] = [];

  async function createApp(): Promise<INestApplication<App>> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const application = moduleFixture.createNestApplication<App>();
    application.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await application.init();
    return application;
  }

  beforeEach(async () => {
    studentId = undefined;
    enrollmentId = undefined;
    courseIds = [];
    app = await createApp();
  });

  it('/ (GET)', () => {
    return request(app!.getHttpServer())
      .get('/')
      .expect(200)
      .expect('CourseHub API está en línea y funcionando correctamente.');
  });

  it('persists students and enrollments and enforces their business rules', async () => {
    const server = app!.getHttpServer();
    const uniqueTag = `${Date.now()}-${process.pid}`;
    const email = `e2e-${uniqueTag}@example.edu`;
    const career = `E2E-${uniqueTag}`;

    const firstCourseResponse = await request(server)
      .post('/courses')
      .send({ title: `Curso prueba ${uniqueTag}`, level: 'beginner' })
      .expect(201);
    const firstCourseId: number = firstCourseResponse.body.id;
    courseIds.push(firstCourseId);

    const secondCourseResponse = await request(server)
      .post('/courses')
      .send({ title: `Otro curso ${uniqueTag}`, level: 'intermediate' })
      .expect(201);
    const secondCourseId: number = secondCourseResponse.body.id;
    courseIds.push(secondCourseId);

    const studentResponse = await request(server)
      .post('/students')
      .send({
        name: 'Estudiante de prueba',
        email,
        age: 20,
        career,
        semester: 4,
        isActive: true,
      })
      .expect(201);
    studentId = studentResponse.body.id;
    expect(studentResponse.body).toMatchObject({ email, isActive: true, semester: 4 });

    await request(server)
      .post('/students')
      .send({
        name: 'Correo duplicado',
        email,
        age: 20,
        career,
        semester: 4,
      })
      .expect(409);

    const filteredStudents = await request(server)
      .get('/students')
      .query({ career, semester: 4, isActive: true })
      .expect(200);
    expect(filteredStudents.body.map((student: Student) => student.id)).toContain(studentId);

    await request(server)
      .patch(`/students/${studentId}`)
      .send({ name: 'Estudiante actualizado' })
      .expect(200);

    const enrollmentResponse = await request(server)
      .post('/enrollments')
      .send({ studentId, courseId: firstCourseId })
      .expect(201);
    enrollmentId = enrollmentResponse.body.id;

    await request(server)
      .post('/enrollments')
      .send({ studentId, courseId: firstCourseId })
      .expect(409);

    await request(server)
      .patch(`/students/${studentId}/status`)
      .send({ isActive: false })
      .expect(200);

    const inactiveStudents = await request(server)
      .get('/students')
      .query({ career, isActive: false })
      .expect(200);
    expect(inactiveStudents.body.map((student: Student) => student.id)).toContain(studentId);

    await request(server)
      .post('/enrollments')
      .send({ studentId, courseId: secondCourseId })
      .expect(400);

    await request(server)
      .delete(`/students/${studentId}`)
      .expect(400);

    await app!.close();
    app = await createApp();

    const persistedStudent = await request(app.getHttpServer())
      .get(`/students/${studentId}`)
      .expect(200);
    expect(persistedStudent.body).toMatchObject({
      id: studentId,
      name: 'Estudiante actualizado',
      email,
      isActive: false,
    });

    const persistedEnrollment = await request(app.getHttpServer())
      .get('/enrollments')
      .query({ studentId, courseId: firstCourseId })
      .expect(200);
    expect(persistedEnrollment.body).toHaveLength(1);
    expect(persistedEnrollment.body[0]).toMatchObject({
      id: enrollmentId,
      student: { id: studentId, email },
      course: { id: firstCourseId },
    });

    await request(app.getHttpServer())
      .delete(`/enrollments/${enrollmentId}`)
      .expect(204);
    enrollmentId = undefined;

    const remainingEnrollments = await request(app.getHttpServer())
      .get('/enrollments')
      .query({ studentId, courseId: firstCourseId })
      .expect(200);
    expect(remainingEnrollments.body).toHaveLength(0);

    await request(app.getHttpServer())
      .patch(`/students/${studentId}/status`)
      .send({ isActive: true })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/students/${studentId}`)
      .expect(204);
    studentId = undefined;

    for (const courseId of courseIds) {
      await request(app.getHttpServer()).delete(`/courses/${courseId}`).expect(200);
    }
    courseIds = [];
  });

  afterEach(async () => {
    if (!app) return;
    try {
      const dataSource = app.get(DataSource);
      if (enrollmentId !== undefined) {
        await dataSource.getRepository(Enrollment).delete(enrollmentId);
      }
      if (studentId !== undefined) {
        await dataSource.getRepository(Student).delete(studentId);
      }
      if (courseIds.length > 0) {
        await dataSource.getRepository(Course).delete(courseIds);
      }
    } finally {
      await app.close();
      app = undefined;
    }
  });
});
