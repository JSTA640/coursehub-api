// src/enrollments/enrollments.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-Enrollment.dto.js';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe.js';
import { FilterEnrollmentDto } from './dto/filter-enrollment.dto.js';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('enrollments')
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @Get('enrollments')
  findAll(@Query() filters: FilterEnrollmentDto) {
    return this.enrollmentsService.findAll(filters);
  }

  @Get('courses/:courseId/enrollments')
  findByCourse(@Param('courseId', ParseIdPipe) courseId: number) {
    return this.enrollmentsService.findByCourse(courseId);
  }

  @Get('students/:studentId/enrollments')
  findByStudent(@Param('studentId', ParseIdPipe) studentId: number) {
    return this.enrollmentsService.findByStudent(studentId);
  }

  @Delete('enrollments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.enrollmentsService.remove(id);
  }
}