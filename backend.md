# API Sentinel — Backend Architecture & Implementation Specification (`backend.md`)

You are a senior backend engineer building **API Sentinel**, a full-stack API monitoring and observability platform. The purpose of this project is to demonstrate real backend engineering, asynchronous processing, reliability, security, and system design.

Build production-minded, testable software. Do not create a superficial CRUD application or an AI wrapper.

Follow every requirement in this specification. If a requirement conflicts with an existing implementation, inspect the codebase first, explain the conflict, and preserve working functionality wherever possible.

---

## 1. Project Objectives

API Sentinel allows developers to register HTTP endpoints, monitor their availability, track latency, investigate incidents, and safely replay captured requests in controlled environments.

### Core capabilities

1. Register, update, pause, resume, and delete API monitors.
2. Execute scheduled HTTP health checks through asynchronous background workers.
3. Store check history and calculate uptime, error rate, and latency percentiles.
4. Detect failures and create incident records.
5. Notify the frontend of new checks and incident transitions in real time.
6. Retry eligible transient failures using bounded backoff.
7. Redact sensitive information before storing request or response metadata.
8. Support controlled request replay against explicitly authorized targets.
9. Provide a dashboard for monitor status, historical performance, and incidents.
10. Run the complete development environment locally using Docker Compose.

### Non-goals for the initial version

- Do not build a general-purpose API testing client.
- Do not execute arbitrary user-supplied code.
- Do not require an LLM for monitoring or incident detection.
- Do not claim distributed monitoring from multiple geographic regions.
- Do not build a microservices architecture without a demonstrated need.

---

## 2. Technology Stack

Use the following stack unless a technical limitation requires an explicitly documented change.

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| Database access | `pg` with parameterized SQL and migrations |
| Background jobs | BullMQ |
| Queue and cache | Redis |
| Real-time events | Socket.IO |
| Validation | Zod |
| Logging | Pino |
| Testing | Vitest + Supertest |
| Frontend testing | Vitest + React Testing Library |
| HTTP client | Node.js native `fetch` with strict timeouts |
| Charts | Recharts |
| Containerization | Docker + Docker Compose |
| API documentation | OpenAPI |

Use compatible, stable package versions and commit the lockfile.

Keep the frontend and backend in a single repository (monorepo).

---

## 3. Repository Structure

Use the following structure. Keep route registration, request handling, business logic, database access, and background processing separate.

