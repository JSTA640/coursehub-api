import type { Course } from '../../entities/course.entity.js';

// Token de inyección: las interfaces no existen en tiempo de ejecución.
export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');

// Puerto: el contrato mínimo que necesita UpdateCourseUseCase (segregación de interfaces).
// No menciona TypeORM ni PostgreSQL; cualquier almacenamiento puede cumplirlo.
export interface CourseRepository {
  findById(id: number): Promise<Course | null>;
  save(course: Course): Promise<Course>;
}
