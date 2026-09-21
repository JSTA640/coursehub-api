import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { StudentsModule } from '../students/students.module';
import { CourseModule } from '../courses/course.module';

@Module({
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  imports: [StudentsModule, CourseModule]
})
export class EnrollmentsModule {}
