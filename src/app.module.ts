import { Module } from '@nestjs/common'; // 1
import { AppController } from './app.controller'; // 2
import { AppService } from './app.service'; // 3
import { WelcomeController } from './welcome.controller'; // 4
import { WelcomeService } from './welcome.service'; // 5

@Module({ // 6
  imports: [], // 7
  controllers: [AppController, WelcomeController], // 8
  providers: [AppService, WelcomeService], // 9
})
export class AppModule {} // 10
