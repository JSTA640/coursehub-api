import { IsInt, IsPositive } from 'class-validator';

export class CreateEnrollmentDto {
  @IsInt({ message: 'El student Id debe ser un número entero' })
  @IsPositive({ message: 'El student Id debe ser un número positivo' })
  studentId: number;

  @IsInt({ message: 'El courseId debe ser un número entero' })
  @IsPositive({ message: 'El courseId debe ser un número positivo' })
  courseId: number;
}