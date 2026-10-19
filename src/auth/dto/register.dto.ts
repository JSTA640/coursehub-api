import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  // Solo se normaliza el correo; un valor ausente sigue siendo inválido.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  // La contraseña no se transforma: 72 es el límite de entrada de bcrypt.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
