import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'CourseHub API está en línea y funcionando correctamente.';
  }
}
