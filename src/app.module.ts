import { Module } from '@nestjs/common'; 
import { AppController } from './app.controller'; 
import { AppService } from './app.service'; 
import { WelcomeController } from './welcome.controller'; 
import { WelcomeService } from './welcome.service'; 
import { CourseModule } from './courses/course.module';

@Module({ // 6
  imports: [CourseModule], // 7
  controllers: [AppController, WelcomeController], 
  providers: [AppService, WelcomeService], 
})
export class AppModule {} 
