import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { WelcomeController } from './welcome.controller.js';
import { WelcomeService } from './welcome.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseModule } from './courses/course.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { StudentsModule } from './students/students.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { envValidationSchema } from './config/env.validation.js';
import { buildTypeOrmOptions } from './config/typeorm.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    // Límite global: 20 solicitudes por minuto por cliente (IP). Login usa uno más estricto.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
      errorMessage: 'Too many requests, please try again later',
    }),
    CourseModule,
    EnrollmentsModule,
    StudentsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController, WelcomeController],
  providers: [
    AppService,
    WelcomeService,
    // useExisting permite sustituir ThrottlerGuard en pruebas de integración.
    ThrottlerGuard,
    { provide: APP_GUARD, useExisting: ThrottlerGuard },
  ],
})
export class AppModule {}