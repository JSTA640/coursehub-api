import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CourseRepository } from '../application/ports/course.repository.js';
import { Course } from '../entities/course.entity.js';

// Adaptador: traduce el puerto CourseRepository a TypeORM.
// Si cambia el almacenamiento, solo se reemplaza esta clase.
@Injectable()
export class TypeOrmCourseRepository implements CourseRepository {
  constructor(@InjectRepository(Course) private readonly repository: Repository<Course>) {}

  findById(id: number): Promise<Course | null> {
    return this.repository.findOneBy({ id });
  }

  save(course: Course): Promise<Course> {
    return this.repository.save(course);
  }
}
