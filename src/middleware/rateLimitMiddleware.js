const config = require('../config');
const fixedWindowLimiter = require('../algorithms/fixedWindowLimiter');
const slidingWindowLimiter = require('../algorithms/slidingWindowLimiter');
const tokenBucketLimiter = require('../algorithms/tokenBucketLimiter');

/**
 * Express middleware that enforces per-user rate limits using
 * whichever algorithm is configured in config.js.
 *
 * Identifies the "user" via the `x-user-id` header for simplicity —
 * in a real system this would come from an auth token/API key.
 */
async function rateLimitMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(400).json({ error: 'Missing x-user-id header' });
  }

  let allowed;

  try {
    switch (config.ALGORITHM) {
      case 'fixed':
        allowed = await fixedWindowLimiter(userId, config.fixed.limit, config.fixed.windowSeconds);
        break;

      case 'sliding':
        allowed = await slidingWindowLimiter(userId, config.sliding.limit, config.sliding.windowSeconds);
        break;

      case 'bucket':
        allowed = await tokenBucketLimiter(userId, config.bucket.capacity, config.bucket.refillRate);
        break;

      default:
        return res.status(500).json({ error: `Unknown algorithm: ${config.ALGORITHM}` });
    }
  } catch (err) {
    console.error('[RateLimit] Redis error:', err);
    // Fail-open vs fail-closed is a real design decision — for this project
    // we fail CLOSED (reject) so a Redis outage can't silently disable
    // rate limiting. Worth mentioning in your writeup as a tradeoff.
    return res.status(503).json({ error: 'Rate limiter unavailable' });
  }

  if (!allowed) {
    res.setHeader('Retry-After', '1');
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  next();
}

module.exports = rateLimitMiddleware;