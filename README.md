# API Sentinel

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.x-cyan.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7%2B-red.svg)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.x-orange.svg)](https://bullmq.io/)
[![Tests](https://img.shields.io/badge/Tests-77%20passing-brightgreen.svg)](https://vitest.dev/)

API Sentinel is a full-stack API monitoring and observability platform designed for mission-critical endpoint health probing, high-precision latency percentiles, automated incident lifecycle transitions, and real-time dashboard telemetry.

---

## Architecture Overview

```mermaid
graph TD
    Client[React 19 Vite Dashboard] -->|HTTP REST API| Express[Express API Gateway]
    Client <-->|WebSockets (user:id room)| SocketIO[Socket.IO Real-Time Gateway]

    Express -->|Auth & Tenant Isolation| Postgres[(PostgreSQL 16+)]
    Express -->|Sliding Window Rate Limit| Redis[(Redis 7+)]

    subgraph Monitoring Engine
        Scheduler[Distributed Scheduler] -->|Every 5s Redis Lock| BullMQ[BullMQ Check Queue]
        BullMQ -->|Concurrency = 5| Worker[Background Check Worker]
        Worker -->|Zero-Trust SSRF Validator| Target[Monitored HTTP Endpoint]
        Worker -->|Persist Check Result| Postgres
        Worker -->|Trigger State Machine| Incidents[Incident State Machine]
        Worker -->|Emit Live Events| SocketIO
    end
```

---

## Key Capabilities

1. **Autonomous Scheduled Probing**: Distributed Redis-locked scheduler dynamically evaluates due monitors and dispatches jobs to BullMQ workers without polling overhead or duplicates.
2. **High-Precision Monotonic Timing**: Check execution times are recorded using microsecond monotonic clocks (`process.hrtime.bigint()`).
3. **Ordered-Set Percentiles**: Latency percentiles ($p50$, $p95$, $p99$) are calculated directly in PostgreSQL using `PERCENTILE_CONT(...) WITHIN GROUP (ORDER BY latency_ms)`.
4. **Zero-Trust SSRF Shield**: Pre-flight DNS resolution actively blocks loopbacks (`127.0.0.1`), private RFC1918 subnets, cloud metadata (`169.254.169.254`), and reserved carrier-grade ranges.
5. **Transactional Incident Management**: Automated incident creation on consecutive failures, tracking downtime duration, and self-healing resolution on recovery with database concurrency locks.
6. **Live Telemetry Streams**: Socket.IO authenticated gateway with tenant room isolation (`user:${userId}`) dispatches check completions and outage notifications in real time.
7. **Dark Obsidian Dashboard**: Responsive, vanilla CSS design system featuring Recharts latency area charts, KPI cards, and live check feeds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Recharts, Lucide Icons, Vanilla CSS |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL (`pg` with parameterized SQL & transaction-safe migrations) |
| **Background Processing** | BullMQ & Redis |
| **Real-Time Gateway** | Socket.IO |
| **Validation & Security** | Zod, Custom SSRF DNS resolver, JWT (HMAC-SHA256) |
| **Logging** | Pino structured JSON logging |
| **Testing** | Vitest & Supertest (77 unit & integration tests) |

---

## Implementation Progress

### Phase 1 — Repository & Infrastructure (Completed)
- [x] Monorepo workspace configuration (`@api-sentinel/backend`, `@api-sentinel/frontend`).
- [x] Strict TypeScript configuration and Express server pipeline.
- [x] Docker Compose configuration for PostgreSQL 16, Redis 7, and local mock API.
- [x] Strict environment variable validation using Zod.
- [x] PostgreSQL connection pool management and connection health checks.
- [x] Redis connection management with ping latency probes.
- [x] Request correlation ID middleware (`X-Request-Id`).
- [x] Centralized error handling and route-not-found middleware.
- [x] Health endpoints (`GET /health/live`, `GET /health/ready`).
- [x] Initial database migration (`001_initial_schema.sql`).
- [x] Transaction-safe database migration runner (`npm run migrate`).

### Phase 2 — Monitor CRUD & Authentication (Completed)
- [x] SSRF prevention and target URL security validator (`backend/src/utils/ssrf.ts`).
  - Blocks loopback, link-local, private, cloud metadata (169.254.169.254), and reserved IP ranges.
  - Rejects embedded URL credentials and unsupported protocols.
- [x] Authentication & Identity (`backend/src/modules/auth`).
  - `POST /api/v1/auth/login` — Sign up / log in and issue cryptographically signed JWT tokens.
  - `GET /api/v1/auth/me` — Retrieve verified user identity.
  - Strict tenant isolation: Ownership is derived exclusively from the verified token.
- [x] Rate limiting middleware using Redis sliding counters with in-memory fallback.
- [x] Monitor Management API (`backend/src/modules/monitors`).
  - `POST /api/v1/monitors` — Create monitor with validated bounds and status codes.
  - `GET /api/v1/monitors` — List only the authenticated user's monitors.
  - `GET /api/v1/monitors/:id` — Get monitor details.
  - `PATCH /api/v1/monitors/:id` — Update configuration with validation and SSRF checks.
  - `DELETE /api/v1/monitors/:id` — Delete monitor with ownership check.
  - `POST /api/v1/monitors/:id/pause` — Pause monitor (`isActive = false`).
  - `POST /api/v1/monitors/:id/resume` — Resume monitor (`isActive = true`).

### Phase 3 — Queue and Monitoring Workers (Completed)
- [x] Database migration (`002_add_check_execution_id.sql`) adding `execution_id` unique index for at-least-once delivery deduplication.
- [x] Checks domain module (`backend/src/modules/checks`).
  - [checks.service.ts](backend/src/modules/checks/checks.service.ts): Native HTTP execution engine with monotonic clock measurement (`process.hrtime.bigint()`), strict timeouts, SSRF re-validation, and classification into constrained outcomes (`success`, `http_error`, `timeout`, `network_error`, `invalid_response`).
  - [checks.repository.ts](backend/src/modules/checks/checks.repository.ts): Idempotent persistence on `execution_id`, due monitor querying, and history fetching.
- [x] BullMQ check queue ([check.queue.ts](backend/src/queues/check.queue.ts)) with Redis connection management and job deduplication.
- [x] BullMQ check worker ([check.worker.ts](backend/src/workers/check.worker.ts)) with bounded concurrency (`CHECK_WORKER_CONCURRENCY=5`).
- [x] Distributed monitor scheduler ([monitor.scheduler.ts](backend/src/scheduler/monitor.scheduler.ts)) with Redis distributed locking (`SET NX PX`).

### Phase 4 — Incidents and Real-Time Events (Completed)
- [x] Transactional incident state transitions ([incidents.service.ts](backend/src/modules/incidents/incidents.service.ts)).
  - Automatically opens incidents on monitor failure with `failure_count = 1`.
  - Increments failure counts and tracks `last_failure_at` without duplicate records.
  - Resolves incidents and records `resolved_at` when monitor recovers.
  - Partial unique index `idx_incidents_one_unresolved` guarantees at most one active incident per monitor under concurrency.
- [x] Incident history endpoint (`GET /api/v1/monitors/:id/incidents`) with pagination and ownership verification.
- [x] Authenticated Socket.IO server ([socket.ts](backend/src/lib/socket.ts)).
  - JWT token verification on handshake.
  - Room isolation: Clients join `user:${userId}` rooms; monitoring data is never broadcast globally.
  - Real-time events: `check:completed`, `monitor:status_changed`, `incident:opened`, `incident:updated`, `incident:resolved`.

### Phase 5 — Analytics and Dashboard UI (Completed)
- [x] Analytics & Check History endpoints ([backend/src/modules/analytics](backend/src/modules/analytics)).
  - `GET /api/v1/monitors/:id/analytics?window=1h|24h|7d|30d` — Evaluates total/successful/failed checks, uptime %, error rate, and ordered-set PostgreSQL latency percentiles (`p50`, `p95`, `p99`) via `PERCENTILE_CONT`.
  - `GET /api/v1/monitors/:id/checks` — Paginated check history with outcome filtering.
  - Zero-denominator protection: Returns `null` percentiles and `hasSufficientData: false` when 0 checks exist in the window.
- [x] Modern Dark Obsidian Frontend Dashboard (`frontend/`).
  - **Technology**: React 19 + TypeScript + Vite, using modern Vanilla CSS design system (zero TailwindCSS).
  - **Components**:
    - `Navbar`: Brand badge, live connection status indicator, refresh, quick user auth switch, new monitor CTA.
    - `MetricsOverview`: Real-time Uptime %, Error Rate, p50 median latency, and p95/p99 tail latency cards.
    - `LatencyChart`: Recharts SVG area chart with interactive tooltip and time-window toggle (`1h`, `24h`, `7d`, `30d`).
    - `LiveCheckFeed`: Microsecond execution timestamps, outcome status pills, and execution ID audit.
    - `IncidentTimeline`: Chronological incident lifecycle cards, failure counts, and duration badges.
    - `MonitorCard`: Fleet monitor list with healthy/unhealthy/paused status badges, URL, method, interval, and quick actions.
    - `CreateMonitorModal` & `EditMonitorModal`: Zero-trust input bounds and SSRF protections.
    - `LoginModal`: 1-click Demo Account or custom email JWT authentication.
  - **Real-Time Reactive Updates**: Subscribes to Socket.IO events and updates telemetry without manual page refresh.
- [x] Comprehensive test suite with 77 passing tests across 11 test suites.

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Log in or register with email; returns JWT token |
| `GET` | `/api/v1/auth/me` | Retrieve authenticated user identity |

### Monitors
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/monitors` | Create a new monitor with SSRF target validation |
| `GET` | `/api/v1/monitors` | List authenticated user's monitors (`?isActive=true`) |
| `GET` | `/api/v1/monitors/:id` | Get monitor details |
| `PATCH` | `/api/v1/monitors/:id` | Update monitor configuration |
| `DELETE` | `/api/v1/monitors/:id` | Delete monitor |
| `POST` | `/api/v1/monitors/:id/pause` | Pause scheduled checks |
| `POST` | `/api/v1/monitors/:id/resume` | Resume scheduled checks |

### Analytics & Telemetry
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/monitors/:id/analytics` | Latency percentiles (p50/p95/p99), uptime %, error rate (`?window=1h\|24h\|7d\|30d`) |
| `GET` | `/api/v1/monitors/:id/checks` | Paginated check history (`?limit=25&offset=0&outcome=success`) |
| `GET` | `/api/v1/monitors/:id/incidents` | Incident history and active outage status |

### Health Probes
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health/live` | Process liveness probe |
| `GET` | `/health/ready` | Readiness probe (verifies PostgreSQL and Redis latencies) |

---

## Real-Time WebSocket Events

Socket.IO connections authenticate using the JWT Bearer token:
```ts
const socket = io('http://localhost:4000', {
  auth: { token: `Bearer ${jwtToken}` }
});
```

Clients automatically join their private user room (`user:${userId}`). Broadcasted events:
- `check:completed`: Dispatched when a background worker records an executed check.
- `monitor:status_changed`: Dispatched when monitor transitions between healthy and unhealthy.
- `incident:opened`: Dispatched when consecutive check failures trigger an active incident.
- `incident:updated`: Dispatched on repeated failures during an ongoing outage.
- `incident:resolved`: Dispatched when health check succeeds and resolves the incident.

---

## Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22)
- **npm**: v9+
- **PostgreSQL**: Local or cloud (e.g. Neon/Supabase)
- **Redis**: Local or cloud (e.g. Upstash)

### 2. Clone & Install
```bash
git clone https://github.com/AnshGour16/api-sentinel.git
cd api-sentinel
npm install
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` and `REDIS_URL` point to your instances.

### 4. Run Database Migrations
```bash
npm run migrate:backend
```

### 5. Start Development Servers

In terminal 1 (Backend API & Workers):
```bash
npm run dev:backend
```

In terminal 2 (Frontend Dashboard):
```bash
npm run dev:frontend
```

- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **Readiness Probe**: [http://localhost:4000/health/ready](http://localhost:4000/health/ready)

---

## Running Tests

Execute the backend Vitest test suite:
```bash
npm test
```

Build production bundles across both workspaces:
```bash
npm run build
```

---

## License
MIT License.