const slidingWindowLimiter = require('../src/algorithms/slidingWindowLimiter');
const redis = require('../src/redisClient');

async function runConcurrencyTest() {
  const userId = 'race-test-user-sliding';
  const limit = 5;
  const windowSeconds = 10;

  await redis.del(`sliding:${userId}`, `sliding:${userId}:counter`);

  const concurrentRequests = 20;

  console.log(`Firing ${concurrentRequests} concurrent requests, limit = ${limit}...\n`);

  const promises = [];
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(slidingWindowLimiter(userId, limit, windowSeconds));
  }

  const results = await Promise.all(promises);

  const allowedCount = results.filter(r => r === true).length;
  const rejectedCount = results.filter(r => r === false).length;

  console.log(`Allowed:  ${allowedCount}`);
  console.log(`Rejected: ${rejectedCount}`);
  console.log(`Expected allowed: ${limit}`);

  if (allowedCount === limit) {
    console.log(`\n✅ CORRECT: exactly ${limit} requests allowed`);
  } else {
    console.log(`\n❌ Something's wrong — got ${allowedCount}, expected ${limit}`);
  }

  process.exit(0);
}

runConcurrencyTest();