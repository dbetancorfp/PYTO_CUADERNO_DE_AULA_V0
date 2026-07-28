# Use Cases — Dashboard

## UC-01: Reach the Dashboard as a signed-in teacher

**Primary actor**: Any signed-in teacher
**Preconditions**: A `session_id` cookie exists (issued by Login's `POST /api/auth/login`)
**Elements**: `app-logo`, `welcome-message`, `settings-menu`, `logout-link` (all navbar
elements rendered once the session gate passes)

### Main flow

1. Teacher's browser holds a valid `session_id` cookie (already signed in via Login).
2. Teacher navigates to `/dashboard`.
3. The app calls `GET /api/auth/session` (Login's existing endpoint — see
   `views/login/api-contracts.md`).
4. The session resolves to the teacher's `full_name`.
5. The Dashboard renders: `app-logo` at the left of the navbar; at the right,
   `settings-menu`, `welcome-message` ("Bienvenido, `<full_name>`"), and `logout-link`, in
   that order; below the navbar, the seven section cards (see UC-03).

### Alternative flows

- **A1 — No valid session**: `GET /api/auth/session` responds `401`. The app redirects to
  `/login` instead of rendering the Dashboard. This covers both a missing `session_id`
  cookie and one that doesn't match any active session (Login's `session-guard` never
  distinguishes the two — see `views/login/use-cases.md` UC-05).

### Postconditions

- On main flow success: the Dashboard is visible, showing the correct signed-in teacher's
  name.
- On A1: the browser is at `/login`; the Dashboard was never rendered.

### Acceptance criteria

- [x] Redirects to `/login` when `GET /api/auth/session` responds `401`
- [x] Renders `app-logo` at the left end of the navbar
- [x] Renders `welcome-message` as "Bienvenido, " followed by the resolved `full_name`
- [x] Renders `settings-menu` and `logout-link` at the right end of the navbar

---

## UC-02: Sign out

**Primary actor**: A signed-in teacher, viewing the Dashboard
**Preconditions**: UC-01's main flow already succeeded (Dashboard is rendered)
**Elements**: `logout-link`

### Main flow

1. Teacher clicks `logout-link`.
2. The app sends `POST /api/auth/logout` (Login's existing endpoint).
3. The server ends the session (see `views/login/use-cases.md` UC-06).
4. The app redirects to `/login`.

### Alternative flows

- None — `POST /api/auth/logout` is idempotent and always responds `200` (see Login's
  `api-contracts.md`), so there's no error branch to handle here.

### Postconditions

- The session that was active is now ended. A later visit to `/dashboard` with the same
  session cookie hits UC-01's A1 (redirect to `/login`), not the main flow.

### Acceptance criteria

- [x] Sends `POST /api/auth/logout` when `logout-link` is clicked
- [x] Redirects to `/login` after the logout response
- [x] A later visit to `/dashboard` with the same, now-ended session redirects to `/login`

---

## UC-03: Navigate to a section via its card

**Primary actor**: A signed-in teacher, viewing the Dashboard
**Preconditions**: UC-01's main flow already succeeded
**Elements**: `calendar-card`, `evaluation-criteria-card`, `work-units-card`,
`student-roster-card`, `diary-card`, `student-detail-card`, `reports-card`

### Main flow

1. Teacher sees the seven cards laid out in a grid, in this fixed order: Calendario,
   Criterios de evaluación, Unidades de Trabajo, Listado de alumnos, Diario, Vista
   individual de alumno, Informes.
2. Teacher clicks one card.
3. The app navigates to that card's route.

### Alternative flows

- **A1 — Destination doesn't exist yet**: every one of the seven routes is unbuilt at this
  point in the project. Navigating there is this view's entire responsibility; what happens
  once you land is explicitly out of scope (separate views, one at a time).

### Postconditions

- The browser is at the clicked card's route. This view's job ends here.

### Acceptance criteria

- [x] `calendar-card` is visible (position 1) and navigates to its route when clicked
- [x] `evaluation-criteria-card` is visible (position 2) and navigates to its route when clicked
- [x] `work-units-card` is visible (position 3) and navigates to its route when clicked
- [x] `student-roster-card` is visible (position 4) and navigates to its route when clicked
- [x] `diary-card` is visible (position 5) and navigates to its route when clicked
- [x] `student-detail-card` is visible (position 6) and navigates to its route when clicked
- [x] `reports-card` is visible (position 7) and navigates to its route when clicked

---

## UC-04: Configuración is a non-functional placeholder

**Primary actor**: A signed-in teacher, viewing the Dashboard
**Preconditions**: UC-01's main flow already succeeded
**Elements**: `settings-menu`

### Main flow

1. Teacher sees `settings-menu`, visibly disabled (not just inert-looking — actually
   non-interactive), at the right end of the navbar.
2. Teacher clicks it.
3. Nothing happens: no menu opens, no navigation, no request.

### Alternative flows

- None.

### Postconditions

- The teacher remains on the Dashboard, `settings-menu` still disabled.

### Acceptance criteria

- [x] `settings-menu` renders in a disabled state
- [x] `settings-menu` exposes a non-availability indicator (e.g. `aria-disabled` or a
      tooltip/label)
- [x] Clicking `settings-menu` opens no menu and sends no request
