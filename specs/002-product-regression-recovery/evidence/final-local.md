# Final Local Evidence: Wave 1 Candidate

> **CURRENT DISPOSITION (2026-08-04): `UNVERIFIED`; this packet is stale.**
> Substantial implementation and tests were added after this capture. The PDI
> fixed-point helper/trigger case is currently a known `FAIL`. All command
> counts, hashes, staged-manifest statements, and `PASS` rows below are retained
> history only, not current proof. This document must be regenerated from a
> frozen tree before Spec Kit convergence.

**Worktree**:
`/Users/yehor/Projects/ZenFlow/worktrees/codex-product-regression-recovery`
**Branch**: `codex/002-product-regression-recovery`
**Baseline**: `13ca51a80d23220574deba762851fe5a32372e46`
**Scope**: PR 1 only — journal password-removal recovery and partial readable pages
**Authority boundary**: no merge, deploy, live Supabase migration,
production-data access, credential handling, or real-account password-removal
action

## Candidate scope

This branch contains the Wave 1 journal implementation, its forward-only but
unapplied Supabase migration, Spec Kit packet, privacy-safe diagnostics, eight
locale recovery copy, and dependency/PDI prerequisites. It does not contain
Wave 2 `FeatureAvailability` production code or Wave 3
capability-receipt/build wiring. Those later-wave changes are retained only in
local draft commit `9b89931a10db29f654dd9239b266f530d55fa4a8` and are not
accepted evidence for this branch.

## Fresh verification ledger

| Command / evidence | Result | Scope and limitation |
| --- | --- | --- |
| `npm run typecheck` | `PASS`, exit `0` | TypeScript executed separately from tests |
| Focused Wave 1 Vitest command | `PASS`: 179/179 files, 2,137/2,137 tests | Journal, storage/sync, auth/account boundary, offline queue, and PDI negative controls |
| `npm test -- --maxWorkers=1 --reporter=dot` | `PASS`: 724/724 files, 9,236 passed, 7 todo | Full local Vitest; todo rows are not PASS |
| `npm run check:all` | `PASS`, exit `0` | Eight locales × 3,606 keys; i18n/deep translation, hardcoded-color, canonical orb/logo/visual, and V2 paper checks |
| `npm run test:coverage` inside `ci:preflight` | `PASS`: 724/724 files, 9,236 passed, 7 todo; lines 64.34% | Coverage receipt covered 942 TypeScript source files; todo rows are not PASS |
| `npm run check:sync-contract` | `PASS`: 409 invariants | Static/local sync contract only |
| `npm run constitution:check` | `PASS`, exit `0` | Source 946, tests 608, inline styles 358, hook coverage 50/76 |
| Agent-content guards | `PASS`: no-AI-template, best-practices 66, task-completion 133 | Repository governance/content checks, not product runtime proof |
| PDI source and diff | `PASS`: errors 0, warnings 0, scanned 2,360, reachable 788 | Production-data substitution/reachability scope |
| PDI staged | `PASS`: errors 0, warnings 0, scanned 1,878, reachable 788 | Rerun once more after manifest-only freeze |
| `npm run build` | `PASS`: 3,224 modules, service worker, 55 precache entries | One production Web artifact used for following sequential checks |
| PDI bundle + release artifacts | `PASS`, errors 0, warnings 0 | Same `dist`; no concurrent build mutation |
| Bundle budgets | `PASS`: size-limit 1.49 MB JS gzip / 5.19 MB JS raw / 74.69 kB CSS Brotli; strict report 1.42 MB / 4.95 MB / 72.9 kB | The two tools use different aggregation boundaries; both stayed within their configured budgets |
| PWA/offline | `PASS` 2, `SKIP` 2 | Chromium offline SW plus WebKit route/install metadata; skipped rows stay SKIP |
| Strict Chrome performance | `PASS`, exit `0`; 14/14 ready, 0 console/network/response failures | Unauthenticated production-equivalent routes; report/hash in `evidence/browser.md` |
| Android native build | `PASS`: Gradle assembleDebug, 428 tasks | Compile/package proof; no device/runtime/biometric/AT proof |
| iOS simulator build | `PASS`: Xcode `BUILD SUCCEEDED` without signing | Compile/link proof; no simulator interaction/device/Keychain/VoiceOver proof |
| `npm run desktop:check` | `FAIL`: source contract 115 passed, overall exit `1` because `link.exe`/MSVC is unavailable on macOS | Windows/Tauri packaged runtime remains `UNVERIFIED` |
| Scoped Snyk Code | `PASS`: 0 issues in journal, storage, and PDI script scopes | Scoped, not a blanket whole-repository security guarantee |
| `npm audit --audit-level=high` | `PASS`: 0 vulnerabilities | Installed dependency graph |
| Security suite quick | Mixed: five scanners exit `0`, Terrascan exit `4` | Detailed inherited/tool boundaries in `evidence/security.md`; no overall PASS |
| `npm run ci:preflight` | `FAIL` only at final inline-style ratchet | All preceding stages ran; baseline and candidate both 358, Epic source diff adds 0 and removes 0; stored floor 313 + tolerance permits 323. Threshold was not changed |

