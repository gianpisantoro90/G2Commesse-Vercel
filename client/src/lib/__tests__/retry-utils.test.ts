import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, fetchWithRetry } from '../retry-utils';

describe('Retry Utilities', () => {
  beforeEach(() => {
    // Don't use fake timers by default - only in specific tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const successFn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(successFn, { maxAttempts: 3 });

      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on non-retryable errors', async () => {
      const clientError = new Error('Bad Request');
      (clientError as any).status = 400;

      const failWith400 = vi.fn().mockRejectedValue(clientError);

      await expect(
        withRetry(failWith400, {
          maxAttempts: 3,
          retryOn: (error) => {
            return error?.status >= 500;
          },
        })
      ).rejects.toThrow('Bad Request');

      expect(failWith400).toHaveBeenCalledTimes(1);
    });

    it('should timeout after specified duration', async () => {
      const slowFunction = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('too late'), 10000);
          })
      );

      await expect(
        withRetry(slowFunction, {
          maxAttempts: 1,
          timeoutMs: 50,
        })
      ).rejects.toThrow('Request timeout');

      expect(slowFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchWithRetry', () => {
    it('should retry on 500 errors', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        } as Response);

      const response = await fetchWithRetry('/api/test', undefined, {
        maxAttempts: 2,
        initialDelayMs: 1,
        timeoutMs: 1000,
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 errors by default', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(
        fetchWithRetry('/api/test', undefined, {
          maxAttempts: 3,
        })
      ).rejects.toThrow('HTTP 400');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 rate limit errors', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        } as Response);

      const response = await fetchWithRetry('/api/test', undefined, {
        maxAttempts: 2,
        initialDelayMs: 1,
        timeoutMs: 1000,
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
