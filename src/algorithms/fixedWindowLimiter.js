const redis = require('../redisClient');

/**
 * Atomic fixed-window rate limiter using Lua scripting.
 *
 * @param {string} userId
 * @param {number} limit
 * @param {number} windowSeconds
 * @returns {Promise<boolean>} true if allowed, false if rejected
 */
async function fixedWindowLimiter(userId, limit, windowSeconds) {
  const key = `fixed:${userId}`;

  // This calls our Lua script atomically via the custom command
  // we registered with defineCommand in redisClient.js
  const result = await redis.fixedWindowLimiter(key, limit, windowSeconds);

  return result === 1;
}

module.exports = fixedWindowLimiter;