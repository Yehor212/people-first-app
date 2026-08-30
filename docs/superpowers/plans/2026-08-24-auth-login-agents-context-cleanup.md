# Auth Login And Agent Context Cleanup Implementation Plan

> **For agentic workers:** Execute inline in this single locked Codex lane. Do not dispatch project roles or subagents; current user and repository policy require SOLO execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore V2 OAuth callback completion after GitHub Pages canonicalizes route paths, and replace stale agent ceremony with concise repository-specific guidance.

**Architecture:** Keep attempt-scoped PKCE verification and all origin/query/hash binding. Canonicalize only the semantically equivalent terminal slash in callback pathnames so `/orb` and `/orb/` bind to the same attempt while `/orb` and `/settings` remain distinct. Treat `AGENTS.md` as a small routing contract; preserve only rules whose repository or safety value is concrete and route details to existing source documents.

**Tech Stack:** React 18, TypeScript, Vitest, Supabase Auth PKCE, GitHub Pages, Codex `AGENTS.md`.

**Spec:** Current user request; `docs/ai/TEST_FIRST_AGENT_POLICY.md`; `docs/ai/AGENT_CHANGE_GOVERNANCE.md`; official Codex AGENTS.md and Supabase Auth documentation cited in the task report.

## Global Constraints

- Work only in `/Users/yehor/Projects/ZenFlow/worktrees/codex-auth-login-agents-cleanup-20260824` on locked branch `codex/auth-login-agents-cleanup-20260824`.
- Preserve the dirty canonical `main` checkout and do not commit, push, deploy, or change hosted Supabase settings.
- Do not weaken PKCE ownership, cross-origin rejection, exact non-equivalent path rejection, privacy controls, or tests.
- No new production dependency and no mock/demo business data.

---

### Task 1: Reproduce GitHub Pages PKCE callback mismatch

**Files:**
- Modify: `src/lib/__tests__/pkceAttemptIsolation.test.ts`

**Interfaces:**
- Consumes: `createPkceAttemptRedirectUrl`, `runWithPkceCallbackUrl`, configured Supabase Auth client.
- Produces: a regression test proving a real GitHub Pages `/orb` to `/orb/` redirect must retain the same PKCE attempt.

- [ ] Add this behavior test using the real attempt-scoped storage and Supabase client:

```ts
it("accepts GitHub Pages trailing-slash canonicalization for a V2 OAuth callback", async () => {
  const initiation = createPkceAttemptRedirectUrl(
    "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
    "oauth",
  );
  // Initiate OAuth, then exchange a callback whose only path difference is
  // GitHub Pages' confirmed terminal slash.
});
```

- [ ] Run the single test and confirm RED with `This callback does not match the sign-in attempt`.

### Task 2: Canonicalize only the terminal slash in PKCE bindings

**Files:**
- Modify: `src/lib/pkceAttemptStorage.ts`
- Test: `src/lib/__tests__/pkceAttemptIsolation.test.ts`

**Interfaces:**
- Consumes: an already parsed, allow-listed callback `URL`.
- Produces: a canonical pathname where `/` stays `/` and any other path loses exactly one terminal `/` before hashing.

- [ ] Add a private `canonicalAuthPathname(pathname: string): string` helper.
- [ ] Use the helper only for the `pathname` field in `createRedirectBinding()`.
- [ ] Run the new test GREEN.
- [ ] Run existing cross-origin, different-path, malformed-selector, cancellation, and full focused auth suites to prove fail-closed behavior remains.

### Task 3: Replace stale AGENTS.md ceremony with concise durable guidance

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: current repository architecture, workspace doctor protocol, test-first policy, production-data-integrity boundary, and supported platform matrix.
- Produces: a short instruction chain that routes agents to exact source files only when relevant.

- [ ] Capture baseline byte count and the current instruction-health checks.
- [ ] Create the authorized temporary `.Codex-md-unlock` marker.
- [ ] Replace obsolete Windows paths, ten-role orchestra rules, mandatory RAG ritual, duplicated gates, historical release prose, and generic style advice.
- [ ] Preserve canonical repository identity, one locked `codex/` worktree, protected-action approvals, no fabricated production data, Supabase/auth safety, test-first evidence, platform truthfulness, and final diff/status requirements.
- [ ] Remove `.Codex-md-unlock` immediately after the edit.
- [ ] Verify the final file is materially smaller than 26,062 bytes and remains below the 32 KiB discovery cap.

### Task 4: Repair the deterministic lint dependency graph

**Files:**
- Modify: `package.json`
- Modify mechanically: `package-lock.json`
- Delete: `patches/brace-expansion+5.0.8.patch`

**Interfaces:**
- Consumes: minimatch major-version dependency contracts.
- Produces: minimatch 3 with brace-expansion 1, minimatch 5 with brace-expansion 2, and minimatch 10 with patched brace-expansion 5.0.9+ without a global export shim.

- [ ] Record the existing ordinary `npm run lint` failure and module export shapes.
- [ ] Replace the global brace-expansion override with version-scoped minimatch overrides.
- [ ] Remove the obsolete brace-expansion export patch.
- [ ] Regenerate only the lockfile with `npm install --package-lock-only --ignore-scripts`.
- [ ] Run fresh `npm ci --ignore-scripts`, probe each minimatch major, and rerun ordinary `npm run lint`.

### Task 5: Verify blast radius and handoff state

**Files:**
- Review: all changed tracked files.

**Interfaces:**
- Consumes: final source, tests, and instruction file.
- Produces: evidence-backed PASS/FAIL/UNVERIFIED report without publication.

- [ ] Run focused auth tests, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Run `npm run check:agent-context`, `npm run check:no-ai-templates`, `npm run check:best-practices`, and `npm run enforcement:check`.
- [ ] Run the narrow security-suite profile and relevant repository auth/security checks.
- [ ] Run public auth smoke; distinguish provider-start proof from completed-login proof.
- [ ] Inspect `git diff --check`, `git diff`, and `git status --short --branch`.
- [ ] Report native, completed third-party-login, hosted allow-list, deployment, and release evidence as `UNVERIFIED` unless directly observed.

## Self-Review

- Spec coverage: auth root cause, regression protection, agent-context reduction, rollback, platform/security boundaries, and verification are mapped above.
- Placeholder scan: no TODO/TBD or omitted implementation step is present.
- Type consistency: the plan introduces no public API; the pathname helper is private and returns `string`.