## Reviewer-blocker remediation

The first hash-bound accessibility and architecture reviews both returned
`STOP`; that candidate hash was invalidated rather than accepted:

- the French singular degraded-page reassurance used plural subject
  `données` with singular agreement. A retained regression assertion failed
  first, the locale value was corrected, and the exact rerun passed `30/30`;
- authenticated journal-security RPCs did not share the permanent
  `account_deletion_blocks` admission boundary. A retained SQL negative
  control failed first; the migration now takes the owner advisory lock and
  then reads the deletion tombstone under `READ COMMITTED` before each of six
  authenticated journal mutations. The migration/delete/PDI rerun passed
  `148/148`.

The migration remains unapplied. Static SQL contracts do not prove live
PostgreSQL execution, isolation, RLS, Storage policy, or two-session behavior.

## Ratchet attribution

The final local release gate is not green. Fresh base/candidate comparison:

- `origin/main` inline styles: `358`;
- Wave 1 candidate inline styles: `358`;
- matching lines added by this source diff: `0`;
- matching lines removed by this source diff: `0`;
- current ratchet maximum: `323`.

This is an inherited repository gate failure, not evidence of a new Wave 1
style regression. It remains `FAIL`; neither the ratchet nor source checks
were weakened to turn it green.

## Final freeze status

The implementation and broad local checks above are fresh. The current staged
candidate passed PDI staged, full-index staged Gitleaks (zero leaks),
`git diff --check`, unmerged-path, generated-artifact, obvious-secret,
production-data substitution, and Wave 2/3 production-code exclusion reviews.
The candidate contains 124 changed paths including this manifest, or 123 paths
when the self-referential manifest is excluded; no `dist`, `build`, `coverage`,
`output`, dependency, recovery-copy, env, or MCP credential path is staged.
These closure rows remain pending:

- exact staged manifest/identity;
- hash-bound accessibility, architecture, QA, and independent blind-spot
  closure reports;
- commit, push, PR, and exact-head CI.

## Known non-local gaps

- exact incompatible object/revision/storage cause in the user's current journal;
- real-account password removal after reload and a new session;
- authorized non-production PostgreSQL migration, RLS, Storage, contention,
  old/new-client coexistence, canonical type generation, and forward recovery;
- authenticated changed-state browser rendering;
- physical Android/iOS biometric/lifecycle/Back/AT/font-scale proof;
- packaged Windows/Tauri runtime;
- native-speaker, cultural, qualified accessibility, and human acceptance proof;
- exact-head CI, merge, public deployment, and cache-busted deployed runtime.

No local test, build, scanner, hook, or agent review can convert these rows into
PASS.

## Ten-role routing disposition

| Role | Disposition | Evidence locator / reason | Closure state |
| --- | --- | --- | --- |
| 1 — coordinator | `SELECTED` | Root agent owns the Spec Kit packet, branch scope, evidence ledger, and final authority boundary | Active |
| 2 — psychology/human factors | `EXCLUDED` | Wave 1 changes recovery wording and security state but makes no clinical, emotional-pressure, interruption, or agency claim requiring this specialist | Scope-grounded exclusion |
| 3 — logic/state coherence | `SELECTED` | Owner/revision/intent transitions and partial-success state machine in journal removal | Final hash-bound review required |
| 4 — accessibility/i18n | `SELECTED` | Destructive dialog, live region, focus, Escape/Back, RTL, and eight locales | First `STOP` remediated; final hash-bound recheck required |
| 5 — architecture/data/cross-platform | `SELECTED` | IndexedDB local truth, Supabase fence, lifecycle resume, and native cleanup boundary | First `STOP` remediated; final hash-bound recheck required |
| 6 — security/privacy | `SELECTED` | Password removal, account-deletion permanence, ciphertext/privacy, RLS and Storage trust boundaries | Final hash-bound review required |
| 7 — performance/reliability/operations | `SELECTED` | Resumable cleanup, offline queue backoff, migration locks, build/runtime and rollback evidence | Final hash-bound review required |
| 8 — QA/release verification | `SELECTED` | M2 traceability, negative controls, candidate identity, CI and deploy claims | Initial review remains `STOP` for merge/release; final hash-bound recheck required |
| 9 — product/visual craft | `EXCLUDED` | Wave 3 ceremony/animation enablement and visual decision are intentionally absent from PR 1; no visual design is being admitted | Re-select for Wave 3 |
| 10 — blind-spot sentinel | `SELECTED` | M2 protected journal/security change and candidate closure | Pass A was not performed and cannot be reconstructed; final Pass B remains required and cannot authorize merge/release alone |
