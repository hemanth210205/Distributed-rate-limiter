const tokenBucketLimiter = require('../src/algorithms/tokenBucketLimiter');
const redis = require('../src/redisClient');

async function runConcurrencyTest() {
  const userId = 'race-test-user-bucket';
  const capacity = 5;      // bucket holds max 5 tokens
  const refillRate = 0.1;  // refills slowly — irrelevant for this instant burst test

  await redis.del(`bucket:${userId}`);

  const concurrentRequests = 20;

  console.log(`Firing ${concurrentRequests} concurrent requests, capacity = ${capacity}...\n`);

  const promises = [];
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(tokenBucketLimiter(userId, capacity, refillRate));
  }

  const results = await Promise.all(promises);

  const allowedCount = results.filter(r => r === true).length;
  const rejectedCount = results.filter(r => r === false).length;

  console.log(`Allowed:  ${allowedCount}`);
  console.log(`Rejected: ${rejectedCount}`);
  console.log(`Expected allowed: ${capacity} (bucket starts full)`);

  if (allowedCount === capacity) {
    console.log(`\n✅ CORRECT: exactly ${capacity} requests allowed`);
  } else {
    console.log(`\n❌ Something's wrong — got ${allowedCount}, expected ${capacity}`);
  }

  process.exit(0);
}

runConcurrencyTest();