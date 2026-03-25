---
description: Error handling & validation rules — applies to validation.ts, crashReporting.ts, analytics.ts
---

# Error Handling & Validation Rules (Law 5: Loud Failure)

- Validate at system boundaries only: user input, API responses, external data. Trust internal code.
- Every `.catch()` must log, rethrow, or handle explicitly — ensure all errors are visible
- Crash reports: filter PII before sending (strip emails, names, and auth tokens from payloads)
- Analytics events: use consistent naming (`section.action.detail`), keep event properties PII-free
- Error boundaries: wrap route-level components (keep individual elements boundary-free)
- Structured error logging: always use `{ code, message, context, timestamp }` format (prefer over plain string messages)
- Validation schemas (Zod): define once in `schemas.ts`, reuse across forms and API handlers
- User-facing errors: always use i18n translation keys via t() for all error messages
- Network errors: distinguish offline (retry later) from 4xx (user error) from 5xx (server error)
- Surface all Supabase/Firebase errors through the error boundary chain
