import { IsOptional, IsString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterStudentDto {
  @IsOptional()
  @IsString()
  career?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Transform(({ value }) => {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return Number.NaN;
    return Number(value);
  })
  semester?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}