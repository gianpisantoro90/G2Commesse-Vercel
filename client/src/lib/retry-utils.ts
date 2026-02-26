/**
 * Retry utility for handling transient failures in external API calls
 * Implements exponential backoff strategy with configurable parameters
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
  retryOn?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  timeoutMs: 30000,
  retryOn: (error: any) => {
    // Retry on network errors and 5xx server errors
    if (error?.name === 'TypeError' || error?.message?.includes('fetch')) {
      return true;
    }
    if (error?.status >= 500 && error?.status < 600) {
      return true;
    }
    // Retry on 429 (Too Many Requests)
    if (error?.status === 429) {
      return true;
    }
    return false;
  },
};

/**
 * Executes a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${opts.timeoutMs}ms`));
        }, opts.timeoutMs);
      });

      // Race between the function and timeout
      const result = await Promise.race([fn(), timeoutPromise]);
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      const shouldRetry = opts.retryOn(error);
      const isLastAttempt = attempt === opts.maxAttempts;

      if (!shouldRetry || isLastAttempt) {
        throw error;
      }

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(attempt, error);
      }

      // Wait before retrying with exponential backoff
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Fetch wrapper with retry logic
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, init);

    // Check for HTTP errors
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }

    return response;
  }, options);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a retry wrapper with predefined options for specific API types
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, overrideOptions?: RetryOptions): Promise<T> => {
    return withRetry(fn, { ...defaultOptions, ...overrideOptions });
  };
}

// Predefined retry strategies
export const oneDriveRetry = createRetryWrapper({
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  timeoutMs: 60000, // OneDrive can be slow for large files
  onRetry: (_attempt, _error) => {
    // OneDrive retry - logging handled by retry wrapper
  },
});

export const claudeApiRetry = createRetryWrapper({
  maxAttempts: 2,
  initialDelayMs: 2000,
  maxDelayMs: 8000,
  timeoutMs: 120000, // AI responses can take time
  onRetry: (_attempt, _error) => {
    // Claude API retry - logging handled by retry wrapper
  },
});
