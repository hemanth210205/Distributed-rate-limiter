-- KEYS[1] = rate limit key (e.g. "sliding:user123")
-- KEYS[2] = companion counter key for generating unique member IDs
-- ARGV[1] = current timestamp in milliseconds
-- ARGV[2] = window size in milliseconds
-- ARGV[3] = limit

local key = KEYS[1]
local counterKey = KEYS[2]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

-- Step 1: remove entries outside the current window
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Step 2: count how many requests remain inside the window
local count = redis.call('ZCARD', key)

if count < limit then
  -- Step 3: generate a guaranteed-unique member ID using an atomic counter
  -- instead of math.random(), which is reseeded per script execution
  -- and can produce duplicate values across near-simultaneous calls.
  local uniqueId = redis.call('INCR', counterKey)
  local member = now .. '-' .. uniqueId

  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window * 2)
  redis.call('PEXPIRE', counterKey, window * 2)

  return 1  -- allowed
end

return 0  -- rejected