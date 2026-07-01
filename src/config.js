module.exports = {
  ALGORITHM: process.env.RATE_LIMIT_ALGORITHM || 'fixed',

  fixed: {
    limit: parseInt(process.env.RATE_LIMIT || '100', 10),
    windowSeconds: parseInt(process.env.RATE_WINDOW || '10', 10),
  },
  sliding: {
    limit: parseInt(process.env.RATE_LIMIT || '100', 10),
    windowSeconds: parseInt(process.env.RATE_WINDOW || '10', 10),
  },
  bucket: {
    capacity: parseInt(process.env.RATE_LIMIT || '100', 10),
    refillRate: parseInt(process.env.REFILL_RATE || '10', 10),
  },
};