# Access Request App

A small workflow where employees request access to tools (GitHub, AWS, Slack, Google Workspace), managers approve or reject, and every decision is recorded in an audit history.

## Run it

Requires Node.js 18+. No `npm install` needed (zero dependencies).

```bash
node server.js        # or: npm start
# open http://localhost:3000
node test.js          # run the logic tests
```

Optional env vars: `PORT` (default 3000), `DATA_FILE` (default `data/requests.json`).

## Features

| Requirement | How it works |
|---|---|
| Create a request | Employee enters name, picks a system, writes a reason. All three are validated on the server. |
| See requests | List with status badge: Pending, Approved or Rejected. Newest first. Employees see their own requests (matched by name); managers see all. |
| Approve / reject | Manager-only. A reason is required to reject. Only Pending requests can be decided (no double decisions). |
| History | Each request has an append-only history: who did what, when, and the note. |
| No login | Role dropdown (Employee / Manager) in the header. |

## Project structure

```
server.js          HTTP server, API routes, business logic
test.js            Unit tests for validation and rules
public/index.html  Single-page UI (HTML + CSS + JS)
data/requests.json Created on first request (JSON file storage)
```

## API

All calls need a header `X-Role: Employee|Manager`. `X-User` carries the acting name.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/requests` | - | Manager: all. Employee: own only. |
| POST | `/api/requests` | `{name, system, reason}` | 201 on success, 400 on validation error. |
| POST | `/api/requests/:id/decision` | `{decision: "Approved"\|"Rejected", comment}` | 403 if not Manager, 404 unknown id, 409 if already decided, 400 if rejecting without a reason. |

Example history entry:

```json
{ "action": "Rejected", "by": "Ravi", "at": "2026-11-26T09:30:00.000Z", "note": "Use read-only role instead" }
```

## Design decisions

- **Rules live on the server.** The UI hides buttons, but the server also rejects an Employee trying to decide, so the rules hold even if someone calls the API directly.
- **Audit trail is append-only.** History entries are only ever added, never edited or deleted. Timestamps are ISO 8601 UTC, generated server-side, not by the browser.
- **Decisions are final.** A decided request cannot be changed, which keeps the record clean for an auditor.
- **JSON file storage** keeps setup to zero and the data readable. Fine for a demo.
- **XSS safe.** All user text is escaped before display.

## Limitations (by design, for this exercise)

- The role dropdown is not security. Anyone can pick "Manager". Real use needs login (e.g. SSO) and roles from an identity provider.
- A manager can approve their own request. A real system should block this (separation of duties).
- Approval records the request only; it does not grant access in GitHub/AWS/etc.
- JSON file is not safe for concurrent heavy use; swap for SQLite/Postgres in production.
- Employees are matched by name, so two people with the same name would see each other's requests.

## Possible next steps

Real authentication, a database, email/Slack notifications, filtering and search, CSV export of the audit log, and blocking self-approval.
