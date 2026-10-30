# Distributed Rate Limiter 

A high-throughput, distributed rate limiting service built with **Node.js**, **Redis**, and **Docker**. Implements three industry-standard algorithms using **atomic Redis Lua scripts** to ensure strict cross-node consistency — eliminating race conditions, burst overages, and synchronization delays across distributed instances.

---

## Features

- **3 Core Algorithms**: Fixed Window Counter, Sliding Window Log, and Token Bucket.
- **Zero Race Conditions**: Atomic execution inside Redis via custom Lua scripts (`ioredis.defineCommand`).
- **Distributed Architecture**: Multiple independent gateway nodes sharing a single Redis state layer.
- **Fail-Closed Resilience**: Rejects traffic (503 Service Unavailable) if Redis drops to protect upstream services.
- **Comprehensive Test Suite**: Automated race condition benchmarks comparing non-atomic (naive) vs. atomic implementations, plus distributed multi-node tests.
- **Production Ready**: Full Docker Compose orchestration, healthchecks, and k6 load-testing scripts.

---

## Architecture

```
                  Client Requests (with x-user-id)
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
          ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │   Node 1    │ │   Node 2    │ │   Node 3    │
          │  Port 3001  │ │  Port 3002  │ │  Port 3003  │
          │ Fixed Window│ │Sliding Win  │ │Token Bucket │
          └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
                 │               │               │
                 └───────────────┼───────────────┘
                                 │
                   Atomic Lua Script Execution
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │     Redis Cluster     │
                     │       Port 6379       │
                     │  (Shared Global State)│
                     └───────────────────────┘
```

When a request arrives at any gateway node (`node1`, `node2`, or `node3`), the node checks the user's quota directly in Redis through an atomic Lua script. Increments and quota evaluations occur inside Redis in a single event-loop cycle, ensuring immediate synchronization across all cluster nodes.

---

## Algorithms Supported

