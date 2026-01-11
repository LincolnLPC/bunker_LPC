/**
 * Rate limiting utilities
 * Simple in-memory rate limiting (for production, consider using Redis)
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

// In-memory store (consider Redis for production with multiple instances)
const store: RateLimitStore = {}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const key in store) {
    if (store[key].resetAt < now) {
      delete store[key]
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = identifier.toLowerCase()

  // Get or initialize entry
  let entry = store[key]

  if (!entry || entry.resetAt < now) {
    // Create new window
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    }
    store[key] = entry
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
      limit: config.maxRequests,
    }
  }

  // Increment count
  entry.count++

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: config.maxRequests,
    }
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  }
}

/**
 * Get rate limit identifier from request
 * Uses IP address or user ID if authenticated
 */
export function getRateLimitIdentifier(request: Request, userId?: string): string {
  // Prefer user ID if authenticated (more accurate)
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown"

  return `ip:${ip}`
}

/**
 * Default rate limit configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  // Strict limits for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // Moderate limits for creating resources
  create: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  // More lenient for general API calls
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },
  // Very lenient for reading data
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
  },
  // Strict for chat messages (to prevent spam)
  chat: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  // Moderate for voting
  vote: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },
} as const

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": Math.max(0, result.remaining).toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetAt / 1000).toString(),
  }
}
