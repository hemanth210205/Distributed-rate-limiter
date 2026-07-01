# Distributed Rate Limiter as a Service

A high-throughput, distributed rate limiting service built with **Node.js**, **Redis**, and **Docker**. Supports three industry-standard algorithms with atomic Lua scripts ensuring cross-node consistency — no race conditions, no dropped counts.

---

## Why This Exists

Every major API (Stripe, GitHub, Twitter) uses rate limiting to protect infrastructure from abuse and overload. This project replicates that core infrastructure primitive — built from scratch, deployable with a single command, and designed to scale horizontally.

---

## Algorithms Supported

| Algorithm | How it works | Best for |
|---|---|---|
| **Fixed Window** | Counts requests in a fixed time bucket (e.g. 100 req / 10s). Resets at window boundary. | Simple quota enforcement |
| **Sliding Window** | Tracks exact request timestamps in a rolling window. No boundary burst problem. | Precise per-user limits |
| **Token Bucket** | Bucket fills at a fixed refill rate. Requests consume tokens. Allows controlled bursting. | API throttling with burst allowance |

Each algorithm is implemented as an **atomic Redis Lua script** — the increment, check, and respond cycle happens in a single Redis operation, making it safe across multiple Node instances sharing the same Redis.

---

## Architecture

```
Clients
   │
   ▼
┌─────────────────────────────────────────┐
│              Docker Network             │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │  node1   │  │  node2   │  │ node3 │ │
│  │  :3001   │  │  :3002   │  │ :3003 │ │
│  │  fixed   │  │ sliding  │  │bucket │ │
│  └────┬─────┘  └────┬─────┘  └───┬───┘ │
│       │              │             │     │
│       └──────────────┴─────────────┘    │
│                      │                  │
│               ┌──────▼──────┐           │
│               │    Redis    │           │
│               │    :6379    │           │
│               │ shared state│           │
│               └─────────────┘           │
└─────────────────────────────────────────┘
```

All three Node instances share a single Redis. When node1 increments a counter for `user123`, node2 and node3 immediately see that updated count — this is what makes it truly distributed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Cache / State | Redis 7 |
| Atomic Scripts | Lua (via ioredis `defineCommand`) |
| Containerization | Docker + Docker Compose |
| Load Testing | k6 |

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [k6](https://k6.io/docs/get-started/installation/) (optional, for load testing)

### Run with Docker

```bash
# Clone the repo
git clone https://github.com/hemanth-gunti/Distributed-rate-limiter.git
cd Distributed-rate-limiter

# Build and start all containers (Redis + 3 Node instances)
docker compose build
docker compose up
```

You should see:

```
redis                | Ready to accept connections tcp
rate-limiter-node1   | Gateway [node1] running on port 3000 | Algorithm: fixed
rate-limiter-node2   | Gateway [node2] running on port 3000 | Algorithm: sliding
rate-limiter-node3   | Gateway [node3] running on port 3000 | Algorithm: bucket
```

---

## API Usage

All endpoints require the `x-user-id` header to identify the caller.

### Check endpoint

```
GET /api/data
Headers: x-user-id: <user-id>
```

**Success (200):**
```json
{
  "message": "Success",
  "algorithm": "fixed",
  "instance": "node1",
  "timestamp": 1782936472879
}
```

**Rate limited (429):**
```json
{
  "error": "Too Many Requests"
}
```

**Missing header (400):**
```json
{
  "error": "Missing x-user-id header"
}
```

### Test each node

```bash
# Fixed window (node1)
curl -H "x-user-id: user123" http://localhost:3001/api/data

# Sliding window (node2)
curl -H "x-user-id: user123" http://localhost:3002/api/data

# Token bucket (node3)
curl -H "x-user-id: user123" http://localhost:3003/api/data
```

### Trigger the rate limiter

```bash
# Spam 50 requests to node1 — you'll see 429s after the limit is hit
for i in {1..50}; do curl -s -H "x-user-id: user123" http://localhost:3001/api/data; echo; done
```

---

## Configuration

All limits are configurable via environment variables in `docker-compose.yml`:

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_ALGORITHM` | `fixed` | Algorithm: `fixed`, `sliding`, or `bucket` |
| `RATE_LIMIT` | `100` | Max requests allowed per window |
| `RATE_WINDOW` | `10` | Window size in seconds |
| `REFILL_RATE` | `10` | Tokens added per second (bucket only) |
| `REDIS_HOST` | `127.0.0.1` | Redis hostname (`redis` inside Docker) |
| `REDIS_PORT` | `6379` | Redis port |

---

## Load Testing with k6

```bash
# Install k6 first: https://k6.io/docs/get-started/installation/

# Run burst test against node1
GATEWAY_URL=http://localhost:3001/api/data k6 run k6/burstTest.js
```

The burst test ramps up to **500 virtual users** across 20 simulated user IDs, then ramps back down. It tracks:

- `requests_allowed` — requests that passed the limiter
- `requests_rejected` — requests that got 429'd
- `requests_errored` — unexpected errors
- p50, p90, p95, p99 latency

---

## Key Design Decisions

**Atomic Lua scripts over GET + SET**
A naive implementation reads the counter then increments it — two operations with a race condition window in between. Every algorithm here uses a single Lua script executed atomically by Redis, making it safe across any number of nodes.

**Fail-closed on Redis outage**
If Redis is unavailable, the middleware returns `503 Service Unavailable` rather than allowing all traffic through. This is a deliberate tradeoff — availability vs security. In a production system this would be a configurable policy.

**Per-user keying via `x-user-id`**
In a real system this would be derived from an auth token or API key. The header approach keeps the demo clean and lets you test multiple users easily.

---

## Project Structure

```
├── src/
│   ├── algorithms/
│   │   ├── fixedWindowLimiter.js
│   │   ├── slidingWindowLimiter.js
│   │   └── tokenBucketLimiter.js
│   ├── lua/
│   │   ├── fixedWindow.lua
│   │   ├── slidingWindow.lua
│   │   └── tokenBucket.lua
│   ├── middleware/
│   │   └── rateLimitMiddleware.js
│   ├── config.js
│   ├── redisClient.js
│   └── server.js
├── k6/
│   └── burstTest.js
├── tests/
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Author

**Hemanth Gunti**
- GitHub: [@hemanth-gunti](https://github.com/hemanth-gunti)


