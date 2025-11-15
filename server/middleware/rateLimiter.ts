import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for OAuth endpoints
 * Prevents abuse of authentication flows
 */
export const oauthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OAuth requests per windowMs
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for test mode
  skip: (req) => {
    return req.body?.isTestMode === true;
  }
});

/**
 * Rate limiter for LinkedIn API calls
 * Protects against API quota exhaustion
 */
export const linkedInApiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per minute (LinkedIn's typical limit)
  message: {
    error: 'Too many LinkedIn API requests. Please slow down.',
    retryAfter: 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for test mode
  skip: (req) => {
    return req.body?.isTestMode === true;
  }
});

/**
 * Rate limiter for data import operations
 * Prevents overwhelming the database with large imports
 */
export const importRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 imports per 5 minutes
  message: {
    error: 'Too many import operations. Please wait before importing more data.',
    retryAfter: 5 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for test mode
  skip: (req) => {
    return req.body?.isTestMode === true;
  }
});

/**
 * Rate limiter for Google Sheets API calls
 */
export const googleSheetsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Google Sheets API: 60 requests per minute per user
  message: {
    error: 'Too many Google Sheets API requests. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for GA4 API calls
 */
export const ga4RateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // GA4 API: 60 requests per minute per user
  message: {
    error: 'Too many Google Analytics API requests. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * General API rate limiter
 * Protects all API endpoints from abuse
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 minutes
  message: {
    error: 'Too many requests. Please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

