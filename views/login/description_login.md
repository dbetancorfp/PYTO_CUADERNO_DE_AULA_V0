# Login

We need a login screen for the application. It's the first thing anyone sees when they open
the app and aren't already signed in.

## What the user sees

A centered card with:
- The app name/logo at the top.
- An email field.
- A password field (masked, with a small icon/button to toggle showing the password in
  plain text).
- A "Sign in" button.
- A "Forgot your password?" link below the button (doesn't need to go anywhere yet — just
  needs to exist as a link, out of scope for now).
- An error message area that shows up only when something goes wrong (wrong credentials,
  locked account, etc.) — it shouldn't be visible on first load.

## Behavior

- Both fields are required. If the user tries to submit with either one empty, show an
  inline validation message next to the empty field(s) and don't send anything to the
  server.
- Email must look like an email (has an `@`, has something after it) before we even try to
  submit — same inline validation as above.
- While the request is in flight, the "Sign in" button should show a loading state and be
  disabled, so the user can't double-submit by clicking twice.
- On success: redirect to `/dashboard` (that view doesn't exist yet — just redirect there
  for now, this view's job ends at a successful login).
- On failure because the email/password combination is wrong: show a generic error message
  ("Incorrect email or password") in the error area — never say which of the two fields is
  wrong, that's a security thing our security team insisted on.
- After 5 failed attempts in a row for the same account, that account gets locked. On the
  next attempt (even with the correct password), show a different message: "This account
  has been locked due to too many failed attempts. Contact support." A successful login
  resets the failed-attempt counter back to zero.
- There's no "remember me" checkbox and no social login (Google/GitHub/etc.) — out of scope
  for this view.

## Data

This is a new app, so there's no `users` table yet. We'll need one, with at least: a unique
email, a securely hashed password (never store it in plain text), and whatever's needed to
track failed login attempts and whether the account is locked.

We don't have a registration view yet either — for now, assume a handful of test accounts
get inserted directly for QA purposes; registration is a separate, future view.

## Session (added — closing a gap found while designing the Dashboard view)

Right now a successful login only returns a generic success message — there's no way for
any other view to know who is signed in. This has to close, because the Dashboard (the
view built right after this one) shows "Bienvenido, `<nombre del profesor>`" and needs to
be able to end that session on "Salir".

- On successful login, the server starts a session for that user; the browser holds a
  `session_id` cookie identifying it. Per `tecnologias/tecnologia_code.md` and
  `tecnologia_bbdd.md`, this was already the intended design (`cookie-parser`, no JWT, no
  `express-session`; sessions live in an in-process `InMemorySessionRepository` `Map`, not
  persisted to Postgres) — it just was never implemented when this view was first built.
- Any other view must be able to ask "who is currently signed in" and get back at least the
  teacher's full name.
- There must be a way to end the session (used by the Dashboard's "Salir" link): after
  logout, the session is invalidated server-side and the cookie no longer identifies
  anyone — a later "who is signed in" check must fail, and the app sends the user back to
  `/login`.
- A signed-out session must not be able to reach an authenticated view again via back
  button or a stale/resubmitted `session_id` cookie.

## Data (updated)

`users` is also missing a **full name** field entirely — there's no column to answer "who
is signed in" with something displayable. Add one (e.g. `full_name`).
