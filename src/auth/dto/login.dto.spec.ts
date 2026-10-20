import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';

describe('LoginDto', () => {
  it('normalizes the email and accepts valid credentials', async () => {
    const dto = plainToInstance(LoginDto, {
      email: ' Ana@Example.com ',
      password: 'aprendo-nest-2026',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBe('ana@example.com');
  });

  it('rejects malformed email and passwords shorter than eight characters', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'ana-at-example.com',
      password: '1234567',
    });

    const errors = await validate(dto);

    expect(errors.map(({ property }) => property)).toEqual(expect.arrayContaining(['email', 'password']));
  });
});
