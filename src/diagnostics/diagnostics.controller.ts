import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Ruta de práctica para provocar un error inesperado y comparar la respuesta
// pública (genérica) con el registro interno (detallado). En producción responde 404.
@Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly config: ConfigService) {}

  @Get('unexpected-error')
  unexpectedError(): never {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }
    throw new Error('Simulated failure: SELECT * FROM users WHERE password_hash = $1 (internal detail)');
  }
}
