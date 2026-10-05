import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateEnrollmentDto {
  @Type(() => Number)
  @IsInt({ message: 'El student Id debe ser un número entero' })
  @Min(1, { message: 'El student Id debe ser un número positivo' })
  studentId: number;

  @Type(() => Number)
  @IsInt({ message: 'El courseId debe ser un número entero' })
  @Min(1, { message: 'El courseId debe ser un número positivo' })
  courseId: number;
}