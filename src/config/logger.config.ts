import type { LogLevel } from '@nestjs/common';
import type { AppLogLevel } from './env.validation.js';

// Cada nivel incluye los niveles más severos que él.
const LEVELS_BY_SETTING: Record<AppLogLevel, LogLevel[]> = {
  debug: ['error', 'warn', 'log', 'debug'],
  log: ['error', 'warn', 'log'],
  warn: ['error', 'warn'],
  error: ['error'],
};

export function resolveLogLevels(level: AppLogLevel): LogLevel[] {
  return LEVELS_BY_SETTING[level];
}
