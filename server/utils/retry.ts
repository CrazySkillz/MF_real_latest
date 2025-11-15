/**
 * Retry utility for handling transient failures
 * Implements exponential backoff with jitter
 */

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    // Retry on 5xx server errors and 429 (rate limit)
    if (error.response?.status >= 500 || error.response?.status === 429) {
      return true;
    }
    
    // Don't retry on 4xx client errors (except 429)
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return false;
    }
    
    return true; // Retry on unknown errors
  }
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
  
  // Add jitter (random variation of ±25%)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  
  return Math.floor(cappedDelay + jitter);
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retries fail
 * 
 * @example
 * const result = await retryWithBackoff(
 *   async () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt}/${opts.maxAttempts}`);
      const result = await fn();
      
      if (attempt > 1) {
        console.log(`[Retry] Success on attempt ${attempt}`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        console.log(`[Retry] Error not retryable:`, error.message);
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === opts.maxAttempts) {
        console.error(`[Retry] All ${opts.maxAttempts} attempts failed`);
        throw error;
      }
      
      // Calculate delay and wait before next attempt
      const delay = calculateDelay(attempt, opts);
      console.log(`[Retry] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await sleep(delay);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Retry specifically for OAuth token exchanges
 * Configured for OAuth-specific error handling
 */
export async function retryOAuthExchange<T>(
  fn: () => Promise<T>
): Promise<T> {
  return retryWithBackoff(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    shouldRetry: (error: any) => {
      // Don't retry on invalid_grant or invalid_client (permanent errors)
      if (error.response?.data?.error === 'invalid_grant' || 
          error.response?.data?.error === 'invalid_client' ||
          error.response?.data?.error === 'unauthorized_client') {
        console.log('[OAuth Retry] Permanent OAuth error, not retrying:', error.response?.data?.error);
        return false;
      }
      
      // Don't retry on 400 Bad Request (usually means invalid code)
      if (error.response?.status === 400) {
        console.log('[OAuth Retry] Bad request, not retrying');
        return false;
      }
      
      // Retry on network errors and 5xx errors
      if (error.code === 'ECONNRESET' || 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ENOTFOUND' ||
          error.response?.status >= 500) {
        console.log('[OAuth Retry] Transient error, will retry:', error.message);
        return true;
      }
      
      return false;
    }
  });
}

/**
 * Retry for API calls with rate limit handling
 */
export async function retryApiCall<T>(
  fn: () => Promise<T>,
  apiName: string = 'API'
): Promise<T> {
  return retryWithBackoff(fn, {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    shouldRetry: (error: any) => {
      // Handle rate limiting (429)
      if (error.response?.status === 429) {
        const retryAfter = error.response?.headers?.['retry-after'];
        if (retryAfter) {
          console.log(`[${apiName} Retry] Rate limited. Retry after: ${retryAfter}s`);
        }
        return true;
      }
      
      // Retry on 5xx server errors
      if (error.response?.status >= 500) {
        console.log(`[${apiName} Retry] Server error ${error.response.status}, will retry`);
        return true;
      }
      
      // Retry on network errors
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        console.log(`[${apiName} Retry] Network error ${error.code}, will retry`);
        return true;
      }
      
      return false;
    }
  });
}

