import Joi from 'joi';

export const LOG_LEVELS = ['debug', 'log', 'warn', 'error'] as const;
export type AppLogLevel = (typeof LOG_LEVELS)[number];

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  // Vacía solo se permite fuera de producción.
  DB_PASSWORD: Joi.string()
    .allow('')
    .required()
    // oxlint-disable-next-line unicorn/no-thenable -- `then` es parte de la API de Joi.when
    .when('NODE_ENV', { is: 'production', then: Joi.string().min(1) }),
  // Valor predeterminado: 'log' (muestra log, warn y error).
  LOG_LEVEL: Joi.string()
    .valid(...LOG_LEVELS)
    .default('log'),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^[1-9]\d*(?:ms|s|m|h|d|w|y)$/)
    .default('15m'),
});
