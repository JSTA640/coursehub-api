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
  let otherStudentId: number | undefined;
  let enrollmentId: number | undefined;
  let otherEnrollmentId: number | undefined;
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
    otherStudentId = undefined;
    enrollmentId = undefined;
    otherEnrollmentId = undefined;
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

    const paginationCourseTitles = [`Álgebra ${uniqueTag}`, `Biología ${uniqueTag}`,
      `Cálculo ${uniqueTag}`, `Diseño ${uniqueTag}`, `Estadística ${uniqueTag}`,
      `Física ${uniqueTag}`, `Geometría ${uniqueTag}`];
    for (const title of paginationCourseTitles) {
      const response = await request(server)
        .post('/courses')
        .send({ title, level: 'beginner' })
        .expect(201);
      courseIds.push(response.body.id);
    }

    const secondCourseResponse = await request(server)
      .post('/courses')
      .send({ title: `Otro curso ${uniqueTag}`, level: 'intermediate' })
      .expect(201);
    const secondCourseId: number = secondCourseResponse.body.id;
    courseIds.push(secondCourseId);

    const firstPage = await request(server)
      .get('/courses')
      .query({ level: 'beginner', page: 1, limit: 3, sortBy: 'title', order: 'ASC' })
      .expect(200);
    const secondPage = await request(server)
      .get('/courses')
      .query({ level: 'beginner', page: 2, limit: 3, sortBy: 'title', order: 'ASC' })
      .expect(200);
    expect(firstPage.body.items).toHaveLength(3);
    expect(secondPage.body.items).toHaveLength(3);
    expect(firstPage.body.meta).toMatchObject({ page: 1, limit: 3 });
    expect(firstPage.body.meta.total).toBeGreaterThanOrEqual(8);
    expect(firstPage.body.meta.totalPages).toBeGreaterThanOrEqual(3);
    expect(firstPage.body.items.map((course: Course) => course.id))
      .not.toEqual(expect.arrayContaining(secondPage.body.items.map((course: Course) => course.id)));
    for (const page of [firstPage.body, secondPage.body]) {
      const titles = page.items.map((course: Course) => course.title);
      expect(titles).toEqual([...titles].sort((left, right) => left.localeCompare(right)));
    }

    for (const invalidQuery of [
      { page: 0 },
      { limit: 200 },
      { sortBy: 'createdAt' },
      { order: 'sideways' },
    ]) {
      await request(server).get('/courses').query(invalidQuery).expect(400);
    }

    const defaultList = await request(server).get('/courses').expect(200);
    expect(defaultList.body).toHaveProperty('items');
    expect(defaultList.body).toHaveProperty('meta');
    expect(defaultList.body.items.length).toBeLessThanOrEqual(10);
    expect(defaultList.body.meta).toMatchObject({ page: 1, limit: 10 });

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

    const otherStudentResponse = await request(server)
      .post('/students')
      .send({
        name: 'Otro estudiante de prueba',
        email: `otro-${uniqueTag}@example.edu`,
        age: 22,
        career,
        semester: 5,
        isActive: true,
      })
      .expect(201);
    otherStudentId = otherStudentResponse.body.id;
    const otherEnrollmentResponse = await request(server)
      .post('/enrollments')
      .send({ studentId: otherStudentId, courseId: secondCourseId })
      .expect(201);
    otherEnrollmentId = otherEnrollmentResponse.body.id;

    const enrollmentPageOne = await request(server)
      .get('/enrollments')
      .query({
        search: uniqueTag,
        activeOnly: 'true',
        page: 1,
        limit: 1,
      })
      .expect(200);
    const enrollmentPageTwo = await request(server)
      .get('/enrollments')
      .query({
        search: uniqueTag,
        activeOnly: 'true',
        page: 2,
        limit: 1,
      })
      .expect(200);
    expect(enrollmentPageOne.body.items).toHaveLength(1);
    expect(enrollmentPageTwo.body.items).toHaveLength(1);
    expect(enrollmentPageOne.body.meta).toMatchObject({ total: 2, page: 1, limit: 1 });
    expect(enrollmentPageTwo.body.meta).toMatchObject({ total: 2, page: 2, limit: 1 });
    expect(enrollmentPageOne.body.items[0].id).not.toBe(enrollmentPageTwo.body.items[0].id);
    expect(enrollmentPageOne.body.items[0]).toHaveProperty('student.name');
    expect(enrollmentPageOne.body.items[0]).toHaveProperty('course.title');

    const combinedFilters = await request(server)
      .get('/enrollments')
      .query({
        search: `CURSO PRUEBA ${uniqueTag}`,
        studentId,
        courseId: firstCourseId,
        activeOnly: 'true',
        page: 1,
        limit: 5,
      })
      .expect(200);
    expect(combinedFilters.body.items).toHaveLength(1);
    expect(combinedFilters.body.items[0].id).toBe(enrollmentId);

    const injectionSearch = await request(server)
      .get('/enrollments')
      .query({ search: "' OR 1=1 --", page: 1, limit: 5 })
      .expect(200);
    expect(injectionSearch.body).toMatchObject({
      items: [],
      meta: { total: 0, page: 1, limit: 5 },
    });
    const missingSearch = await request(server)
      .get('/enrollments')
      .query({ search: `no-match-${uniqueTag}` })
      .expect(200);
    expect(missingSearch.body).toMatchObject({
      items: [],
      meta: { total: 0, page: 1, limit: 10 },
    });
    const invalidPage = await request(server)
      .get('/enrollments')
      .query({ page: 0 })
      .expect(400);
    expect(invalidPage.body).toBeDefined();
    await request(server)
      .get('/enrollments')
      .query({ activeOnly: 'sometimes' })
      .expect(400);

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
    expect(persistedEnrollment.body.items).toHaveLength(1);
    expect(persistedEnrollment.body.items[0]).toMatchObject({
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
    expect(remainingEnrollments.body.items).toHaveLength(0);

    await request(app.getHttpServer())
      .patch(`/students/${studentId}/status`)
      .send({ isActive: true })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/students/${studentId}`)
      .expect(204);
    studentId = undefined;
    await request(app.getHttpServer())
      .delete(`/enrollments/${otherEnrollmentId}`)
      .expect(204);
    otherEnrollmentId = undefined;
    await request(app.getHttpServer())
      .delete(`/students/${otherStudentId}`)
      .expect(204);
    otherStudentId = undefined;

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
      if (otherEnrollmentId !== undefined) {
        await dataSource.getRepository(Enrollment).delete(otherEnrollmentId);
      }
      if (studentId !== undefined) {
        await dataSource.getRepository(Student).delete(studentId);
      }
      if (otherStudentId !== undefined) {
        await dataSource.getRepository(Student).delete(otherStudentId);
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
