const redis = require('../redisClient');

/**
 * NAIVE, INTENTIONALLY BROKEN rate limiter.
 * Uses separate GET and INCR calls — NOT atomic.
 * This WILL allow more requests than the limit under concurrency.
 *
 * @param {string} userId
 * @param {number} limit - max requests allowed per window
 * @param {number} windowSeconds - window size in seconds
 * @returns {Promise<boolean>} true if allowed, false if rate-limited
 */
async function naiveRateLimiter(userId, limit, windowSeconds) {
  const key = `naive:${userId}`;

  // Step 1: read current count
  const current = await redis.get(key);
  const count = current ? parseInt(current, 10) : 0;

  // ⚠️ RACE WINDOW: between this read and the write below,
  // other concurrent calls can also read the same stale `count`.

  if (count >= limit) {
    return false; // rejected
  }

  // Step 2: increment
  const newCount = await redis.incr(key);

  // Set expiry only on first request in this window
  if (newCount === 1) {
    await redis.expire(key, windowSeconds);
  }

  return true; // allowed
}

module.exports = naiveRateLimiter;