import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import pg from 'pg';

export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const nodeEnv = config.getOrThrow<string>('NODE_ENV');
  const host = config.getOrThrow<string>('DB_HOST');
  const port = config.getOrThrow<number>('DB_PORT');
  const database = config.getOrThrow<string>('DB_NAME');
  // Solo en desarrollo; fuera de él los cambios de esquema irán por migraciones.
  const synchronize = nodeEnv === 'development';

  // Diagnóstico sin secretos: nunca registrar usuario ni contraseña.
  new Logger('TypeORM').log(
    `env=${nodeEnv} host=${host} port=${port} db=${database} synchronize=${synchronize}`,
  );

  return {
    type: 'postgres',
    // Driver explícito: bajo Jest ESM, TypeORM no logra cargar 'pg' con require().
    driver: pg,
    host,
    port,
    username: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database,
    autoLoadEntities: true,
    synchronize,
  };
}
