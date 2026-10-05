import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EnrollmentsService } from './enrollments.service.js';
import { StudentsService } from '../students/students.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { Enrollment } from './entities/enrollment.entity.js';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let repository: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
    save: jest.Mock;
  };
  let studentsService: { findOne: jest.Mock };
  let coursesService: { findOne: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn((enrollment) => enrollment),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      save: jest.fn(),
    };
    studentsService = { findOne: jest.fn() };
    coursesService = { findOne: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: getRepositoryToken(Enrollment), useValue: repository },
        { provide: StudentsService, useValue: studentsService },
        { provide: CoursesService, useValue: coursesService },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  it('persists a valid enrollment with student and course relations', async () => {
    const student = { id: 1, isActive: true };
    const course = { id: 2, title: 'Databases' };
    studentsService.findOne.mockResolvedValue(student);
    coursesService.findOne.mockResolvedValue(course);
    repository.findOne.mockResolvedValue(null);
    repository.save.mockImplementation(async (enrollment) => ({ id: 8, ...enrollment }));

    await expect(service.create({ studentId: 1, courseId: 2 })).resolves.toMatchObject({
      id: 8,
      student,
      course,
    });
  });

  it('returns not found when the student does not exist', async () => {
    studentsService.findOne.mockRejectedValue(new NotFoundException());

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(coursesService.findOne).not.toHaveBeenCalled();
  });

  it('returns not found when the course does not exist', async () => {
    studentsService.findOne.mockResolvedValue({ id: 1, isActive: true });
    coursesService.findOne.mockRejectedValue(new NotFoundException());

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('refuses to enroll an inactive student', async () => {
    studentsService.findOne.mockResolvedValue({ id: 1, isActive: false });
    coursesService.findOne.mockResolvedValue({ id: 2 });

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('rejects an already existing student-course pair', async () => {
    studentsService.findOne.mockResolvedValue({ id: 1, isActive: true });
    coursesService.findOne.mockResolvedValue({ id: 2 });
    repository.findOne.mockResolvedValue({ id: 8 });

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('converts a concurrent unique-pair violation to conflict', async () => {
    studentsService.findOne.mockResolvedValue({ id: 1, isActive: true });
    coursesService.findOne.mockResolvedValue({ id: 2 });
    repository.findOne.mockResolvedValue(null);
    repository.save.mockRejectedValue({
      driverError: { code: '23505', constraint: 'UQ_enrollments_student_course' },
    });

    await expect(service.create({ studentId: 1, courseId: 2 }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('lists using combined filters and loads both related entities', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll({ studentId: 1, courseId: 2 });

    expect(repository.find).toHaveBeenCalledWith({
      where: { student: { id: 1 }, course: { id: 2 } },
      relations: { student: true, course: true },
    });
  });

  it('validates resources and loads relations in per-resource listings', async () => {
    studentsService.findOne.mockResolvedValue({ id: 1 });
    coursesService.findOne.mockResolvedValue({ id: 2 });
    repository.find.mockResolvedValue([]);

    await service.findByStudent(1);
    expect(repository.find).toHaveBeenLastCalledWith({
      where: { student: { id: 1 } },
      relations: { student: true, course: true },
    });
    await service.findByCourse(2);
    expect(repository.find).toHaveBeenLastCalledWith({
      where: { course: { id: 2 } },
      relations: { student: true, course: true },
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
