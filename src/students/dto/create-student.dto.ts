import { IsString, IsEmail, IsInt, Min, Max, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(16)
  age: number;

  @IsString()
  @IsNotEmpty()
  career: string;

  @IsInt()
  @Min(1)
  @Max(10)
  semester: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}