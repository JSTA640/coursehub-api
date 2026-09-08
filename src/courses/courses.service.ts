import { Injectable } from '@nestjs/common';

type course = {
  id: number;
  tittle: string;
  level: string;
};

@Injectable()
export class CoursesService {
    private courses: course[] = [
    {id:1, tittle: "NestJS Fundamentals", level: "beginner"},
    {id:2, tittle: "REST APIs with NestJS", level: "beginner"},
    {id:3, tittle: "NestJS Architecture", level: "intermediate"},
  ];

  findAll(level?: string): course [] {
    if (!level){
        return this.courses;
    }
    return this.courses.filter((course) => course.level === level);
  }

  findOne(id: number):course | undefined{
    return this.courses.find((course) => course.id === id);
  }
}