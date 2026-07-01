const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

// Load and register the fixed-window Lua script as a custom command.
// After this, we can call redis.fixedWindowLimiter(...) directly.
const fixedWindowScript = fs.readFileSync(
  path.join(__dirname, 'lua', 'fixedWindow.lua'),
  'utf8'
);

redis.defineCommand('fixedWindowLimiter', {
  numberOfKeys: 1,
  lua: fixedWindowScript,
});

const slidingWindowScript = fs.readFileSync(
  path.join(__dirname, 'lua', 'slidingWindow.lua'),
  'utf8'
);

redis.defineCommand('slidingWindowLimiter', {
  numberOfKeys: 2,
  lua: slidingWindowScript,
});

const tokenBucketScript = fs.readFileSync(
  path.join(__dirname, 'lua', 'tokenBucket.lua'),
  'utf8'
);

redis.defineCommand('tokenBucketLimiter', {
  numberOfKeys: 1,
  lua: tokenBucketScript,
});

module.exports = redis;