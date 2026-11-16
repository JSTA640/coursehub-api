import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

// Convierte "http://a.com, http://b.com" en una lista explícita de orígenes.
export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

// CORS decide qué sitios web pueden LEER respuestas desde un navegador.
// No es autorización: Postman, scripts o servidores no aplican CORS.
export function buildCorsOptions(origins: string[]): CorsOptions {
  return {
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
