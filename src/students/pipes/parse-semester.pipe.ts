import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseSemesterPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException('El semestre debe ser un número entero válido.');
    }
    if (val < 1 || val > 10) {
      throw new BadRequestException('El semestre debe estar entre 1 y 10.');
    }
    return val;
  }
}