```text
api-sentinel/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── monitors/
│   │   │   ├── incidents/
│   │   │   └── analytics/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   ├── lib/
│   │   │   ├── db.ts
│   │   │   ├── redis.ts
│   │   │   ├── logger.ts
│   │   │   └── errors.ts
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── monitors/
│   │   │   ├── checks/
│   │   │   ├── incidents/
│   │   │   ├── analytics/
│   │   │   └── replay/
│   │   ├── queues/
│   │   │   ├── check.queue.ts
│   │   │   └── replay.queue.ts
│   │   ├── workers/
│   │   │   ├── check.worker.ts
│   │   │   └── replay.worker.ts
│   │   ├── scheduler/
│   │   ├── services/
│   │   └── utils/
│   ├── migrations/
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   └── generate-traffic.ts
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

### Module structure rule

Every feature module must separate HTTP routing, controller logic, and service logic.

Example:

```text
modules/monitors/
├── monitors.routes.ts
├── monitors.controller.ts
├── monitors.service.ts
├── monitors.repository.ts
├── monitors.schemas.ts
└── monitors.types.ts
```

Repositories handle database queries. Services implement business rules. Controllers validate requests and translate service results into HTTP responses.

Workers must call services or dedicated execution functions rather than duplicating business logic.

---

## 4. Database Schema

Use PostgreSQL migrations. Do not rely on manually creating tables or automatically synchronizing production schemas.

All tables must have appropriate primary keys, foreign keys, constraints, indexes, and timestamps.

Use UUID identifiers and UTC timestamps (`TIMESTAMPTZ`).

### A. Users

Store user identity and authentication-related metadata.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

For the initial implementation, use a documented authentication strategy. Never trust a user ID supplied by the frontend as proof of identity.

### B. Monitors

Stores monitored endpoints and their configuration.

```sql
CREATE TABLE monitors (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_ms INTEGER NOT NULL DEFAULT 5000,
    expected_status_min INTEGER NOT NULL DEFAULT 200,
    expected_status_max INTEGER NOT NULL DEFAULT 299,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monitors_user
    ON monitors(user_id);

CREATE INDEX idx_monitors_active
    ON monitors(is_active);
```

Requirements:

- Validate the URL and configuration at runtime.
- Enforce reasonable minimum and maximum intervals and timeouts.
- Prevent one user from accessing another user's monitors.
- Do not persist raw authentication credentials.
- Add additional fields through explicit migrations when needed.

### C. Monitor checks

Stores the result of each scheduled health check.

```sql
CREATE TABLE monitor_checks (
    id UUID PRIMARY KEY,
    monitor_id UUID NOT NULL REFERENCES monitors(id),
    status_code INTEGER,
    latency_ms INTEGER,
    outcome TEXT NOT NULL,
    error_code TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checks_monitor_time
    ON monitor_checks(monitor_id, checked_at DESC);

CREATE INDEX idx_checks_outcome_time
    ON monitor_checks(outcome, checked_at DESC);
```

Use a constrained set of outcomes, such as:

- `success`
- `http_error`
- `timeout`
- `network_error`
- `invalid_response`

Do not use unbounded exception messages as outcome values.

### D. Incidents

```sql
CREATE TABLE incidents (
    id UUID PRIMARY KEY,
    monitor_id UUID NOT NULL REFERENCES monitors(id),
    status TEXT NOT NULL DEFAULT 'open',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    failure_count INTEGER NOT NULL DEFAULT 1,
    last_failure_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_monitor_status
    ON incidents(monitor_id, status);

CREATE INDEX idx_incidents_started
    ON incidents(started_at DESC);
```

Only one unresolved incident per monitor should exist at a time. Enforce this with a partial unique index and transactional incident updates.

### E. Replay jobs

Store replay metadata and execution results separately from monitor checks.

```sql
CREATE TABLE replay_jobs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    monitor_id UUID REFERENCES monitors(id),
    target_environment TEXT NOT NULL,
    http_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    status_code INTEGER,
    latency_ms INTEGER,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_replays_user_time
    ON replay_jobs(user_id, created_at DESC);
```

Never store secrets, raw authorization headers, or unrestricted request bodies in replay records.

### Database rules

- Use parameterized queries exclusively.
- Add migrations for schema changes.
- Use transactions for related writes.
- Add retention and cleanup policies for high-volume check history.
- Do not delete records belonging to other users.
- Do not cascade-delete historical data unless the deletion policy explicitly requires it.
- Use pagination for all potentially large result sets.

---

## 5. Authentication and Authorization

Implement authentication before exposing monitor management endpoints.

For the initial version, choose one documented approach:

- A secure session-based authentication mechanism, or
- A verified OAuth/OIDC identity integration.

Do not build custom password cryptography.

Requirements:

1. Identify the user from a verified server-side session or validated token.
2. Never accept `userId` from the request body as the authenticated identity.
3. Derive resource ownership from the authenticated user.
4. Apply authentication middleware to all private endpoints.
5. Return `401 Unauthorized` for missing or invalid authentication.
6. Return `403 Forbidden`, or a consistent `404` where appropriate, for unauthorized resource access.
7. Configure CORS using an explicit origin allowlist.
8. Apply rate limits to authentication and sensitive operations.
9. Protect cookie-based state-changing requests against CSRF.
10. Store secrets in environment variables and never commit them.

Admin functionality is optional for the first version. Do not introduce an admin role until a concrete requirement exists.

---

## 6. Monitor Management API

Base path: `/api/v1/monitors`

### Required endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/api/v1/monitors` | Create a monitor |
| GET | `/api/v1/monitors` | List the authenticated user's monitors |
| GET | `/api/v1/monitors/:id` | Get monitor details |
| PATCH | `/api/v1/monitors/:id` | Update monitor configuration |
| DELETE | `/api/v1/monitors/:id` | Deactivate or delete according to retention policy |
| POST | `/api/v1/monitors/:id/pause` | Pause scheduled checks |
| POST | `/api/v1/monitors/:id/resume` | Resume scheduled checks |

### Validation rules

- `name`: non-empty trimmed string with a maximum length.
- `targetUrl`: valid HTTP or HTTPS URL.
- `method`: restrict the initial monitor implementation to `GET` and `HEAD`.
- `intervalSeconds`: integer within a configured safe range.
- `timeoutMs`: positive bounded integer.
- Expected status range: valid HTTP status codes with minimum not greater than maximum.

Use Zod schemas to validate every request body, path parameter, and query parameter.

Return consistent error objects:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The monitor configuration is invalid"
  }
}
```

Never return stack traces, SQL errors, credentials, or internal environment variables to clients.

---

## 7. Scheduled Monitoring Engine

This is the core of API Sentinel.

### Architecture

```text
Monitor configuration
        |
        v
Scheduler
        |
        v
Redis + BullMQ
        |
        v
Check worker
        |
        v
Validated HTTP request
        |
        v
PostgreSQL check history
        |
        v
Incident detection
        |
        v
Socket.IO dashboard event
```

### Requirements

1. A scheduler identifies active monitors that are due for execution.
2. Monitoring jobs are placed on a BullMQ queue.
3. Dedicated workers execute HTTP requests.
4. Every request has a strict connection and total execution timeout.
5. Workers record status, latency, outcome, and timestamps.
6. Workers update incident state transactionally.
7. Workers emit events after the database transaction succeeds.
8. A failed worker must not silently lose monitoring history.
9. The scheduler must not create unlimited duplicate jobs.
10. Multiple scheduler instances must not execute every monitor independently without coordination.

### Job payload

Pass only the minimum information required to execute a job.

```ts
type MonitorCheckJob = {
  monitorId: string;
  scheduledAt: string;
  executionId: string;
};
```

Fetch the latest monitor configuration from PostgreSQL before execution. Do not blindly trust stale target URLs stored in old queued jobs.

### Idempotency

BullMQ job IDs alone are not sufficient to guarantee exactly-once execution.

Design for at-least-once job delivery:

- Use a stable execution identity for each scheduled check.
- Add a uniqueness constraint or equivalent deduplication mechanism for that execution identity.
- Make database writes safe to repeat.
- Prevent duplicate incident creation through transactional constraints.
- Document how jobs are recovered after worker crashes.

Do not claim exactly-once processing.

### Retry policy

- Retry only eligible transient failures.
- Use bounded exponential backoff with jitter.
- Configure a maximum attempt count.
- Do not treat ordinary HTTP 4xx responses as automatically retryable.
- Do not retry indefinitely.
- Distinguish the final check result from intermediate queue execution failures.
- Ensure retry behavior does not inflate uptime or create duplicate check records.

### Concurrency

- Configure a bounded worker concurrency.
- Limit request duration and response size.
- Apply per-user and global execution quotas.
- Avoid launching an unbounded number of HTTP requests.
- Handle Redis disconnections and worker shutdown gracefully.

---

## 8. HTTP Target Security and SSRF Prevention

Monitoring user-supplied URLs creates a server-side request forgery (SSRF) risk. Security validation is mandatory.

Before every outbound request:

1. Parse and normalize the URL.
2. Allow only explicitly supported schemes: HTTP and HTTPS.
3. Reject embedded credentials in URLs.
4. Reject loopback, private, link-local, multicast, and reserved IP destinations.
5. Resolve DNS and validate all resolved IPv4 and IPv6 addresses.
6. Prevent DNS rebinding and time-of-check/time-of-use bypasses by ensuring the actual connection uses a validated destination.
7. Revalidate every redirect target, or disable redirects by default.
8. Reject cloud metadata endpoints and other prohibited destinations.
9. Apply connection, response-time, and response-size limits.
10. Do not forward internal service credentials to monitored endpoints.

For the local development environment, explicitly support a safe mock target service through a controlled allowlist or a dedicated internal monitoring adapter. Do not weaken public URL protections globally just to make local demos convenient.

Do not expose unrestricted arbitrary URL fetching as a general proxy endpoint.

---

## 9. Check History and Analytics

Base path: `/api/v1/monitors/:id/checks`

Support:

- Paginated check history.
- Filtering by outcome and time range.
- Latency history for charts.
- Latest known check status.
- Successful check count and failed check count.
- Uptime percentage over a selected time window.
- Error rate over a selected time window.
- p50, p95, and p99 latency.

### Metric definitions

Document every metric precisely.

- **Latency:** elapsed time measured with a monotonic clock around the HTTP operation.
- **Success:** the response satisfies the monitor's configured expected status range.
- **Error rate:** failed eligible checks divided by all completed eligible checks in the window.
- **Uptime:** successful eligible checks divided by all completed eligible checks in the window.

Return a null or explicit insufficient-data result when the denominator is zero.

Do not silently count missing scheduled checks as successful.

### Percentile requirements

For small bounded windows, PostgreSQL ordered-set aggregates such as `percentile_cont` are acceptable.

For larger datasets:

- Use time-bucketed aggregates or precomputed summaries.
- Consider an appropriate streaming percentile algorithm such as t-digest when justified.
- Document the approximation error and memory trade-offs.
- Avoid loading millions of raw check records into application memory.
- Apply time-range limits and database query timeouts.

Do not calculate p95 by averaging averages.

---

## 10. Incident Lifecycle

Create an incident when a monitor transitions from healthy to unhealthy according to a documented failure policy.

Support:

- Incident creation.
- Repeated failure counting.
- Last failure timestamp.
- Incident resolution after recovery.
- Incident history.
- Acknowledgement as a future optional feature.

### State transitions

```text
HEALTHY
   |
   | Failure policy satisfied
   v
OPEN INCIDENT
   |
   | Subsequent failures
   v
INCIDENT UPDATED
   |
   | Recovery policy satisfied
   v
RESOLVED INCIDENT
```

Requirements:

- Avoid creating a new incident for every failed check.
- Make state transitions transactional and safe under concurrent workers.
- Use a configurable threshold for opening incidents.
- Consider a recovery threshold to avoid rapid state flapping.
- Record incident start and resolution timestamps.
- Do not emit a resolution event before the database transaction commits.

---

## 11. Real-Time Events

Use Socket.IO for live dashboard updates.

Recommended event names:

- `check:completed`
- `monitor:status_changed`
- `incident:opened`
- `incident:updated`
- `incident:resolved`

Every event must contain a validated, minimal payload.

Requirements:

1. Authenticate Socket.IO connections.
2. Associate each connection with its authenticated user.
3. Send events only to authorized user rooms.
4. Never broadcast private monitoring data globally.
5. Do not expose raw headers, tokens, request bodies, or stack traces.
6. Handle reconnections gracefully.
7. Treat WebSocket delivery as best-effort; clients must be able to recover by fetching persisted state from the API.

The database is the source of truth, not the WebSocket event stream.

---

## 12. Request and Response Redaction

Never persist unrestricted request headers or response bodies.

Implement a centralized redaction utility that removes or masks:

- `Authorization`
- `Cookie` and `Set-Cookie`
- API keys
- Common token headers
- Configured secret values
- Sensitive query parameters
- Other explicitly configured sensitive fields

Requirements:

- Apply redaction before persistence and logging.
- Prefer allowlisted metadata over capturing arbitrary data.
- Do not log credentials in validation errors.
- Limit captured diagnostic text.
- Do not store full response bodies by default.
- Add tests proving that secrets never appear in stored logs or emitted events.

Redaction must be applied consistently across normal monitoring, incidents, and replay operations.

---

## 13. Safe Request Replay

Replay is an optional advanced feature. Implement it only after monitoring and incident management work correctly.

Base path: `/api/v1/replays`

Possible endpoints:

- `POST /api/v1/replays` — enqueue an authorized replay.
- `GET /api/v1/replays/:id` — retrieve replay status and result.
- `GET /api/v1/replays` — list the authenticated user's replay jobs.

### Safety requirements

1. Require explicit confirmation of the target environment.
2. Restrict targets to configured, verified destinations.
3. Never permit arbitrary access to internal or private network destinations.
4. Redact credentials before persisting replay metadata.
5. Never automatically replay a failed production request.
6. Restrict the initial implementation to safe methods such as GET and HEAD.
7. Require a separate explicit opt-in and safety policy before allowing state-changing methods.
8. Use idempotency keys where the target application supports them.
9. Never assume POST or PUT requests are safe to repeat.
10. Apply strict execution limits and audit replay attempts.

A replay job must have its own lifecycle and records. It must not overwrite the original monitoring result.

If a request contains secrets or a non-repeatable body that cannot be reconstructed safely, refuse the replay rather than silently changing its meaning.

---

## 14. API Authentication and Security Middleware

Implement reusable middleware for:

- Authentication.
- Resource ownership.
- Request validation.
- Rate limiting.
- Security headers.
- Centralized error handling.
- Request correlation IDs.
- Structured logging.

Requirements:

- Use parameterized SQL exclusively.
- Validate and normalize input at the boundary.
- Avoid leaking internal errors.
- Use explicit CORS configuration.
- Apply body-size limits.
- Apply appropriate timeouts.
- Restrict allowed HTTP methods.
- Avoid permissive wildcard origins for credentialed requests.
- Add request-level audit events for sensitive operations.

Use a consistent error mapping strategy. Controllers should not contain repeated, ad hoc error-handling code.

---

## 15. Configuration and Environment Variables

Create `.env.example` containing placeholder values only.

Expected configuration includes:

```dotenv
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/api_sentinel
REDIS_URL=redis://localhost:6379

FRONTEND_ORIGIN=http://localhost:5173

SESSION_SECRET=replace_with_a_secure_random_secret

MONITOR_DEFAULT_INTERVAL_SECONDS=60
MONITOR_DEFAULT_TIMEOUT_MS=5000

CHECK_WORKER_CONCURRENCY=5
CHECK_MAX_RETRIES=2

LOG_LEVEL=info
```

Adapt these values to the selected authentication implementation.

Requirements:

- Validate required environment variables at startup.
- Never commit a real `.env` file.
- Never print secrets in logs.
- Fail clearly if required configuration is missing.
- Use separate development and production configurations.
- Use a secure secret generator for real session secrets.
- Document which environment variables are required and optional.

---

## 16. Docker Compose

Provide a development `docker-compose.yml` containing:

- PostgreSQL.
- Redis.
- A controlled mock API service for deterministic success, error, and timeout scenarios.

Requirements:

- Add health checks to infrastructure services.
- Use persistent volumes for development data.
- Do not expose database or Redis ports publicly in production.
- Ensure services can restart safely.
- Document how to run database migrations.
- Provide a predictable local setup with minimal manual configuration.

The application may initially run on the host machine while PostgreSQL, Redis, and the mock service run in Docker.

Do not require external third-party APIs for the primary demonstration.

---

## 17. Testing Requirements

Use Vitest and Supertest for backend testing.

### Unit tests

Test:

- Request validation.
- URL normalization and security checks.
- Redaction behavior.
- Latency metric calculations.
- Incident transition logic.
- Retry eligibility.
- Ownership and authorization rules.

### Integration tests

Test:

- Monitor creation and listing.
- User ownership isolation.
- Job enqueueing.
- Worker execution against the mock API.
- Persistence of check history.
- Duplicate execution handling.
- Incident creation and recovery.
- WebSocket authorization.
- Replay safety restrictions.

### Failure scenarios

Test at least:

- HTTP 200.
- HTTP 404.
- HTTP 500.
- Connection refused.
- Request timeout.
- Redis temporarily unavailable.
- PostgreSQL unavailable during persistence.
- Worker termination during a job.
- Duplicate job delivery.
- Invalid and malicious target URLs.
- Unauthorized resource access.

Tests must be deterministic wherever possible. Do not rely on live external APIs in the core test suite.

---

## 18. Observability of API Sentinel Itself

The monitoring platform must also expose its own health.

Implement:

- `GET /health/live` — process liveness.
- `GET /health/ready` — readiness based on required dependencies.
- Structured JSON logs.
- Request correlation IDs.
- Worker failure logs.
- Queue waiting and failed-job metrics.
- Database connection health.
- Graceful shutdown of HTTP servers, workers, Redis clients, and PostgreSQL pools.

Do not report readiness as successful when a required dependency is unavailable.

Avoid logging the full contents of user-supplied requests.

---

## 19. AI Agent Implementation Rules

Before changing code:

1. Inspect the repository and read the existing README and configuration.
2. Identify the current Git branch and existing files.
3. Determine what is implemented and what is missing.
4. Present a short implementation plan for the current phase.
5. Do not overwrite working files without inspecting them.
6. Do not generate the entire project in one unreviewed batch.
7. Do not introduce dependencies without explaining their purpose.
8. Keep TypeScript strict and avoid `any` unless explicitly justified.
9. Never hardcode credentials or production configuration.
10. Never disable security checks merely to make a demo work.
11. Run the relevant tests and type checks after each implementation phase.
12. Fix errors introduced by the implementation before moving on.
13. Update documentation when endpoints, schemas, or configuration change.
14. Report completed work, files changed, tests executed, and remaining limitations.
15. Never claim a test passed unless it was actually executed and passed.

### Required code quality

- Small, focused functions.
- Explicit types and return values.
- Centralized validation and error handling.
- Parameterized database access.
- Clear separation between controllers, services, repositories, schedulers, and workers.
- No duplicated business rules across API handlers and workers.
- No placeholder implementations presented as finished features.

---

## 20. Implementation Roadmap

Build the project in the following order. Do not skip ahead.

### Phase 1 — Repository and infrastructure

- Inspect existing files.
- Configure the root workspace.
- Set up backend TypeScript and Express.
- Set up PostgreSQL and Redis using Docker Compose.
- Configure environment validation.
- Add health and readiness endpoints.
- Add the initial database migration.
- Verify the application starts locally.

**Acceptance criteria:** The backend starts successfully, PostgreSQL and Redis are healthy, and the health endpoints return the expected results.

### Phase 2 — Monitor CRUD

- Implement monitor schemas, repositories, services, controllers, and routes.
- Add authentication and ownership checks.
- Implement monitor creation, listing, update, pause, resume, and deletion.
- Add validation and integration tests.

**Acceptance criteria:** Authenticated users can manage only their own monitors, and invalid requests return consistent errors.

### Phase 3 — Queue and monitoring workers

- Implement the BullMQ queue.
- Implement scheduler coordination and duplicate prevention.
- Implement the HTTP execution worker.
- Persist check outcomes and latency.
- Implement bounded retries and timeout handling.
- Test against the controlled mock API.

**Acceptance criteria:** A registered monitor produces persisted check history without relying on a manual API request for every check.

### Phase 4 — Incidents and real-time events

- Implement transactional incident transitions.
- Add Socket.IO authentication and user-specific rooms.
- Emit check and incident events after successful persistence.
- Test recovery, duplicate jobs, and reconnection behavior.

**Acceptance criteria:** Failures create incidents according to the configured policy, recovery resolves them, and authorized dashboards receive live updates.

### Phase 5 — Analytics and dashboard

- Implement paginated check history.
- Implement uptime and error-rate calculations.
- Implement p50, p95, and p99 latency.
- Build the React dashboard and monitoring detail pages.
- Display loading, empty, error, and disconnected states.

**Acceptance criteria:** Dashboard metrics match independently verified calculations against known test data.

### Phase 6 — Security and request replay

- Complete SSRF protections.
- Add redaction tests.
- Implement authorized replay jobs for safe methods.
- Add replay quotas, audit history, and failure handling.
- Verify that replay cannot access prohibited destinations.

**Acceptance criteria:** The replay workflow refuses unsafe requests and never automatically repeats arbitrary state-changing production requests.

### Phase 7 — Hardening and documentation

- Complete the failure-scenario test suite.
- Verify graceful shutdown and recovery.
- Add a deterministic traffic generator.
- Document architecture, API endpoints, database design, and failure-handling choices.
- Add setup instructions and a live demonstration script.

**Acceptance criteria:** Another developer can clone the repository, configure the environment, start the services, run the tests, and reproduce the main monitoring scenarios using the documentation.

---

## 21. Final Delivery Requirements

Before declaring the initial release complete, verify:

- [ ] The repository runs locally from documented instructions.
- [ ] PostgreSQL migrations execute successfully.
- [ ] Redis and BullMQ jobs work correctly.
- [ ] Scheduled health checks execute automatically.
- [ ] HTTP failures and timeouts are recorded.
- [ ] Duplicate jobs do not create duplicate logical check records.
- [ ] Incident transitions are consistent under concurrency.
- [ ] Latency and uptime metrics have documented definitions.
- [ ] Authentication and resource ownership are enforced.
- [ ] SSRF defenses prevent access to prohibited destinations.
- [ ] Sensitive data is redacted before logging and persistence.
- [ ] WebSocket events respect user authorization.
- [ ] Tests cover core success and failure paths.
- [ ] Docker Compose supports a deterministic local demonstration.
- [ ] README documentation reflects the implemented behavior.

Do not claim production readiness solely because the application runs locally. Clearly distinguish implemented, tested, and future capabilities.

---

## 22. First Task to Execute

**Do not implement all phases immediately.**

Start by inspecting the existing repository and Git state.

Then:

1. Report the existing files and project status.
2. Identify missing infrastructure and configuration.
3. Propose the smallest set of files required for Phase 1.
4. Implement Phase 1 only.
5. Run the available type checks, tests, and health checks.
6. Report the exact commands executed and their results.
7. Stop and wait for approval before starting Phase 2.

The goal is to build a technically defensible backend that demonstrates real engineering decisions, reliable background processing, security, and measurable system behavior—not merely a dashboard that looks impressive.
