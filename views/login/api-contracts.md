# API Contracts — Login

### POST /api/auth/login

**Description**: Authenticates a user by email/password. On success, resets the account's
failed-attempt counter and starts a session for that user. On failure, increments the
counter and locks the account after 5 consecutive failures.
**Allowed roles**: Public (unauthenticated)
**Elements**: `email-input`, `password-input`, `login-button`, `login-error-message`, `session-guard` (session established as a side effect)

#### Request

- **Body**: `{ email: string, password: string }`

#### Response 200

```json
{ "message": "Login successful" }
```

**Also sets** a `Set-Cookie: session_id=<opaque-token>; HttpOnly; SameSite=Lax; Path=/`
header — not JWT, no encoded payload; the token is only a lookup key into the in-process
`InMemorySessionRepository` (see `tecnologias/tecnologia_code.md`/`tecnologia_bbdd.md`).
Never readable/settable by client-side JS (`HttpOnly`).

#### Errors

| Code | Condition |
|------|-----------|
| 400 | `email` or `password` missing, empty, or not a string (server-side re-validation — the client already prevents this) |
| 401 | `email`/`password` combination doesn't match any non-locked account. Body: `{ "message": "Incorrect email or password" }` |
| 403 | The account matching `email` is locked (5+ consecutive failed attempts). Body: `{ "message": "This account has been locked due to too many failed attempts. Contact support." }` — returned even if `password` is correct |

Notes:

- 401 and 403 share the same generic shape (`{ message: string }`) so the frontend never has
  to special-case field-level blame — see `functional-spec.json`'s global rule on never
  indicating which field was wrong.
- A successful response (200) means: credentials matched, account was not locked, the
  server has reset `failed_attempts` to 0 for that account, and a new session now identifies
  it (see `Set-Cookie` above).
- A 401 response means: the server has incremented `failed_attempts` for the account matching
  `email` (if one exists — existence of the account is never revealed either way), and if
  that increment reaches 5, set `is_locked = true`. This side effect isn't visible in the
  response body; it only becomes visible on the *next* failed or locked-account attempt. No
  session is started on 401 or 403.

---

### GET /api/auth/session

**Description**: Resolves the caller's `session_id` cookie to whether they're signed in and,
if so, their identity. Any other view (starting with Dashboard) calls this to gate access
and to render who's signed in — it never inspects the cookie itself.
**Allowed roles**: Public (the endpoint is callable by anyone; the answer differs based on
whether a valid session exists)
**Elements**: `session-guard`

#### Request

- No params, query, or body — identity comes entirely from the `session_id` cookie.

#### Response 200

```json
{ "fullName": "Jane Doe" }
```

#### Errors

| Code | Condition |
|------|-----------|
| 401 | No `session_id` cookie, or it doesn't match any active session (never existed, or already ended via logout) — body: `{ "message": "Not authenticated" }`. Both cases return the exact same body: whether a given `session_id` ever existed is never revealed. |

---

### POST /api/auth/logout

**Description**: Ends the caller's current session, if any. Idempotent — never errors, even
if there was no active session to end.
**Allowed roles**: Public (safe to call regardless of session state; see idempotence above)
**Elements**: `logout-session`

#### Request

- No params, query, or body — the session to end comes entirely from the `session_id`
  cookie.

#### Response 200

```json
{ "message": "Logged out" }
```

**Also clears** the `session_id` cookie (`Set-Cookie: session_id=; Max-Age=0; Path=/`), so
the browser stops sending it.

#### Errors

None — see idempotence in Description. A missing or already-invalid `session_id` still
yields 200; the session is guaranteed to be inactive either way.
