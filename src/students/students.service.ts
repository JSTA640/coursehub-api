import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Raw, Repository } from 'typeorm';
import { Student } from './entities/student.entity.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { FilterStudentDto } from './dto/filter-student.dto.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
  ) {}

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    await this.ensureEmailAvailable(createStudentDto.email);
    const student = this.studentsRepository.create({
      ...createStudentDto,
      email: normalizeEmail(createStudentDto.email),
      isActive: createStudentDto.isActive ?? true,
    });
    return this.save(student);
  }

  findAll(filters: FilterStudentDto): Promise<Student[]> {
    const where: FindOptionsWhere<Student> = {};
    const career = filters.career?.trim();
    if (career) {
      where.career = Raw(
        (alias) => `LOWER(${alias}) = LOWER(:career)`,
        { career },
      );
    }
    if (filters.semester !== undefined) where.semester = filters.semester;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return this.studentsRepository.find({ where });
  }

  async findOne(id: number): Promise<Student> {
    const student = await this.studentsRepository.findOneBy({ id });
    if (!student) {
      throw new NotFoundException(`Estudiante con ID ${id} no encontrado.`);
    }
    return student;
  }

  async update(id: number, updateStudentDto: UpdateStudentDto): Promise<Student> {
    const student = await this.findOne(id);
    if (updateStudentDto.email !== undefined) {
      await this.ensureEmailAvailable(updateStudentDto.email, id);
      updateStudentDto = {
        ...updateStudentDto,
        email: normalizeEmail(updateStudentDto.email),
      };
    }
    Object.assign(student, updateStudentDto);
    return this.save(student);
  }

  async toggleActiveStatus(id: number, isActive: boolean): Promise<Student> {
    const student = await this.findOne(id);
    student.isActive = isActive;
    return this.studentsRepository.save(student);
  }

  async remove(id: number): Promise<void> {
    const student = await this.findOne(id);
    if (!student.isActive) {
      throw new BadRequestException('No se puede eliminar un estudiante que se encuentra inactivo.');
    }
    try {
      await this.studentsRepository.remove(student);
    } catch (error: unknown) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('No se puede eliminar un estudiante con matrículas existentes.');
      }
      throw error;
    }
  }

  private async ensureEmailAvailable(email: string, currentId?: number): Promise<void> {
    const existing = await this.studentsRepository.findOneBy({
      email: normalizeEmail(email),
    });
    if (existing && existing.id !== currentId) {
      throw new ConflictException('El correo ya pertenece a otro estudiante.');
    }
  }

  private async save(student: Student): Promise<Student> {
    try {
      return await this.studentsRepository.save(student);
    } catch (error: unknown) {
      if (isUniqueEmailViolation(error)) {
        throw new ConflictException('El correo ya pertenece a otro estudiante.');
      }
      throw error;
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueEmailViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('driverError' in error)) {
    return false;
  }
  const driverError = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === '23505' &&
    'detail' in driverError &&
    typeof driverError.detail === 'string' &&
    driverError.detail.includes('(email)=')
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('driverError' in error)) {
    return false;
  }
  const driverError = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === '23503'
  );
}