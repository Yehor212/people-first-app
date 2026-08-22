# Telegram Auth Completion Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Use `superpowers:executing-plans` only for an approved plan; do not invoke subagents or auto-start the next task. Existing checkboxes are tracking only.

**Goal:** Make Telegram sign-in a production-ready Supabase custom OAuth/OIDC flow for ZenFlow without exposing provider secrets.

**Architecture:** The app remains a Supabase OAuth client and calls `signInWithOAuth({ provider: "custom:telegram" })`. Telegram credentials live only in BotFather/Supabase Dashboard; the client only knows public provider metadata and safe redirect targets.

**Tech Stack:** React 18, TypeScript, Supabase Auth custom OAuth/OIDC, Telegram OIDC, Capacitor Browser, Vitest.

---

### Task 1: Client OAuth Safety

**Files:**
- Modify: `src/lib/authProviders.ts`
- Test: `src/lib/__tests__/authProviders.test.ts`

- [x] Add a failing test that rejects non-OAuth Telegram subdomains such as `https://core.telegram.org/auth` for native OAuth redirect opening.
- [x] Restrict Telegram trusted domains to `oauth.telegram.org`.
- [x] Rerun targeted auth provider tests and confirm they pass.

### Task 2: Provider Linking Readiness

**Files:**
- Modify: `supabase/config.toml`
- Modify: `scripts/check-auth-providers.cjs`
- Test: `scripts/__tests__/auth-providers-readiness.test.ts`

- [x] Add a failing readiness test requiring manual identity linking.
- [x] Enable `enable_manual_linking = true` locally.
- [x] Add readiness output for local manual identity linking.
- [x] Enable hosted `custom_oauth_enabled` and `security_manual_linking_enabled` through the Supabase Management API.

### Task 3: Owner-Owned Telegram Credentials

**Files:**
- Modify: `docs/auth-facebook-telegram-setup.md`

- [x] Document BotFather allowed URLs.
- [x] Document Supabase custom provider fields for `custom:telegram`.
- [x] Keep `phone` out of default scopes unless a separate privacy decision is made.
- [ ] User creates/opens a Telegram bot in BotFather and obtains Client ID + Client Secret.
- [ ] User configures the Supabase custom provider with those credentials.

### Task 4: Final Verification

- [x] `npm run test -- src/lib/__tests__/authProviders.test.ts scripts/__tests__/auth-providers-readiness.test.ts`
- [x] `npm run check:auth-providers -- --strict`
- [ ] Real Telegram web login.
- [ ] Real Telegram native callback via `com.zenflow.app://login-callback`.
- [ ] Confirm user metadata works without email: display name or `preferred_username` appears.

## Remaining External Blocker

Telegram Client ID and Client Secret are not present in env, Keychain, or the repo. They must be created by the account owner in BotFather and entered into Supabase Dashboard. Do not paste the secret into chat or git.
