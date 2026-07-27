# API Contracts — Login

### POST /api/auth/login

**Description**: Authenticates a user by email/password. On success, resets the account's
failed-attempt counter. On failure, increments it and locks the account after 5 consecutive
failures.
**Allowed roles**: Public (unauthenticated)
**Elements**: `email-input`, `password-input`, `login-button`, `login-error-message`

#### Request

- **Body**: `{ email: string, password: string }`

#### Response 200

```json
{ "message": "Login successful" }
```

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
- A successful response (200) means: credentials matched, account was not locked, and the
  server has reset `failed_attempts` to 0 for that account.
- A 401 response means: the server has incremented `failed_attempts` for the account matching
  `email` (if one exists — existence of the account is never revealed either way), and if
  that increment reaches 5, set `is_locked = true`. This side effect isn't visible in the
  response body; it only becomes visible on the *next* failed or locked-account attempt.
