

interface RateLimitStore {
  count: number;
  timestamp: number;
}

// In-memory store for rate limiting (Note: resets on server restart/serverless function cold start)
const rateLimitMap = new Map<string, RateLimitStore>();

// Clear old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, store] of rateLimitMap.entries()) {
    if (now - store.timestamp > 60000) { // 1 minute window
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

/**
 * Basic in-memory rate limiter.
 * @param ip - The IP address or unique identifier of the client.
 * @param limit - Maximum number of requests allowed within the window.
 * @param windowMs - Time window in milliseconds (default: 60000ms = 1 minute).
 * @returns boolean - True if request is allowed, false if limit is exceeded.
 */
export function isRateLimited(ip: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const store = rateLimitMap.get(ip);

  if (!store) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return false;
  }

  // If window has passed, reset
  if (now - store.timestamp > windowMs) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return false;
  }

  // Increment count
  store.count++;
  
  if (store.count > limit) {
    return true; // Rate limited
  }

  return false;
}

/**
 * Extracts the IP address from a Next.js Request object.
 */
export function getIP(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1'; // Fallback
}
