# API Contracts — Dashboard

This view introduces **no new endpoints**. It's a client of Login's existing session API
(`views/login/api-contracts.md`), consumed as-is — the two endpoints below are documented
here only as references (method, route, what this view does with them), not redefined.
Nothing in this file changes their behavior or shape.

## Consumed: GET /api/auth/session

**Owner**: Login (`views/login/api-contracts.md`)
**Used by**: `app-logo`/`settings-menu`/`welcome-message`/`logout-link` (session gate on
load, per UC-01)

- **200** `{ "fullName": string }` — renders `welcome-message` as "Bienvenido,
  `<fullName>`" and proceeds to render the rest of the Dashboard.
- **401** `{ "message": "Not authenticated" }` — redirects to `/login` instead of rendering
  the Dashboard (UC-01 A1). The Dashboard never inspects the message body beyond the status
  code.

## Consumed: POST /api/auth/logout

**Owner**: Login (`views/login/api-contracts.md`)
**Used by**: `logout-link` (UC-02)

- **200** `{ "message": "Logged out" }` — the only response shape (idempotent, per Login's
  contract). On receiving it, `logout-link` redirects to `/login`.

## Not applicable: the seven section cards

`calendar-card`, `evaluation-criteria-card`, `work-units-card`, `student-roster-card`,
`diary-card`, `student-detail-card`, `reports-card` (UC-03) call no endpoint at all — each
is pure client-side navigation to a route that doesn't exist yet. No request, no contract.

## Schema changes

None. This view reuses `users.full_name`, already added by Login's session-gap reopen — no
`schema-changes.sql` for this view.
