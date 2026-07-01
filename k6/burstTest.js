import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics — k6 tracks these alongside its built-in http_req_duration
const allowedCounter = new Counter('requests_allowed');
const rejectedCounter = new Counter('requests_rejected');
const errorCounter = new Counter('requests_errored');

export const options = {
  stages: [
    { duration: '5s', target: 50 },
    { duration: '10s', target: 500 },
    { duration: '15s', target: 500 },
    { duration: '10s', target: 50 },
    { duration: '5s', target: 0 },
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:3000/api/data';

export default function () {
  // Simulate multiple different users, not just one —
  // more realistic than hammering a single user's rate limit key.
  // __VU is k6's built-in virtual-user index.
  const userId = `k6-user-${__VU % 20}`; // 20 distinct simulated users

  const res = http.get(GATEWAY_URL, {
    headers: { 'x-user-id': userId },
  });

  if (res.status === 200) {
    allowedCounter.add(1);
  } else if (res.status === 429) {
    rejectedCounter.add(1);
  } else {
    errorCounter.add(1);
  }

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
}