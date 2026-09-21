// src/enrollments/enrollments.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-Enrollment.dto';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('courseId') courseId?: string,
  ) {
    const sId = studentId ? parseInt(studentId, 10) : undefined;
    const cId = courseId ? parseInt(courseId, 10) : undefined;
    return this.enrollmentsService.findAll({ studentId: sId, courseId: cId });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.enrollmentsService.remove(id);
  }
}