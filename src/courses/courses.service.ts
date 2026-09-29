import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createcourseDto } from './dto/create-courses.dto';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity.js';

type UpdateCourseInput = {
  title?: string;
  level?: string;
};


@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {} // 1

  findAll(level?: string) { // 2
    return this.coursesRepository.find({ where: level ? { level } : {} }); // 3
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id }); // 4
    if (!course) throw new NotFoundException(`El curso con ID ${id} no existe`); // 5
    return course;
  }

  create(dto: createcourseDto) { // 6
    const course = this.coursesRepository.create(dto);
    return this.coursesRepository.save(course);
  }

  async update(id: number, dto: UpdateCourseInput) {
    const course = await this.findOne(id); // 7
    Object.assign(course, dto);
    return this.coursesRepository.save(course); // 8
  }

  async remove(id: number) {
    const course = await this.findOne(id); // 9
    await this.coursesRepository.remove(course); // 10
    return course;
  }
}