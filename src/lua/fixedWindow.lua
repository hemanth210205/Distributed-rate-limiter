-- KEYS[1] = rate limit key (e.g. "fixed:user123")
-- ARGV[1] = limit (max requests allowed)
-- ARGV[2] = window size in seconds

local current = redis.call('INCR', KEYS[1])

if current == 1 then
  -- first request in this window — set expiry
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end

if current > tonumber(ARGV[1]) then
  return 0  -- rejected
end

return 1  -- allowed