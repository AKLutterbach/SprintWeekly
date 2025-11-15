import pino from 'pino';

/**
 * Simple pino-based logger wrapper.
 * Exports a root logger and helpers to create request-scoped child loggers.
 * This keeps logs consistent across modules and makes it easy to attach requestId.
 */

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childWithRequestId(requestId: string) {
  return baseLogger.child({ requestId });
}

export function log(level: 'info' | 'warn' | 'error' | 'debug', msg: string, meta?: Record<string, unknown>) {
  baseLogger[level](meta || {}, msg);
}

export default baseLogger;
