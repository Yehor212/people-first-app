# Security Policy

ZenFlow takes security seriously. This document explains how to report a vulnerability and what to expect in response.

## Supported Versions

| Version | Supported |
| --- | --- |
| v1.7.x (Google Play current) | Yes |
| v2.0.x (upcoming) | Yes (once released) |
| Earlier versions | No — please update |

## Reporting a Vulnerability

If you believe you have found a security vulnerability in ZenFlow, please report it privately. **Do not open a public GitHub issue.**

- **Email:** security reports to the maintainer at the email on the app's Google Play listing (primary contact).
- Include:
  - A description of the issue
  - Steps to reproduce (if possible)
  - Impact assessment (what data / what users)
  - Your preferred contact for follow-up

## What to Expect

- **Acknowledgement:** within 3 business days.
- **Assessment:** within 10 business days, we will reply with our understanding of the issue, severity, and expected fix timeline.
- **Fix + disclosure coordination:** we target 90 days for most issues; critical issues are fast-tracked.
- **Credit:** with your permission, we acknowledge reporters in release notes.

## Scope

**In scope:**
- The ZenFlow app (Android, iOS when released, web at zenflow.app)
- The Supabase backend (edge functions, RLS policies, stored procedures)
- Authentication flows (OAuth, phone/OTP)
- Data handling (journal entries, mood data, profile data)

**Out of scope:**
- Reports requiring physical access to a victim's unlocked device
- Social engineering attacks against the reporter's own account
- Denial-of-service against the reporter's own session
- Third-party vendor vulnerabilities (Supabase, Firebase, Sentry, Capacitor) — please report those to the respective vendor
- Issues in forked copies of the code

## Known Safe Defaults

ZenFlow follows these practices (verified in `docs/audit/` and memory):

- No client-side secrets in the codebase (verified by automated scans)
- All Supabase tables have RLS enabled (`profiles`, journal entries, mood entries)
- OAuth redirect allowlist enforced (`src/lib/authRedirect.ts`)
- XSS sanitization on error-report export paths (`src/components/ErrorBoundary.tsx`, `src/components/auth-screen/useAuthHandlers.ts`)
- Dependency CVE audit via `npm audit` on every CI run
- Snyk code scans for SAST (see `.snyk` for vetted ignores)
- Crash reports have PII stripped before send
- Session tokens stored per platform best practice (documented TODO to migrate to `@capacitor-community/secure-storage`)

## Recent Audits

- **2026-04-18:** Tech-debt audit — `docs/tech-debt-audit-2026-04-18.md`. All 6 previously-remaining OWASP findings verified fixed.
- **2026-04-01:** OWASP audit round 3 — 37/37 findings closed.

## Disclosure Philosophy

We practice **coordinated disclosure**: we ask reporters for a reasonable embargo window (typically 90 days) so we can ship a fix before details become public. We do not threaten or harass security researchers. Good-faith research is welcome.

---

*This policy is intended to be pragmatic, not exhaustive. If you have a concern not covered here, reach out and we will respond.*
