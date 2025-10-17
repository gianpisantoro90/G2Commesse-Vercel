import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should log error messages', () => {
      logger.error('Test error');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('ERROR');
      expect(loggedMessage).toContain('Test error');
      expect(loggedMessage).toContain('❌');
    });

    it('should log warning messages', () => {
      logger.warn('Test warning');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedMessage = consoleWarnSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('WARN');
      expect(loggedMessage).toContain('Test warning');
      expect(loggedMessage).toContain('⚠️');
    });

    it('should log info messages', () => {
      logger.info('Test info');

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('INFO');
      expect(loggedMessage).toContain('Test info');
      expect(loggedMessage).toContain('ℹ️');
    });

    it('should log debug messages', () => {
      logger.debug('Test debug');

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('DEBUG');
      expect(loggedMessage).toContain('Test debug');
      expect(loggedMessage).toContain('🔍');
    });
  });

  describe('Context Logging', () => {
    it('should include context in log messages', () => {
      logger.info('Test with context', { userId: '123', action: 'create' });

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('userId');
      expect(loggedMessage).toContain('123');
      expect(loggedMessage).toContain('action');
      expect(loggedMessage).toContain('create');
    });

    it('should sanitize sensitive data in context', () => {
      logger.info('Sensitive data test', {
        username: 'john',
        password: 'secret123',
        apiKey: 'sk-abc123',
        token: 'bearer-token',
      });

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('username');
      expect(loggedMessage).toContain('john');
      expect(loggedMessage).toContain('[REDACTED]');
      expect(loggedMessage).not.toContain('secret123');
      expect(loggedMessage).not.toContain('sk-abc123');
      expect(loggedMessage).not.toContain('bearer-token');
    });

    it('should sanitize nested sensitive data', () => {
      logger.info('Nested sensitive data', {
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            apiKey: 'key123',
          },
        },
      });

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('John');
      expect(loggedMessage).toContain('[REDACTED]');
      expect(loggedMessage).not.toContain('secret');
      expect(loggedMessage).not.toContain('key123');
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log HTTP requests', () => {
      logger.http('GET', '/api/users', 200, 150);

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('GET');
      expect(loggedMessage).toContain('/api/users');
      expect(loggedMessage).toContain('200');
      expect(loggedMessage).toContain('150ms');
    });

    it('should use error emoji for 4xx/5xx status codes', () => {
      logger.http('POST', '/api/login', 401);

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('❌');
      expect(loggedMessage).toContain('401');
    });

    it('should log security events', () => {
      logger.security('Failed login attempt', { ip: '192.168.1.1' });

      const loggedMessage = consoleWarnSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('🔐');
      expect(loggedMessage).toContain('Security Event');
      expect(loggedMessage).toContain('Failed login attempt');
    });

    it('should log performance warnings for slow operations', () => {
      logger.performance('Database query', 2000);

      const loggedMessage = consoleWarnSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('⏱️');
      expect(loggedMessage).toContain('Performance');
      expect(loggedMessage).toContain('2000ms');
    });

    it('should log fast operations as debug', () => {
      logger.performance('Cache lookup', 50);

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('⏱️');
      expect(loggedMessage).toContain('50ms');
    });

    it('should log database operations', () => {
      logger.database('INSERT', 'users', { recordCount: 1 });

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('💾');
      expect(loggedMessage).toContain('Database');
      expect(loggedMessage).toContain('INSERT');
      expect(loggedMessage).toContain('users');
    });

    it('should log external service calls', () => {
      logger.external('OneDrive', 'upload file');

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('🌐');
      expect(loggedMessage).toContain('External Service');
      expect(loggedMessage).toContain('OneDrive');
      expect(loggedMessage).toContain('upload file');
    });
  });

  describe('Message Formatting', () => {
    it('should include timestamp in log messages', () => {
      logger.info('Test timestamp');

      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      // Check for ISO date format (YYYY-MM-DD)
      expect(loggedMessage).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should format messages consistently', () => {
      logger.error('Consistent format test');

      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      // Format: [timestamp] emoji LEVEL: message
      expect(loggedMessage).toMatch(/\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] ❌ ERROR: Consistent format test/);
    });
  });
});
