import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EnrollmentsService } from './enrollments.service.js';
import { Enrollment } from './entities/enrollment.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Course } from '../courses/entities/course.entity.js';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let repository: {
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
    save: jest.Mock;
  };
  let queryBuilder: {
    andWhere: jest.Mock;
    getManyAndCount: jest.Mock;
    leftJoinAndSelect: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
  };
  let studentsRepository: { findOneBy: jest.Mock };
  let coursesRepository: { findOneBy: jest.Mock };

  beforeEach(async () => {
    queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
    };
    repository = {
      create: jest.fn((enrollment) => enrollment),
      createQueryBuilder: jest.fn(() => queryBuilder),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      save: jest.fn(),
    };
    studentsRepository = { findOneBy: jest.fn() };
    coursesRepository = { findOneBy: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: getRepositoryToken(Enrollment), useValue: repository },
        { provide: getRepositoryToken(Student), useValue: studentsRepository },
        { provide: getRepositoryToken(Course), useValue: coursesRepository },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  it('persists a valid enrollment with student and course relations', async () => {
    const student = { id: 1, isActive: true };
    const course = { id: 2, title: 'Databases' };
    studentsRepository.findOneBy.mockResolvedValue(student);
    coursesRepository.findOneBy.mockResolvedValue(course);
    repository.findOne.mockResolvedValue(null);
    repository.save.mockImplementation(async (enrollment) => ({ id: 8, ...enrollment }));

    await expect(service.create({ studentId: 1, courseId: 2 })).resolves.toMatchObject({
      id: 8,
      student,
      course,
    });
  });

  it('returns not found when the student does not exist', async () => {
    studentsRepository.findOneBy.mockResolvedValue(null);

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(coursesRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('returns not found when the course does not exist', async () => {
    studentsRepository.findOneBy.mockResolvedValue({ id: 1, isActive: true });
    coursesRepository.findOneBy.mockResolvedValue(null);

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('refuses to enroll an inactive student', async () => {
    studentsRepository.findOneBy.mockResolvedValue({ id: 1, isActive: false });
    coursesRepository.findOneBy.mockResolvedValue({ id: 2 });

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('rejects an already existing student-course pair', async () => {
    studentsRepository.findOneBy.mockResolvedValue({ id: 1, isActive: true });
    coursesRepository.findOneBy.mockResolvedValue({ id: 2 });
    repository.findOne.mockResolvedValue({ id: 8 });

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('converts a concurrent unique-pair violation to conflict', async () => {
    studentsRepository.findOneBy.mockResolvedValue({ id: 1, isActive: true });
    coursesRepository.findOneBy.mockResolvedValue({ id: 2 });
    repository.findOne.mockResolvedValue(null);
    repository.save.mockRejectedValue({
      driverError: { code: '23505', constraint: 'UQ_enrollments_student_course' },
    });

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('paginates enrollments using combined filters and eagerly loads both relations', async () => {
    const enrollmentPage = [{ id: 8, student: { id: 1 }, course: { id: 2 } }];
    queryBuilder.getManyAndCount.mockResolvedValue([enrollmentPage, 6]);

    await expect(service.findAll({
      search: ' Nest ',
      studentId: 1,
      courseId: 2,
      activeOnly: 'true',
      page: 2,
      limit: 5,
    })).resolves.toEqual({
      items: enrollmentPage,
      meta: { total: 6, page: 2, limit: 5 },
    });
    expect(repository.createQueryBuilder).toHaveBeenCalledWith('enrollment');
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      1,
      'enrollment.student',
      'student',
    );
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      2,
      'enrollment.course',
      'course',
    );
    expect(queryBuilder.andWhere.mock.calls).toEqual([
      [
        '(student.name ILIKE :search OR course.title ILIKE :search)',
        { search: '%Nest%' },
      ],
      ['student.id = :studentId', { studentId: 1 }],
      ['course.id = :courseId', { courseId: 2 }],
      ['student.isActive = :active', { active: true }],
    ]);
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('enrollment.id', 'ASC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
  });

  it('treats false activeOnly as no active filter and returns empty pages successfully', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await expect(service.findAll({
      activeOnly: 'false',
      page: 1,
      limit: 10,
    })).resolves.toEqual({
      items: [],
      meta: { total: 0, page: 1, limit: 10 },
    });
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
  });

  it('validates resources and loads relations in per-resource listings', async () => {
    studentsRepository.findOneBy.mockResolvedValue({ id: 1 });
    coursesRepository.findOneBy.mockResolvedValue({ id: 2 });
    repository.find.mockResolvedValue([]);

    await service.findByStudent(1);
    expect(repository.find).toHaveBeenLastCalledWith({
      where: { student: { id: 1 } },
      relations: { student: true, course: true },
      order: { id: 'ASC' },
    });
    await service.findByCourse(2);
    expect(repository.find).toHaveBeenLastCalledWith({
      where: { course: { id: 2 } },
      relations: { student: true, course: true },
      order: { id: 'ASC' },
    });
  });

  it('returns not found when cancelling a missing enrollment', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.remove(8)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('removes an existing enrollment', async () => {
    const enrollment = { id: 8 };
    repository.findOneBy.mockResolvedValue(enrollment);

    await service.remove(8);

    expect(repository.remove).toHaveBeenCalledWith(enrollment);
  });
});
