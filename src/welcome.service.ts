import {Injectable} from '@nestjs/common';
@Injectable()
export class WelcomeService {
  getMessage(): {Message: string} {
    return {Message: 'Bienvenido a CourseHub API'};
  }
}