# Use Cases — Login

## UC-01: Sign in with valid credentials

**Primary actor**: Any unauthenticated visitor
**Preconditions**: A `users` row exists with the entered email; account is not locked
**Elements**: `email-input`, `password-input`, `login-button` (submit), `login-error-message` (error display), `session-guard` (session established as a side effect)

### Main flow

1. User types a valid, registered email into `email-input`.
2. User types the correct password into `password-input`.
3. User clicks `login-button`.
4. `login-button` enters its loading state and the request is sent.
5. Server validates the credentials, resets the account's failed-attempt counter to zero,
   starts a session for that user (`session_id` cookie, resolvable by `session-guard`), and
   responds success.
6. The app redirects to `/dashboard`.

### Alternative flows

- **A1 — Wrong email/password combination**: server responds with a generic
  invalid-credentials error. `login-error-message` shows "Incorrect email or password"
  (never indicating which field was wrong). `login-button` returns to its default
  (non-loading, enabled) state. The account's failed-attempt counter is incremented.
- **A2 — Account locked**: the account already reached 5 consecutive failed attempts
  (possibly in a prior session). Even with the correct password, server responds with an
  account-locked error. `login-error-message` shows "This account has been locked due to too
  many failed attempts. Contact support." `login-button` returns to its default state.

### Postconditions

- On main flow success: user is redirected to `/dashboard`; failed-attempt counter is 0; a
  session now identifies this user (`session-guard` resolves the issued `session_id` to
  their `full_name`).
- On A1: failed-attempt counter incremented by 1; user remains on `/login`; no session
  started.
- On A2: failed-attempt counter unchanged; user remains on `/login`; no session started.

### Acceptance criteria

- [x] Redirects to `/dashboard` after a response indicating valid, non-locked credentials
- [x] A successful response is accompanied by a session identifying the signed-in user
      (`session-guard` resolves the issued `session_id` to that user's `full_name`)
- [x] Shows "Incorrect email or password" after a wrong-credentials response, without
      indicating which field was wrong
- [x] Shows "This account has been locked due to too many failed attempts. Contact support."
      after a locked-account response, even when the password given was correct
- [x] A successful login resets the account's failed-attempt counter to zero
- [x] Shows a loading state and is disabled from click until the response arrives

---

## UC-02: Client-side field validation

**Primary actor**: Any unauthenticated visitor
**Preconditions**: None — applies before any request is sent
**Elements**: `email-input`, `password-input`, `login-button`

### Main flow

1. User clicks `login-button` while `email-input` and/or `password-input` are empty.
2. The app shows an inline validation message next to each empty field.
3. No request is sent to the server.

### Alternative flows

- **A1 — Malformed email**: `email-input` has a value that doesn't contain `@` with at
  least one character after it. Same inline-validation behavior as the main flow's empty
  case; no request is sent.

### Postconditions

- No request reaches the server; the user remains on `/login` with visible inline errors.

### Acceptance criteria

- [x] Shows an inline error and does not submit if `email-input` is left empty
- [x] Shows an inline error and does not submit if `password-input` is left empty
- [x] Shows an inline error and does not submit if `email-input`'s value has no `@` or
      nothing after the `@`
- [x] Clears `email-input`'s inline error once corrected to a non-empty, email-shaped value
- [x] Clears `password-input`'s inline error once corrected to a non-empty value

---

## UC-03: Toggle password visibility

**Primary actor**: Any unauthenticated visitor
**Preconditions**: `password-input` has a value (not required, but this is the meaningful
case)
**Elements**: `password-toggle-button`, `password-input`

### Main flow

1. User clicks `password-toggle-button` once.
2. `password-input` reveals its content as plain text.
3. User clicks `password-toggle-button` again.
4. `password-input` masks its content again.

### Alternative flows

- None — this is a purely client-side, two-state toggle.

### Postconditions

- `password-input`'s visual masking state matches the number of toggle clicks (odd =
  revealed, even = masked); the typed value itself is never altered by toggling.

### Acceptance criteria

- [x] Reveals `password-input` as plain text after clicking `password-toggle-button` once
- [x] Masks `password-input` again after clicking `password-toggle-button` a second time

---

## UC-04: Forgot password link (out of scope placeholder)

**Primary actor**: Any unauthenticated visitor
**Preconditions**: None
**Elements**: `forgot-password-link`

### Main flow

1. `forgot-password-link` is visible below `login-button` on first load.

### Alternative flows

- **A1 — Clicked**: user clicks `forgot-password-link`. Nothing happens: no navigation, no
  request. This is explicitly out of scope per `description_login.md`.

### Postconditions

- User remains on `/login` regardless of whether the link was clicked.

### Acceptance criteria

- [x] Is present and visible below `login-button` on first load
- [x] Does not navigate and sends no request when clicked

---

## UC-05: Resolve who is signed in (session-guard)

**Primary actor**: Any other view's frontend, or that view's own backend endpoint, checking
the caller's identity (first consumer: the Dashboard view, not yet built)
**Preconditions**: None — applies to any incoming request
**Elements**: `session-guard`

### Main flow

1. A request arrives carrying a `session_id` cookie.
2. `session-guard` looks it up in the in-process session store.
3. The `session_id` matches an active session: resolves to that user's `full_name` (and any
   other identity fields a future view may need).

### Alternative flows

- **A1 — No `session_id` cookie**: resolves to "not signed in".
- **A2 — `session_id` doesn't match any active session** (never existed, expired, or already
  ended via `logout-session`): resolves to "not signed in" — indistinguishable from A1, so
  no response ever reveals whether a given `session_id` once existed.

### Postconditions

- The caller knows whether there's a signed-in user and, if so, their `full_name`. No state
  changes as a result of resolving — this is a read-only check.

### Acceptance criteria

- [x] Resolves to "not signed in" when no `session_id` cookie is present
- [x] Resolves to "not signed in" when `session_id` doesn't match any active session
- [x] Resolves to the signed-in user's `full_name` when `session_id` matches an active
      session
- [x] Resolves to "not signed in" for a `session_id` that was previously ended via
      `logout-session` — same response shape as A1/A2, no distinguishing detail

---

## UC-06: End a session (logout-session)

**Primary actor**: A signed-in user, via another view's logout action (first caller: the
Dashboard view's future "Salir" element — out of scope here, this use case only covers the
session-ending capability itself)
**Preconditions**: A `session_id` cookie is present (may or may not still be active)
**Elements**: `logout-session`

### Main flow

1. The caller invokes the logout capability with the current `session_id`.
2. The session is removed from the in-process session store.
3. `session-guard` immediately resolves that same `session_id` to "not signed in" for any
   subsequent request.

### Alternative flows

- **A1 — Already-ended or unknown `session_id`**: no error; the outcome is the same as the
  main flow's end state ("not signed in") — idempotent, and never reveals whether the
  `session_id` had ever been valid.

### Postconditions

- The `session_id` no longer identifies anyone. A request that previously reached an
  authenticated view (e.g. Dashboard) using this `session_id` must be treated as
  unauthenticated afterward — no reaching it again via back button or a resubmitted cookie.

### Acceptance criteria

- [x] After `logout-session` runs for a given `session_id`, `session-guard` resolves that
      same `session_id` to "not signed in"
- [x] Running `logout-session` again for an already-ended or unknown `session_id` doesn't
      error and still results in "not signed in"
