const express = require('express');
const rateLimitMiddleware = require('./middleware/rateLimitMiddleware');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;
const INSTANCE_ID = process.env.INSTANCE_ID || 'default';

// Allow the dashboard (opened as a local file or different port) to call this API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-user-id, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(rateLimitMiddleware);

app.get('/api/data', (req, res) => {
  res.json({
    message: 'Success',
    algorithm: config.ALGORITHM,
    instance: INSTANCE_ID,
    timestamp: Date.now(),
  });
});

app.listen(PORT, () => {
  console.log(`Gateway [${INSTANCE_ID}] running on port ${PORT} | Algorithm: ${config.ALGORITHM}`);
});