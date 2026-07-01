const naiveRateLimiter = require('../src/algorithms/naiveLimiter');
const redis = require('../src/redisClient');

async function runConcurrencyTest() {
  const userId = 'race-test-user';
  const limit = 5;
  const windowSeconds = 10;

  // Clean slate — remove any leftover key from previous runs
  await redis.del(`naive:${userId}`);

  const concurrentRequests = 20; // fire 20 requests AT ONCE for a limit of 5

  console.log(`Firing ${concurrentRequests} concurrent requests, limit = ${limit}...\n`);

  // Promise.all fires all requests in parallel — this is the key difference
  // from a for-loop, which would await each one sequentially.
  const promises = [];
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(naiveRateLimiter(userId, limit, windowSeconds));
  }

  const results = await Promise.all(promises);

  const allowedCount = results.filter(r => r === true).length;
  const rejectedCount = results.filter(r => r === false).length;

  console.log(`Allowed:  ${allowedCount}`);
  console.log(`Rejected: ${rejectedCount}`);
  console.log(`Expected allowed: ${limit}`);

  if (allowedCount > limit) {
    console.log(`\n❌ RACE CONDITION CONFIRMED: ${allowedCount} requests allowed, but limit was ${limit}`);
  } else {
    console.log(`\n✅ No race condition observed this run (may need more attempts — see note below)`);
  }

  process.exit(0);
}

runConcurrencyTest();