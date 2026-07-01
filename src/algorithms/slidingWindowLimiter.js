const redis = require('../redisClient');

async function slidingWindowLimiter(userId, limit, windowSeconds) {
  const key = `sliding:${userId}`;
  const counterKey = `sliding:${userId}:counter`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const result = await redis.slidingWindowLimiter(key, counterKey, now, windowMs, limit);

  return result === 1;
}

module.exports = slidingWindowLimiter;