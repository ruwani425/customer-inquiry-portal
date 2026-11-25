# Coffee Ninja — Customer Inquiry Management System

A full-stack Customer Inquiry Management System built with **React (TypeScript + Vite)**, **Node.js + Express (TypeScript)**, and **PostgreSQL**.

Staff members sign in, log customer inquiries, search or filter existing inquiries, and move them cleanly through `New → In Progress → Resolved` with server-enforced ownership, validation, and optimistic concurrency checks.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, React Router, Vite, Vitest + React Testing Library
- **Backend:** Node.js, Express, TypeScript, Zod, `pg` (node-postgres), `jsonwebtoken` (`httpOnly` cookie session), `bcryptjs`, Vitest + Supertest
- **Database:** PostgreSQL 16

---

## Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Docker** with Docker Compose (recommended for running PostgreSQL locally) or a local **PostgreSQL 14+** instance

---

## Local Setup (From a Fresh Clone)

1. **Configure environment files**
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env; Copy-Item backend/.env.example backend/.env`)*

   Default settings are aligned across root `.env` (used by Docker Compose) and `backend/.env` (used by the Express API, migrations, and seed script):
   - PostgreSQL user/password/db: `app_user` / `app_password` / `inquiry_db`
   - PostgreSQL host port: `POSTGRES_PORT=5432`
   - Backend connection: `DATABASE_URL=postgresql://app_user:app_password@localhost:5432/inquiry_db`
   - Backend port & CORS: `PORT=4000`, `CORS_ORIGIN=http://localhost:5173`

   > **Port 5432 already in use?** Change `POSTGRES_PORT=5433` in root `.env` and update the port in `backend/.env` (`DATABASE_URL=postgresql://app_user:app_password@localhost:5433/inquiry_db`).

2. **Start PostgreSQL**
   ```bash
   docker compose up -d
   ```
   Docker Compose automatically names the container and volume using the project directory name (e.g. `coffee-ninja-2-postgres-1`).

3. **Install dependencies**
   ```bash
   npm --prefix backend install
   npm --prefix frontend install
   ```

4. **Run database migrations and seed data**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Run backend and frontend in development**
   Open two terminals:
   ```bash
   # Terminal 1 (Backend API on http://localhost:4000)
   npm run dev:backend

   # Terminal 2 (Frontend Vite dev server on http://localhost:5173)
   npm run dev:frontend
   ```
   Then open **http://localhost:5173** in your browser. Vite proxies `/api/*` requests to `http://localhost:4000` so cookies stay same-origin during development.

---

## Seeded Test Accounts

The login page also includes quick-fill buttons for these accounts:

| Name | Email | Password | Role | Access Scope |
| --- | --- | --- | --- | --- |
| Maya Perera | `maya@coffeeninja.local` | `StaffPassword123!` | `staff` | Own inquiries only |
| Liam Fernando | `liam@coffeeninja.local` | `StaffPassword123!` | `staff` | Own inquiries only |
| Nadia Silva | `nadia@coffeeninja.local` | `LeadPassword123!` | `supervisor` | All team inquiries |

---

## Running Tests & Builds

Run all backend and frontend tests:
```bash
npm test
```

Run production builds (type-check + bundle):
```bash
npm run build
```

### Testing Coverage & Gaps
- **Backend (`backend/src/domain/inquiryRules.test.ts`, `backend/src/routes/api.test.ts`)**:
  - Unit tests cover status transition rules, role/ownership checks, contact validation, and duplicate-key normalization.
  - Supertest integration tests cover `401` unauthenticated rejection, `400` validation errors, `403` cross-staff direct link blocking, `409` duplicate inquiry rejection, `409` invalid transitions, `409` stale-tab optimistic locking, and `400`/`404` invalid or missing IDs.
- **Frontend (`frontend/src/App.test.tsx`)**:
  - Tests cover client-side validation + server `409 DUPLICATE_INQUIRY` error link rendering, stale-tab conflict recovery (`409 STALE_INQUIRY` + "Load Latest State"), and `403 FORBIDDEN` access-restricted UI state.
- **Known Testing Gaps**:
  - Backend API tests inject in-memory repository implementations rather than running SQL against a live PostgreSQL instance, so PostgreSQL query syntax, constraints, and migration execution are verified manually against Docker/Postgres rather than automated in CI.
  - End-to-end browser tests (e.g., Playwright across two live tabs) are not included.

---

## API Overview

| Method & Path | Auth | Description |
| --- | --- | --- |
| `GET /api/health` | Public | Health check |
| `POST /api/auth/login` | Public | Verify credentials and set `httpOnly` JWT cookie |
| `POST /api/auth/logout` | Public | Clear session cookie |
| `GET /api/auth/me` | Required | Return current authenticated user |
| `GET /api/inquiries?status=&q=` | Required | List accessible inquiries with optional status/search filter |
| `POST /api/inquiries` | Required | Validate and create a `NEW` inquiry (blocks open duplicates) |
| `GET /api/inquiries/:id` | Required | Fetch single inquiry (enforces `403` ownership check) |
| `PATCH /api/inquiries/:id/status` | Required | Transition status with `expectedVersion` optimistic locking |
