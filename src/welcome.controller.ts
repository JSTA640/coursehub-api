import { controller, Get } from '@nestjs/common';
import { WelcomeService } from './Welcome.service';

@Controller('welcome')
export class WelcomeController {
  constructor(private readonly welcomeService: WelcomeService) {}

 @Get()
getWelcome(): {Message: string} {
  return this.welcomeService.getWelcome();
}
}
