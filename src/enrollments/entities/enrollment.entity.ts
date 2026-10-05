import { Course } from '../../courses/entities/course.entity.js';
import { Student } from '../../students/entities/student.entity.js';
import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('enrollments')
@Unique('UQ_enrollments_student_course', ['student', 'course'])
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Student, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @ManyToOne(() => Course, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'courseId' })
  course: Course;
}
