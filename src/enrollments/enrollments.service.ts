import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEnrollmentDto } from './dto/create-Enrollment.dto.js';
import { Enrollment } from './entities/enrollment.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Course } from '../courses/entities/course.entity.js';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async create(createEnrollmentDto: CreateEnrollmentDto): Promise<Enrollment> {
    const { studentId, courseId } = createEnrollmentDto;
    const student = await this.studentsRepository.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Estudiante con ID ${studentId} no encontrado.`);
    }
    const course = await this.coursesRepository.findOneBy({ id: courseId });
    if (!course) {
      throw new NotFoundException(`El curso con ID ${courseId} no existe`);
    }
    if (!student.isActive) {
      throw new BadRequestException(`El estudiante con ID ${studentId} se encuentra inactivo`);
    }

    const existing = await this.enrollmentsRepository.findOne({
      where: { student: { id: studentId }, course: { id: courseId } },
      relations: { student: true, course: true },
    });
    if (existing) {
      throw new ConflictException(
        `El estudiante ${studentId} ya está matriculado en el curso ${courseId}`,
      );
    }

    try {
      return await this.enrollmentsRepository.save(
        this.enrollmentsRepository.create({ student, course }),
      );
    } catch (error: unknown) {
      if (isEnrollmentUniqueViolation(error)) {
        throw new ConflictException(
          `El estudiante ${studentId} ya está matriculado en el curso ${courseId}`,
        );
      }
      throw error;
    }
  }

  findAll(filter: { studentId?: number; courseId?: number } = {}): Promise<Enrollment[]> {
    const where: {
      student?: { id: number };
      course?: { id: number };
    } = {};
    if (filter.studentId !== undefined) where.student = { id: filter.studentId };
    if (filter.courseId !== undefined) where.course = { id: filter.courseId };
    return this.enrollmentsRepository.find({
      where,
      relations: { student: true, course: true },
      order: { id: 'ASC' },
    });
  }

  async findByStudent(studentId: number): Promise<Enrollment[]> {
    const student = await this.studentsRepository.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Estudiante con ID ${studentId} no encontrado.`);
    }
    return this.enrollmentsRepository.find({
      where: { student: { id: studentId } },
      relations: { student: true, course: true },
      order: { id: 'ASC' },
    });
  }

  async findByCourse(courseId: number): Promise<Enrollment[]> {
    const course = await this.coursesRepository.findOneBy({ id: courseId });
    if (!course) {
      throw new NotFoundException(`El curso con ID ${courseId} no existe`);
    }
    return this.enrollmentsRepository.find({
      where: { course: { id: courseId } },
      relations: { student: true, course: true },
      order: { id: 'ASC' },
    });
  }

  async remove(id: number): Promise<void> {
    const enrollment = await this.enrollmentsRepository.findOneBy({ id });
    if (!enrollment) {
      throw new NotFoundException(`La matrícula con ID ${id} no fue encontrada`);
    }
    await this.enrollmentsRepository.remove(enrollment);
  }
}

function isEnrollmentUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('driverError' in error)) {
    return false;
  }
  const driverError = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === '23505' &&
    'constraint' in driverError &&
    driverError.constraint === 'UQ_enrollments_student_course'
  );
}