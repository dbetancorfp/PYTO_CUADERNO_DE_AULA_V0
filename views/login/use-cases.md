# Use Cases — Login

## UC-01: Sign in with valid credentials

**Primary actor**: Any unauthenticated visitor
**Preconditions**: A `users` row exists with the entered email; account is not locked
**Elements**: `email-input`, `password-input`, `login-button` (submit), `login-error-message` (error display)

### Main flow

1. User types a valid, registered email into `email-input`.
2. User types the correct password into `password-input`.
3. User clicks `login-button`.
4. `login-button` enters its loading state and the request is sent.
5. Server validates the credentials, resets the account's failed-attempt counter to zero,
   and responds success.
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

- On main flow success: user is redirected to `/dashboard`; failed-attempt counter is 0.
- On A1: failed-attempt counter incremented by 1; user remains on `/login`.
- On A2: failed-attempt counter unchanged; user remains on `/login`.

### Acceptance criteria

- [x] Redirects to `/dashboard` after a response indicating valid, non-locked credentials
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
