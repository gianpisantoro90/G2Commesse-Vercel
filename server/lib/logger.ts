/**
 * Structured logging utility for the application
 * Provides consistent logging format and levels
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';
  private minLevel: LogLevel;

  constructor() {
    // Set minimum log level based on environment
    this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.minLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(level);

    let formatted = `[${timestamp}] ${emoji} ${level}: ${message}`;

    if (context && Object.keys(context).length > 0) {
      formatted += ' ' + JSON.stringify(this.sanitizeContext(context));
    }

    return formatted;
  }

  private getEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return '❌';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.DEBUG:
        return '🔍';
      default:
        return '📝';
    }
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
      // Redact sensitive fields
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key')
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  // Specialized logging methods
  http(method: string, path: string, statusCode: number, duration?: number): void {
    const emoji = statusCode >= 400 ? '❌' : statusCode >= 300 ? '➡️' : '✅';
    const message = `${emoji} ${method} ${path} - ${statusCode}`;
    const context: LogContext = { method, path, statusCode };

    if (duration !== undefined) {
      context.duration = `${duration}ms`;
    }

    this.info(message, context);
  }

  security(event: string, context?: LogContext): void {
    this.warn(`🔐 Security Event: ${event}`, context);
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    const threshold = 1000; // 1 second
    const level = duration > threshold ? LogLevel.WARN : LogLevel.DEBUG;
    const message = `⏱️ Performance: ${operation} took ${duration}ms`;

    if (level === LogLevel.WARN) {
      this.warn(message, context);
    } else {
      this.debug(message, context);
    }
  }

  database(operation: string, table?: string, context?: LogContext): void {
    this.debug(`💾 Database: ${operation}${table ? ` on ${table}` : ''}`, context);
  }

  external(service: string, operation: string, context?: LogContext): void {
    this.debug(`🌐 External Service: ${service} - ${operation}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export request timing middleware
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();

  // Log incoming request
  logger.debug(`Incoming request`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - start;
    logger.http(req.method, req.path, res.statusCode, duration);
    return originalSend.call(this, data);
  };

  next();
}
