# API Sentinel

API Sentinel is a full-stack API monitoring and observability platform designed for high-reliability health checking, latency percentiles, incident detection, and controlled request replay.

---

## Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL (`pg` with parameterized SQL & migrations) |
| **Queue / Cache** | Redis & BullMQ |
| **Logging** | Pino (structured JSON logs) |
| **Validation** | Zod |
| **Testing** | Vitest & Supertest |
| **Infrastructure** | Docker & Docker Compose |

---

## Phase 1 Implementation Status

- [x] Monorepo workspace configuration (`backend`, `frontend`)
- [x] Strict TypeScript configuration and Express server setup
- [x] Docker Compose configuration for PostgreSQL, Redis, and mock API
- [x] Strict environment variable validation using Zod
- [x] PostgreSQL connection pool management and connection health checks
- [x] Redis connection management and ping health checks
- [x] Request correlation ID middleware (`X-Request-Id`)
- [x] Centralized error handling and route-not-found middleware
- [x] Health endpoints:
  - `GET /health/live` — Process liveness probe
  - `GET /health/ready` — Dependency readiness probe (PostgreSQL & Redis checks, returns 503 if unhealthy)
- [x] Initial database migration (`001_initial_schema.sql`) covering users, monitors, checks, incidents, and replay jobs
- [x] Transaction-safe database migration runner (`npm run migrate`)
- [x] Vitest test suite covering environment validation, health endpoints, and database migration logic

---

## Getting Started

### Prerequisites

- **Node.js**: v18+ (tested on Node v22)
- **npm**: v9+
- **Docker & Docker Compose** (for running PostgreSQL, Redis, and the mock API in containers)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/AnshGour16/api-sentinel.git
cd api-sentinel
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Adjust `.env` if using custom database credentials or external instances.

### 3. Start Infrastructure (Docker Compose)

Start PostgreSQL, Redis, and the mock HTTP service:

```bash
docker compose up -d
```

Verify services are running:

```bash
docker compose ps
```

### 4. Run Database Migrations

Apply the initial schema to PostgreSQL:

```bash
npm run migrate:backend
```

### 5. Start the Backend Development Server

```bash
npm run dev:backend
```

The server will be available at `http://localhost:4000`.

### 6. Verify Health Endpoints

- **Liveness probe:**
  ```bash
  curl http://localhost:4000/health/live
  ```
  Expected output:
  ```json
  {"status":"ok","uptime":1.5,"timestamp":"..."}
  ```

- **Readiness probe:**
  ```bash
  curl http://localhost:4000/health/ready
  ```
  Expected output:
  ```json
  {
    "status": "ok",
    "checks": {
      "database": { "status": "healthy", "latencyMs": 2 },
      "redis": { "status": "healthy", "latencyMs": 1 }
    },
    "timestamp": "..."
  }
  ```

---

## Running Tests & Checks

Execute the Vitest test suite:

```bash
npm test
```

Build TypeScript:

```bash
npm run build
```