import { Module } from '@nestjs/common'; 
import { AppController } from './app.controller'; 
import { AppService } from './app.service'; 
import { WelcomeController } from './welcome.controller'; 
import { WelcomeService } from './welcome.service'; 
import { CourseModule } from './courses/course.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { StudentsModule } from './students/students.module';
@Module({ // 6
  imports: [CourseModule, EnrollmentsModule, StudentsModule], // 7
  controllers: [AppController, WelcomeController], 
  providers: [AppService, WelcomeService], 
})
export class AppModule {} 
