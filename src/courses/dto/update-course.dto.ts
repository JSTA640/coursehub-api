import { PartialType } from '@nestjs/mapped-types';
import { createcourseDto } from './create-courses.dto.js';

// No incluye createdByUserId: con forbidNonWhitelisted, enviarlo responde 400.
export class UpdateCourseDto extends PartialType(createcourseDto) {}
