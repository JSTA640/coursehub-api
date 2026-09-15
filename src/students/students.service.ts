import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { FilterStudentDto } from './dto/filter-student.dto';

@Injectable()
export class StudentsService {
  private students: Student[] = [];
  private idCounter = 1;

  create(createStudentDto: CreateStudentDto): Student {
    const emailExists = this.students.some(
      (s) => s.email.toLowerCase() === createStudentDto.email.toLowerCase(),
    );
    if (emailExists) {
      throw new ConflictException(`El correo ${createStudentDto.email} ya está registrado.`);
    }

    const newStudent: Student = {
      id: this.idCounter++,
      ...createStudentDto,
      isActive: createStudentDto.isActive ?? true,
    };

    this.students.push(newStudent);
    return newStudent;
  }

  findAll(filters: FilterStudentDto): Student[] {
    let result = this.students;

    const careerFilter = filters.career?.trim().toLowerCase();
    if (careerFilter) {
      result = result.filter((s) => s.career.toLowerCase() === careerFilter);
    }
    if (filters.semester !== undefined) {
      result = result.filter((s) => s.semester === filters.semester);
    }
    if (filters.isActive !== undefined) {
      result = result.filter((s) => s.isActive === filters.isActive);
    }

    return result;
  }

  findOne(id: number): Student {
    const student = this.students.find((s) => s.id === id);
    if (!student) {
      throw new NotFoundException(`Estudiante con ID ${id} no encontrado.`);
    }
    return student;
  }

  update(id: number, updateStudentDto: UpdateStudentDto): Student {
    const student = this.findOne(id);
    const newEmail = updateStudentDto.email?.trim();

    if (newEmail && newEmail.toLowerCase() !== student.email.toLowerCase()) {
      const emailExists = this.students.some(
        (s) => s.id !== id && s.email.toLowerCase() === newEmail.toLowerCase(),
      );
      if (emailExists) {
        throw new ConflictException(`El correo ${newEmail} ya está en uso.`);
      }
    }

    Object.assign(student, updateStudentDto);
    return student;
  }

  toggleActiveStatus(id: number, isActive: boolean): Student {
    const student = this.findOne(id);
    student.isActive = isActive;
    return student;
  }

  remove(id: number): void {
    const student = this.findOne(id);

    if (!student.isActive) {
      throw new BadRequestException('No se puede eliminar un estudiante que se encuentra inactivo.');
    }

    this.students = this.students.filter((s) => s.id !== id);
  }
}