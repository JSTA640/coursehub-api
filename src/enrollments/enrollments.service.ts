import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { StudentsService } from '../students/students.service';
import { CoursesService } from '../courses/courses.service';
import { CreateEnrollmentDto } from './dto/create-Enrollment.dto';

export type Enrollment = {
  id: number;
  studentId: number;
  courseId: number;
};

@Injectable()
export class EnrollmentsService {
  private readonly enrollments: Enrollment[] = [];
  private nextId = 1;

  constructor(
    private readonly studentsService: StudentsService,
    private readonly coursesService: CoursesService,
  ) {}

  async create(createEnrollmentDto: CreateEnrollmentDto): Promise<Enrollment> {
    const { studentId, courseId } = createEnrollmentDto;

    // 1. Verificar si el estudiante existe
    const student = this.studentsService.findOne(studentId);
    if (!student) {
      throw new NotFoundException(`El estudiante con ID ${studentId} no existe`);
    }

    // 2. Verificar si el estudiante está activo
    if (!student.isActive) {
      throw new BadRequestException(`El estudiante con ID ${studentId} se encuentra inactivo`);
    }

    // 3. Verificar si el curso existe
    await this.coursesService.findOne(courseId);

    // 4. Verificar duplicados (misma combinación studentId y courseId)
    const exists = this.enrollments.some(
      (e) => e.studentId === studentId && e.courseId === courseId,
    );
    if (exists) {
      throw new ConflictException(
        `El estudiante ${studentId} ya está matriculado en el curso ${courseId}`,
      );
    }

    // Registrar matrícula
    const newEnrollment: Enrollment = {
      id: this.nextId++,
      studentId,
      courseId,
    };
    this.enrollments.push(newEnrollment);

    return newEnrollment;
  }

  findAll(filter?: { studentId?: number; courseId?: number }): Enrollment[] {
    let result = this.enrollments;

    if (filter?.studentId) {
      result = result.filter((e) => e.studentId === filter.studentId);
    }
    if (filter?.courseId) {
      result = result.filter((e) => e.courseId === filter.courseId);
    }

    return result;
  }

  findByStudent(studentId: number): Enrollment[] {
    // Verificar si el estudiante existe
    const student = this.studentsService.findOne(studentId);
    if (!student) {
      throw new NotFoundException(`El estudiante con ID ${studentId} no existe`);
    }
    return this.enrollments.filter((e) => e.studentId === studentId);
  }

  async findByCourse(courseId: number): Promise<Enrollment[]> {
    // Verificar si el curso existe
    await this.coursesService.findOne(courseId);
    return this.enrollments.filter((e) => e.courseId === courseId);
  }

  remove(id: number): void {
    const index = this.enrollments.findIndex((e) => e.id === id);
    if (index === -1) {
      throw new NotFoundException(`La matrícula con ID ${id} no fue encontrada`);
    }
    this.enrollments.splice(index, 1);
  }
}