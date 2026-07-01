const redis = require('../redisClient');

/**
 * Atomic token-bucket rate limiter.
 *
 * @param {string} userId
 * @param {number} capacity - max tokens the bucket holds (i.e. max burst size)
 * @param {number} refillRate - tokens added per second
 * @returns {Promise<boolean>}
 */
async function tokenBucketLimiter(userId, capacity, refillRate) {
  const key = `bucket:${userId}`;
  const now = Date.now();

  const result = await redis.tokenBucketLimiter(key, capacity, refillRate, now);

  return result === 1;
}

module.exports = tokenBucketLimiter;