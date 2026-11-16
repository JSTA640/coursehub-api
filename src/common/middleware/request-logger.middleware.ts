import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { pathWithoutQuery } from '../http/request-path.js';

export const REQUEST_ID_HEADER = 'x-request-id';

// Trabajo HTTP general, antes del enrutamiento: identificador y registro de cada solicitud.
// Solo contexto operativo: nunca Authorization, cookies, cuerpo, contraseñas ni tokens.
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    res.on('finish', () => {
      this.logger.log(
        JSON.stringify({
          requestId,
          method: req.method,
          path: pathWithoutQuery(req.originalUrl),
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      );
    });

    next();
  }
}
