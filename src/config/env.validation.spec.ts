import { envValidationSchema } from './env.validation.js';

const validEnvironment = {
  DB_HOST: 'localhost',
  DB_NAME: 'coursehub_test',
  DB_USER: 'postgres',
  DB_PASSWORD: 'test-password',
  JWT_SECRET: 'test-jwt-secret-that-is-at-least-thirty-two-characters',
};

describe('envValidationSchema', () => {
  it('requires a JWT secret with at least 32 characters', () => {
    expect(envValidationSchema.validate({ ...validEnvironment, JWT_SECRET: undefined }).error).toBeDefined();
    expect(envValidationSchema.validate({ ...validEnvironment, JWT_SECRET: 'too-short' }).error).toBeDefined();
    expect(envValidationSchema.validate(validEnvironment).error).toBeUndefined();
  });

  it('defaults token expiry to 15m and rejects unsupported formats', () => {
    const { error, value } = envValidationSchema.validate(validEnvironment);

    expect(error).toBeUndefined();
    expect(value.JWT_EXPIRES_IN).toBe('15m');
    expect(
      envValidationSchema.validate({ ...validEnvironment, JWT_EXPIRES_IN: 'forever' }).error,
    ).toBeDefined();
  });

  it('defaults CORS to the local client origin and rejects wildcards or paths', () => {
    expect(envValidationSchema.validate(validEnvironment).value.CORS_ORIGINS).toBe(
      'http://localhost:5173',
    );
    expect(
      envValidationSchema.validate({
        ...validEnvironment,
        CORS_ORIGINS: 'http://localhost:5173, https://coursehub.example.edu',
      }).error,
    ).toBeUndefined();
    for (const invalid of ['*', 'localhost:5173', 'http://localhost:5173/', 'http://a.test/app']) {
      expect(
        envValidationSchema.validate({ ...validEnvironment, CORS_ORIGINS: invalid }).error,
      ).toBeDefined();
    }
  });
});
