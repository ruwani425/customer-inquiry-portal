# Engineering Decisions (`DECISIONS.md`)

## Assumptions

- **Team structure:** Customer requests arrive via chat, phone, or email and are logged manually by staff. A staff member who logs an inquiry is responsible for handling it (`owner_id`), while a team lead (`supervisor`) oversees all inquiries across the team.
- **Authentication:** Staff accounts are provisioned internally (seeded in PostgreSQL) rather than self-registered, and sessions are maintained with signed `httpOnly` JWT cookies (`cn_session`) proxied on the same origin in development.
- **Intentional scope:** Rather than adding tags, priorities, or a full comment thread, the system adds only **one extra field (`lastNote`)** alongside `updatedBy` and `updatedAt`. This directly addresses *"staff sometimes lose track of who is handling a request, whether it has been addressed, and what happened last"* without bloating the workflow.

---

## Meaningful Design Choices

### 1. Ownership & Access Control (`staff` vs `supervisor`)
- **Decision:** Every inquiry has an `owner_id` set automatically from the authenticated user on creation. Users with the `staff` role can list, view, and update only inquiries where `owner_id === user.id`. Users with the `supervisor` role can view and update all team inquiries.
- **Enforcement:** Enforced both in PostgreSQL list queries (`WHERE i.owner_id = $1`) and via `canAccessInquiry(user, inquiry)` on `GET /api/inquiries/:id` and `PATCH /api/inquiries/:id/status`. Opening a direct link to another staff member's inquiry returns `403 Forbidden` before revealing any record details or version state.

### 2. Linear Lifecycle & Terminal `RESOLVED` State
- **Decision:** Inquiries follow a strict forward lifecycle: `NEW → IN_PROGRESS → RESOLVED`. Skipping `IN_PROGRESS` (`NEW → RESOLVED`) or reopening a `RESOLVED` inquiry is rejected by the API with `409 Conflict` (`INVALID_STATUS_TRANSITION`).
- **Reasoning:** Requiring `IN_PROGRESS` prevents accidental one-click closure and encourages staff to record who picked up the request. Treating `RESOLVED` as terminal keeps historical resolution records clean; if a customer follows up later, staff log a new inquiry (and our duplicate guard explicitly ignores `RESOLVED` inquiries so repeat topics are allowed once closed).

### 3. Stale-Data Handling via Optimistic Locking (`version`)
- **Decision:** Every inquiry carries an integer `version` column starting at `1`. When a client updates status, it sends `expectedVersion`. The backend runs an atomic `UPDATE inquiries SET ... , version = version + 1 WHERE id = $id AND version = $expectedVersion`. If another browser tab updated the inquiry first, the server returns `409 STALE_INQUIRY` along with `currentInquiry`.
- **UI behavior:** Instead of silently overwriting the newer status, the UI displays an amber conflict banner showing the latest server status and who updated it, plus a **Load Latest State** button.

### 4. Customer Input Validation & Lightweight Duplicate Policy
- **Decision:** Both client and server (`zod`) trim inputs, require meaningful lengths, and validate `customerContact` as either an email address or a 7–15 digit phone number. On creation, the backend checks whether a non-`RESOLVED` inquiry already exists with the same normalized contact and subject; if so, it returns `409 DUPLICATE_INQUIRY` with a direct link to the existing open inquiry.

---

## Trade-Off Accepted

- **Explicit optimistic conflict detection vs. real-time sync:** I chose optimistic locking on write (`version` check) over WebSockets, Server-Sent Events, or aggressive background polling. The trade-off is that an idle second tab continues displaying stale data until the user acts or refreshes. In exchange, the architecture stays simple, stateless, and free of silent lost updates, while keeping stale-tab behavior deterministic and easy to demonstrate.
- **In-memory repository doubles for automated API tests:** Express routes, middleware, validation, and auth run end-to-end in Supertest against an in-memory repository, which keeps `npm test` fast without requiring Docker in every test run—at the cost of needing a real PostgreSQL check for SQL syntax and constraints.

---

## What I Would Improve Next

1. **PostgreSQL-backed integration tests** (using a dedicated test database or Testcontainers) to verify SQL queries, regex duplicate checks, and migrations automatically in CI.
2. **Supervisor reassignment & activity log:** Allow a `supervisor` to reassign `owner_id` between staff members and store status/note transitions in an append-only `inquiry_events` table instead of overwriting `last_note`.
3. **Pagination & sorting:** Add cursor/offset pagination on `GET /api/inquiries` as inquiry volume grows.

---

## Use of AI and Outside Resources

- **Where AI helped:** AI assistance was used to scaffold the TypeScript Express/React project boilerplate, draft initial Zod schemas, and generate repetitive Vitest/Supertest test cases.
- **Suggestion changed/rejected:** An initial AI suggestion proposed using an ORM (Prisma) and allowing `RESOLVED` inquiries to transition freely back to `IN_PROGRESS`. I **rejected** both: I used plain `pg` with explicit parameterized SQL so query behavior and optimistic `UPDATE ... WHERE version = $5` locking stay transparent, and I restricted transitions to a strict `NEW → IN_PROGRESS → RESOLVED` state machine so resolved records remain immutable.

