import { ConfigService } from '@nestjs/config';
import { buildTypeOrmOptions } from './typeorm.config.js';

function configFor(nodeEnv: string): ConfigService {
  return new ConfigService({
    NODE_ENV: nodeEnv,
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'coursehub_test',
    DB_USER: 'postgres',
    DB_PASSWORD: 'fake-password',
  });
}

describe('buildTypeOrmOptions', () => {
  it('sincroniza el esquema en development', () => {
    expect(buildTypeOrmOptions(configFor('development')).synchronize).toBe(true);
  });

  it.each(['production', 'test'])('no sincroniza el esquema en %s', (nodeEnv) => {
    expect(buildTypeOrmOptions(configFor(nodeEnv)).synchronize).toBe(false);
  });

  it('falla si falta una variable requerida', () => {
    const config = new ConfigService({ NODE_ENV: 'development' });
    expect(() => buildTypeOrmOptions(config)).toThrow();
  });
});
