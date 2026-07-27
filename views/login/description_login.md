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
