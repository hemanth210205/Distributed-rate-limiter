-- KEYS[1] = bucket key (e.g. "bucket:user123")
-- ARGV[1] = capacity (max tokens the bucket can hold)
-- ARGV[2] = refillRate (tokens added per second)
-- ARGV[3] = now (current timestamp in milliseconds)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Read existing bucket state: [tokens, lastRefillTimestamp]
local bucket = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

-- If this is the first request ever, initialize a full bucket
if tokens == nil then
  tokens = capacity
  lastRefill = now
end

-- Calculate how many tokens to add based on elapsed time since last refill
local elapsedSeconds = math.max(0, (now - lastRefill) / 1000)
local refillAmount = elapsedSeconds * refillRate
tokens = math.min(capacity, tokens + refillAmount)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

-- Persist updated state
redis.call('HMSET', key, 'tokens', tokens, 'ts', now)

-- Expire the key after enough time has passed that the bucket
-- would be fully refilled anyway (memory hygiene for idle users)
local ttlSeconds = math.ceil(capacity / refillRate) * 2
redis.call('EXPIRE', key, ttlSeconds)

return allowed