| Algorithm | Mechanism | Best For | Lua Script |
|---|---|---|---|
| **Fixed Window** | Counts requests in fixed time intervals (e.g. 100 req / 10s). Resets at window boundary. | Simple rate limits, lower memory footprint | [`src/lua/fixedWindow.lua`](file:///src/lua/fixedWindow.lua) |
| **Sliding Window** | Uses Redis Sorted Sets (`ZADD`, `ZREMRANGEBYSCORE`) to track request timestamps in a rolling window. Eliminates window-boundary burst exploits. | Strict, accurate per-user rate limiting | [`src/lua/slidingWindow.lua`](file:///src/lua/slidingWindow.lua) |
| **Token Bucket** | Fills bucket with tokens at a steady refill rate up to maximum capacity. Consumes tokens on requests. | APIs allowing controlled burst traffic with steady sustained rates | [`src/lua/tokenBucket.lua`](file:///src/lua/tokenBucket.lua) |

### The Concurrency Problem: Naive vs. Atomic

A naive rate limiter uses separate `GET` and `INCR` calls:
```javascript
// NAIVE (RACE CONDITION RISK):
const count = await redis.get(key);
if (count >= limit) return false;
await redis.incr(key); // Concurrent requests read stale count before this executes!
```
Under high concurrency, multiple requests read the same initial count before any of them write the increment, letting requests bypass the limit.

**Our Solution**: All logic runs inside a **Redis Lua script**. Redis executes Lua scripts as a single atomic transaction. No other command or script can run concurrently on that key, completely eliminating race conditions.

---

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **State Store**: Redis 7
- **Redis Client**: `ioredis` (with Lua custom command definitions)
- **Containerization**: Docker & Docker Compose
- **Load Testing**: k6

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for containerized execution)
- [Node.js](https://nodejs.org/) (v18+ if running locally without Docker)
- [Redis](https://redis.io/) (v6+ if running locally without Docker)
- [k6](https://k6.io/docs/get-started/installation/) (optional, for load testing)

---

### Method 1: Run with Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hemanth210205/Distributed-rate-limiter.git
   cd Distributed-rate-limiter
   ```

2. **Build and start the cluster:**
   ```bash
   docker compose up --build
   ```

3. **Verify the services:**
   You will see Redis initialize, followed by the three gateway instances:
   - `rate-limiter-node1` on `http://localhost:3001` (Fixed Window)
   - `rate-limiter-node2` on `http://localhost:3002` (Sliding Window)
   - `rate-limiter-node3` on `http://localhost:3003` (Token Bucket)

4. **Stop the cluster:**
   ```bash
   docker compose down
   ```

---

### Method 2: Run Locally (Without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Ensure Redis is running locally:**
   ```bash
   # Start Redis service or run via Docker
   docker run -d --name local-redis -p 6379:6379 redis:7-alpine
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

4. **Start an instance:**
   ```bash
   # Default server (port 3000, fixed window)
   npm start

   # Or run specific algorithms
   npm run start:fixed
   npm run start:sliding
   npm run start:bucket

   # Or run dedicated instances on ports 3001, 3002, 3003
   npm run instance1
   npm run instance2
   npm run instance3
   ```

---

## API Usage

All API requests require the `x-user-id` header to identify the client.

### Endpoint

```http
GET /api/data
x-user-id: <user_identifier>
```

#### Responses

- **200 OK** — Request permitted:
  ```json
  {
    "message": "Success",
    "algorithm": "fixed",
    "instance": "node1",
    "timestamp": 1782936472879
  }
  ```

- **429 Too Many Requests** — Rate limit exceeded:
  ```json
  {
    "error": "Too Many Requests"
  }
  ```
  *(Response includes header `Retry-After: 1`)*

- **400 Bad Request** — Missing identifier header:
  ```json
  {
    "error": "Missing x-user-id header"
  }
  ```

- **503 Service Unavailable** — Redis offline (Fail-closed design):
  ```json
  {
    "error": "Rate limiter unavailable"
  }
  ```

---

### Quick Testing with curl

#### Test individual nodes
```bash
# Node 1: Fixed Window
curl -H "x-user-id: alice" http://localhost:3001/api/data

# Node 2: Sliding Window
curl -H "x-user-id: alice" http://localhost:3002/api/data

# Node 3: Token Bucket
curl -H "x-user-id: alice" http://localhost:3003/api/data
```

#### Trigger rate limiting

**Bash (Linux / macOS / WSL):**
```bash
for i in {1..15}; do curl -s -H "x-user-id: testuser" http://localhost:3001/api/data; echo; done
```

**PowerShell (Windows):**
```powershell
1..15 | ForEach-Object { curl.exe -s -H "x-user-id: testuser" http://localhost:3001/api/data; Write-Host "" }
```

---

## Automated Concurrency & Distributed Tests

The project includes built-in test scripts demonstrating race conditions and verifying distributed correctness.

Ensure Redis is running locally (`localhost:6379`), then run:

| Command | Purpose |
|---|---|
| `npm run test:sanity` | Verifies basic request allowance and rejection behavior. |
| `npm run test:race:naive` | **Confirms the race condition**: Fires 20 concurrent requests with limit 5 using `GET + INCR`. Shows allowed requests exceeding the quota. |
| `npm run test:race:fixed` | Tests atomic Fixed Window script under parallel load; confirms exactly 5 requests are permitted. |
| `npm run test:race:sliding` | Tests atomic Sliding Window script under parallel load. |
| `npm run test:race:bucket` | Tests atomic Token Bucket script under parallel load. |
| `npm run test:distributed` | Fires concurrent requests across **all three ports (3001, 3002, 3003)** to verify distributed state sharing. |

---

## Load Testing with k6

Simulate burst traffic and monitor latency under high load:

```bash
# Install k6 (https://k6.io/docs/get-started/installation/)

# Run burst test against node1
GATEWAY_URL=http://localhost:3001/api/data k6 run k6/burstTest.js
```

The k6 test ramps up to **500 virtual users** across 20 distinct simulated client IDs, collecting:
- `requests_allowed` (HTTP 200)
- `requests_rejected` (HTTP 429)
- `requests_errored` (Non-rate-limit errors)
- p50, p90, p95, and p99 response latencies

---

## Configuration Reference

Configure limits via environment variables or [.env](file:///.env.example):

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_ALGORITHM` | `fixed` | Limiter algorithm: `fixed`, `sliding`, or `bucket` |
| `RATE_LIMIT` | `100` | Maximum requests allowed per window (or bucket capacity) |
| `RATE_WINDOW` | `10` | Time window duration in seconds |
| `REFILL_RATE` | `10` | Tokens added per second (Token Bucket only) |
| `REDIS_HOST` | `127.0.0.1` | Redis host address (`redis` inside Docker network) |
| `REDIS_PORT` | `6379` | Redis port |
| `PORT` | `3000` | Port for the Express gateway |
| `INSTANCE_ID` | `default` | Identifier for the running gateway instance |

---

## Project Structure

```
Distributed-rate-limiter/
├── .env.example                     # Sample environment configuration
├── .gitignore                       # Production git ignore definitions
├── .dockerignore                     # Docker build exclusion rules
├── Dockerfile                       # Multi-stage container definition
├── docker-compose.yml               # Multi-node gateway + Redis cluster orchestration
├── package.json                     # Project scripts and dependencies
├── README.md                        # Documentation and architecture guide
├── k6/
│   └── burstTest.js                 # k6 load and stress test script
├── tests/
│   ├── sanityTest.js                # Basic limiter behavior test
│   ├── raceConditionTest.js         # Non-atomic race condition demonstration
│   ├── raceConditionTestFixed.js    # Atomic Fixed Window concurrency test
│   ├── raceConditionTestSliding.js  # Atomic Sliding Window concurrency test
│   ├── raceConditionTestBucket.js   # Atomic Token Bucket concurrency test
│   └── distributedTest.js           # Multi-instance cross-gateway test
└── src/
    ├── server.js                    # Express HTTP application
    ├── config.js                    # Dynamic environment configuration
    ├── redisClient.js               # Redis connection & Lua script registry
    ├── middleware/
    │   └── rateLimitMiddleware.js   # Rate limit check & HTTP handling
    ├── algorithms/
    │   ├── naiveLimiter.js          # Non-atomic limiter (educational comparison)
    │   ├── fixedWindowLimiter.js    # Fixed Window implementation
    │   ├── slidingWindowLimiter.js  # Sliding Window implementation
    │   └── tokenBucketLimiter.js    # Token Bucket implementation
    └── lua/
        ├── fixedWindow.lua          # Atomic Fixed Window Lua script
        ├── slidingWindow.lua        # Atomic Sliding Window Lua script
        └── tokenBucket.lua          # Atomic Token Bucket Lua script
```

---

## Author

**Hemanth Gunti**
- GitHub: [@hemanth210205](https://github.com/hemanth210205)

---

## License

This project is licensed under the [ISC License](LICENSE).
