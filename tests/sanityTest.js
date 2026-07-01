const naiveRateLimiter = require('../src/algorithms/naiveLimiter');

(async () => {
  const userId = 'test-user-1';
  const limit = 5;
  const windowSeconds = 10;

  for (let i = 1; i <= 7; i++) {
    const allowed = await naiveRateLimiter(userId, limit, windowSeconds);
    console.log(`Request ${i}: ${allowed ? 'ALLOWED ✅' : 'REJECTED ❌'}`);
  }

  process.exit(0);
})();