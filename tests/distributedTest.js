const http = require('http');

function makeRequest(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port,
      path: '/api/data',
      method: 'GET',
      headers: { 'x-user-id': 'distributed-test-user' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ port, status: res.statusCode, body: JSON.parse(data) });
      });
    });

    req.on('error', (err) => resolve({ port, status: 'ERROR', error: err.message }));
    req.end();
  });
}

async function runDistributedTest() {
  const ports = [3001, 3002, 3003];
  const requestsPerPort = 7; // 7 x 3 = 21 total requests across 3 instances, limit = 10

  console.log(`Firing ${requestsPerPort} requests to EACH of ${ports.length} instances (${requestsPerPort * ports.length} total), limit = 10\n`);

  const promises = [];
  for (const port of ports) {
    for (let i = 0; i < requestsPerPort; i++) {
      promises.push(makeRequest(port));
    }
  }

  const results = await Promise.all(promises);

  const allowed = results.filter(r => r.status === 200);
  const rejected = results.filter(r => r.status === 429);

  console.log(`Total Allowed:  ${allowed.length}`);
  console.log(`Total Rejected: ${rejected.length}`);
  console.log(`Expected allowed: 10 (shared across all instances)\n`);

  for (const port of ports) {
    const portResults = results.filter(r => r.port === port);
    const portAllowed = portResults.filter(r => r.status === 200).length;
    console.log(`  Port ${port}: ${portAllowed}/${requestsPerPort} allowed`);
  }

  if (allowed.length === 10) {
    console.log(`\n✅ DISTRIBUTED CORRECTNESS CONFIRMED: exactly 10 allowed across 3 independent processes`);
  } else {
    console.log(`\n❌ Something's wrong — got ${allowed.length} total allowed, expected 10`);
  }
}

runDistributedTest();