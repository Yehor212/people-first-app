---
description: Error handling & validation rules — applies to validation.ts, crashReporting.ts, analytics.ts
---

# Error Handling & Validation Rules (Law 5: Loud Failure)

- Validate at system boundaries only: user input, API responses, external data. Trust internal code.
- No silent `.catch(() => {})` — every catch must log, rethrow, or handle explicitly
- Crash reports: filter PII before sending (no emails, names, or auth tokens in payloads)
- Analytics events: use consistent naming (`section.action.detail`), no PII in event properties
- Error boundaries: wrap route-level components, not individual elements
- Structured error logging: `{ code, message, context, timestamp }` — not just string messages
- Validation schemas (Zod): define once in `schemas.ts`, reuse across forms and API handlers
- User-facing errors: always use i18n translation keys, never raw error messages
- Network errors: distinguish offline (retry later) from 4xx (user error) from 5xx (server error)
- Never swallow Supabase/Firebase errors — surface them through the error boundary chain
