import { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipRequestMap = new Map<string, RateLimitRecord>();

/**
 * In-memory sliding window rate limiter
 * @param req NextRequest
 * @param maxRequests Maximum requests allowed within windowMs (default 20)
 * @param windowMs Time window in milliseconds (default 5 minutes)
 */
export function checkRateLimit(
  req: NextRequest,
  maxRequests: number = 20,
  windowMs: number = 5 * 60 * 1000
): { allowed: boolean; remaining: number } {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = (forwarded ? forwarded.split(',')[0].trim() : realIp) || '127.0.0.1';

  const now = Date.now();
  const record = ipRequestMap.get(ip);

  if (!record || now > record.resetTime) {
    ipRequestMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}
