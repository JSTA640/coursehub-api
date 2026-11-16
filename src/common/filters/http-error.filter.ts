import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { pathWithoutQuery } from '../http/request-path.js';

export type HttpErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
};

// Traduce cualquier excepción a una forma de error uniforme.
// La respuesta pública nunca incluye traza, SQL ni variables de entorno:
// esos detalles solo van al registro interno.
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpErrorFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const path = pathWithoutQuery(request.originalUrl ?? request.url);
    const requestId = response.locals?.requestId as string | undefined;

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status >= 500;

    let error = 'Internal Server Error';
    let message: string | string[] = 'Internal server error';
    if (isHttp && !isServerError) {
      ({ error, message } = describeHttpException(exception));
    }

    if (isServerError) {
      // Registro interno con el detalle real (incluida la traza) para diagnosticar.
      const detail = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${path} requestId=${requestId ?? '-'} ${detail}`);
    } else {
      this.logger.warn(
        `${request.method} ${path} ${status} requestId=${requestId ?? '-'} ${JSON.stringify(message)}`,
      );
    }

    const body: HttpErrorBody = {
      statusCode: status,
      error,
      message,
      path,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    };
    response.status(status).json(body);
  }
}

function describeHttpException(exception: HttpException): {
  error: string;
  message: string | string[];
} {
  const payload = exception.getResponse();
  // "NotFoundException" -> "Not Found"
  const fallbackError = exception.name
    .replace(/Exception$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

  if (typeof payload === 'string') {
    return { error: fallbackError, message: payload };
  }
  const { error, message } = payload as { error?: unknown; message?: unknown };
  return {
    error: typeof error === 'string' ? error : fallbackError,
    message:
      typeof message === 'string' || Array.isArray(message)
        ? (message as string | string[])
        : exception.message,
  };
}
