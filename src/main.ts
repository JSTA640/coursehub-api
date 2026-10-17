import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { AppLogLevel } from './config/env.validation.js';
import { resolveLogLevels } from './config/logger.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  app.useLogger(resolveLogLevels(config.getOrThrow<AppLogLevel>('LOG_LEVEL')));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
}
bootstrap();
