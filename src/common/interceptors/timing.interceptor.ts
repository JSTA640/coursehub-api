import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { pathWithoutQuery } from '../http/request-path.js';

export const RESPONSE_TIME_HEADER = 'X-Response-Time';

// Envuelve el método del controlador para medir cuánto tarda.
// No registra cuerpos, no transforma el resultado y no oculta errores:
// ante un error solo mide y deja que la excepción siga hacia el filter.
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Timing');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const started = Date.now();

    const record = (outcome: 'ok' | 'error') => {
      const durationMs = Date.now() - started;
      if (!response.headersSent) {
        response.setHeader(RESPONSE_TIME_HEADER, `${durationMs}ms`);
      }
      this.logger.log(
        JSON.stringify({
          handler,
          method: request.method,
          path: pathWithoutQuery(request.originalUrl ?? request.url),
          outcome,
          durationMs,
        }),
      );
    };

    return next.handle().pipe(
      tap({
        next: () => record('ok'),
        error: () => record('error'),
      }),
    );
  }
}
