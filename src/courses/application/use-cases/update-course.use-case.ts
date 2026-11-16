import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../auth/types/jwt-payload.type.js';
import { UserRole } from '../../../users/user-role.enum.js';
import type { UpdateCourseDto } from '../../dto/update-course.dto.js';
import type { Course } from '../../entities/course.entity.js';
import { COURSE_REPOSITORY, type CourseRepository } from '../ports/course.repository.js';

// Caso de uso: la regla «solo el propietario o un administrador puede editar un curso».
// Depende del puerto CourseRepository, no de TypeORM (inversión de dependencias),
// así que puede probarse con un repositorio falso en memoria.
@Injectable()
export class UpdateCourseUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: CourseRepository) {}

  async execute(id: number, changes: UpdateCourseDto, actor: AuthenticatedUser): Promise<Course> {
    const course = await this.courses.findById(id);
    // Mismo mensaje que antes de la refactorización: el contrato HTTP no cambia.
    if (!course) throw new NotFoundException(`El curso con ID ${id} no existe`);

    const canManageAny = actor.role === UserRole.ADMIN;
    const isOwner = course.createdByUserId !== null && course.createdByUserId === actor.id;
    if (!canManageAny && !isOwner) {
      throw new ForbiddenException('You cannot modify this course');
    }

    Object.assign(course, changes);
    return this.courses.save(course);
  }
}
