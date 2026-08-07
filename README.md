# ClassPulse — University Attendance Management System

A full-stack attendance system where **students check in with a session PIN + GPS geofencing**, lecturers run live sessions with rolling PINs, and admins manage the institution hierarchy (university → school → department → courses → classes) with reporting and bulk import.

## Features

- **Student check-in** — PIN + geofence validation against the lecture hall (haversine distance), GPS accuracy gating, and device-fingerprint anti-abuse (one device per student per session)
- **Per-session geofencing toggle** — lecturers may opt out of location checks for a session (default **ON**); opted-out check-ins are stamped `PIN` instead of `GPS` so reports stay auditable
- **Live sessions** — static or rolling (60s) PINs, live attendance tracker, manual override, scheduled sessions with auto-activation
- **Admin** — university/school/department scoping, courses, classes, lecture halls, lecturers, students, bulk CSV import, academic years & semesters, audit logs, attendance overrides
- **Reports** — attendance matrix per student/week, at-risk detection, Excel export
- **Security** — JWT auth with role enforcement, rate limiting per student, soft deletes, audit logging

## Tech stack

| Layer    | Tech |
|----------|------|
| Backend  | Node.js, Express, PostgreSQL (`pg`), express-validator, JWT, node-cron, ExcelJS |
| Frontend | React 18, Vite, React Router, Recharts, Phosphor icons, PWA (workbox) |
| Infra    | PM2 (cluster), Nginx, Render / Oracle Cloud Always Free |

## Repository layout

```
backend/          Express API (routes/, services/, db/migrations/)
  scripts/        Standalone maintenance scripts (e.g. init-db.js)
  tests/          Jest test suites + the load-test harness
frontend/         React + Vite SPA
deployment/       Oracle Cloud deployment guide, setup.sh, deploy.sh, nginx.conf
render.yaml       Render blueprint (API + static frontend)
```

## Local development

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL (local, e.g. `localhost:5432`)

### 1. Backend

```bash
cd backend
npm install
cp ../.env.example .env        # then fill in DATABASE_URL, JWT_SECRET, etc.
```

Database setup — either bootstrap the schema from scratch, or let migrations run:

```bash
node scripts/init-db.js        # creates all tables from src/db/schema.sql
node src/db/seed.js            # optional: demo data (admin + lecturers + courses)
```

Migrations also run automatically on every server start (`npm start`), so a fresh checkout + `.env` is usually enough.

```bash
npm start                      # production (port 5000)
npm run dev                    # nodemon
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                    # Vite dev server (http://localhost:5173)
```

The API base URL is resolved from `VITE_API_URL` (set it in `frontend/.env`) or defaults to the same origin.

### 3. Seed logins (from `src/db/seed.js`)

| Role    | Email                    | Password     |
|---------|--------------------------|--------------|
| Admin   | admin@classpulse.com     | admin123     |
| Lecturer| kasante@university.edu   | lecturer123  |

## Tests

```bash
cd backend
npm test                      # full Jest suite (unit + integration against local DB)
```

Test suites:

- `haversine.test.js` — distance/geofence math
- `double-submit.test.js` — duplicate check-ins, device-fingerprint reuse, name matching
- `matrix.test.js` — attendance matrix, percentages, Excel export
- `bulk-import.test.js` / `lecturer-bulk.test.js` — CSV import flows
- `geofencing-toggle.test.js` — per-session geofencing opt-out behavior
- `e2e-flows.test.js` — admin → lecturer → student flows + cross-role auth (45 edge cases)

### Load test

```bash
cd backend
node tests/attendance-load.js
```

Simulates 187 concurrent students checking in (waves of 20), plus a geofencing-off PIN-only phase, and reports success rate, latency percentiles, throughput, and DB verification stamps.

> Note: integration tests run against the database in `backend/.env` and create/clean up their own data. Run them against a local dev database, not production.

### Continuous Integration

Every push / pull request is verified automatically by GitHub Actions (`.github/workflows/ci.yml`):

- **Backend** — runs `npm test` (all Jest suites, including the e2e and geofencing suites) against a **throwaway PostgreSQL 16 service container**, bootstrapped by applying migrations once (schema + `001`–`015`), then `node src/db/seed.js` and `node scripts/ci-fixtures.js` (lecture hall + active semester the suites require)
- **Frontend** — runs `npm run build` to catch compile/JSX errors early

Secrets (`DATABASE_URL`, `JWT_SECRET`, …) are supplied as CI environment variables / encrypted secrets — never committed.

## Deployment

- **Oracle Cloud Always Free** — see [`deployment/oracle-cloud/README.md`](deployment/oracle-cloud/README.md) (ARM instance, Nginx, PM2, optional domain + SSL)
- **Render** — `render.yaml` defines the API service and static frontend site

## Integrity notes

- `attendance_records.verification_method` is `GPS`, `PIN`, or `MANUAL` — reports can always tell *how* a student was marked
- When a lecturer disables geofencing, students check in with PIN + device fingerprint only, and no coordinates are persisted
- Rate limiting and per-student fingerprint checks apply regardless of geofencing
