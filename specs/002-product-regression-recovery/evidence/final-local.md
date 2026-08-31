# Final Local Evidence: Epic 002 Candidate

**Captured**: 2026-08-04T04:26:03Z
**Worktree**: `/Users/yehor/Projects/ZenFlow/worktrees/codex-product-regression-recovery`
**Branch**: `codex/002-product-regression-recovery`
**Baseline**: `13ca51a80d23220574deba762851fe5a32372e46`
**Authority boundary**: no merge, deploy, live Supabase migration, production-data access, credential handling, or real-account password-removal action

## Candidate scope

The working candidate contains:

- Wave 1 journal password-removal recovery, partial reads, owner/revision fences, one forward-only Supabase migration, privacy-safe diagnostics, eight-locale copy, and accessibility recovery semantics;
- Wave 2 `FeatureAvailability`, IndexedDB-derived journal eligibility, fail-closed gate inventory, and structured runtime/deep-link consumers;
- Wave 3 fail-closed capability policy, deterministic receipt validation, and shared Web/Android/iOS/Tauri build wiring.

It does **not** enable Journal Save Ceremony, alter its host/presentation, apply the migration, restore the 898-file snapshot, or implement unreproduced Wave 4+ regressions. The ceremony is tree-pruned because `requestedCapabilities.journalSaveCeremony=false`, its kill switch is active, and every admission row is `unverified`. Schema v1 is additionally non-enabling: self-asserted all-`pass` metadata cannot produce or validate an enabled receipt.

## Fresh verification ledger

| Command / evidence | Fresh result | Status and exact scope |
| --- | --- | --- |
| `npm run typecheck` | exit `0` | `VERIFIED` for current TypeScript production/test source |
| Wave 1 broad Vitest matrix | 149 files, `1,866/1,866` passed | `VERIFIED` for named journal, migration-source, sync, privacy, modal, account-boundary, and partial-read contracts |
| Availability/capability focused matrix | 12 files; `183` passed, `7` todo (`190` total) | `VERIFIED` only for executed assertions; todo rows are not PASS |
| `npm test` | 730 files; `9,314` passed, `7` todo (`9,321` total), exit `0` | `VERIFIED` for the full local Vitest selection |
| `npm run test:release` | 10 files, `160/160` passed | `VERIFIED` for repository release-contract tests |
| `npm run check:all` | exit `0`; eight locales × `3,612` keys | `VERIFIED` for type, lint, i18n/deep translation, color, canonical-orb, logo, and visual-guard scope |
| `npm run check:sync-contract` | `409` invariants | `VERIFIED` static sync contract only |
| PDI source and diff | exit `0`, errors `0`, warnings `0`, scanned `2,361`, reachable `790` | `VERIFIED` for scanner reachability/substitution rules |
| PDI staged candidate | exit `0`, errors `0`, warnings `0`, scanned `1,882`, reachable `790` | `VERIFIED` after the complete Epic index was staged; rerun after final manifest refresh |
| Production Web build and PDI bundle | exit `0`; capability disabled/no receipt; PDI errors `0`, warnings `0` | `VERIFIED` for the local bundle, not a release artifact |
| Release artifacts and bundle budgets | duplicate check passed; JS `1.5 MB` gzip / `5.2 MB` raw; CSS `74.7 kB` Brotli | `VERIFIED` for that local Web bundle |
| Strict local Chrome performance smoke | 14 phone/desktop route-profile rows; no console errors, request failures, failed responses, warnings, or diagnostics | `VERIFIED` for unauthenticated local production-equivalent routes only |
| PWA/offline Playwright | `2` passed, `2` intentional cross-project skips | Executed rows are `VERIFIED`; skipped rows are not PASS |
| `build:android`, `build:ios`, `build:tauri` | all exit `0`; shared web layer only; capability remains disabled | Native binaries, devices, and packaged Windows runtime remain `UNVERIFIED` |
| `npm run desktop:check` | source contract `115/115`, then exit `1` because Windows `link.exe`/MSVC is unavailable on macOS | Toolchain result is `FAIL`; packaged Tauri runtime is `UNVERIFIED` |
| Direct Snyk Code CLI scopes | journal, storage, and contexts: `0` findings | `VERIFIED` only for those scopes; broad-source result is mixed in `security.md` |
| `npm audit --audit-level=high` | exit `0`, `0` vulnerabilities | `VERIFIED` for the current dependency graph; the base lock independently reproduced 3 advisories |
| Local security suite quick profile | Gitleaks, TruffleHog, Trivy, Checkov, KICS `0`; Terrascan exit `4` | Mixed evidence; no general security PASS |
| `git diff --check origin/main` and conflict scan | exit `0`; unmerged paths `0` | `VERIFIED` before final staging |
| Inline-style ratchet attribution | `origin/main=358`, candidate `=358`, diff additions `=0` | Inherited failure proven; threshold unchanged |
| `npm run constitution:check` | exit `0`; source `948`, tests `610`, inline styles `358`, hooks `50/76` | Constitution freshness `VERIFIED`; generated count blocks were not hand-edited |

## Full preflight result

`npm run ci:preflight` ran through coverage, build, PDI bundle, release-artifact, Tailwind, size, canonical-orb, best-practices, no-AI-template, audio, RAG, task-completion, and sync-contract stages. Those stages completed successfully. The command then exited `1` at the repository ratchet:

```text
inlineStyles 358 VIOLATED floor 313 (tolerance +10, maximum 323)
```

Fresh attribution used the same `style={{` production-TSX predicate:

- `origin/main`: `358`;
- candidate working tree: `358`;
- matching added lines in the Epic diff: `0`.

Status is `FAIL (inherited, non-regressed)`, not PASS. The ceiling was not increased, waived, excluded, or bypassed.

## Ten-role disposition

| Project role | Disposition | Evidence boundary |
| --- | --- | --- |
| 01 Coordinator | `SELECTED` | Owns Spec Kit route, direct evidence, conflict ledger, final diff, and GitHub handoff |
| 02 Psychology / human factors | `EXCLUDED` | No clinical/outcome claim; recovery agency is covered by explicit safe-state requirements |
| 03 Logic / causality | `EXCLUDED` | Counterexamples are covered by selected architecture/QA scopes and direct tests |
| 04 Accessibility / localization | `SELECTED` | Modal stack, focus, Back/Escape, 48px targets, eight locales, and RTL |
| 05 Architecture / data / cross-platform | `SELECTED` | IndexedDB atomicity, owner/revision fences, migration, sync, generated types, rollback |
| 06 Security / privacy / agent trust | `EXCLUDED` as a separate agent | Root ran privacy negative controls, PDI, Snyk, audit, and security suite; live RLS is retained as `UNVERIFIED` |
| 07 Performance / reliability / operations | `EXCLUDED` as a separate agent | Root ran builds, budgets, PWA, Chrome, and preflight; native operations remain scoped gaps |
| 08 QA / evidence / release | `SELECTED` | Final staged identity and requirement-to-proof closure |
| 09 Product / visual craft | `EXCLUDED` | Animation stays disabled and unchanged; no artistic PASS is claimed |
| 10 Blind-spot sentinel | `SELECTED` | Fresh hash-bound Pass B; pre-solution Pass A did not occur and remains `UNVERIFIED` |

Old specialist reports were bound to obsolete identity `6497b30a…` and are not closure proof. A new manifest and reviews are required after final staging.

## Remaining `UNVERIFIED` / rejection ledger

- Exact incompatible object/revision/storage cause in the user's current encrypted journal.
- Real-account password removal after reload/new session.
- Authorized non-production PostgreSQL migration, RLS, Storage, two-session contention, old/new-client coexistence, and forward-recovery drill.
- Canonical Supabase type regeneration from that exact target; current types are hand-reconciled and source-tested.
- Authenticated rendering of removal/degraded-page states without synthetic production behavior.
- Installed-PWA update activation and real owner-bound remote replay.
- Physical Android/iOS biometric, process-death, Back, TalkBack/VoiceOver, font-scale, and hit-area proof.
- Packaged Windows/Tauri runtime, signed/store artifacts, and Windows CI.
- Native-speaker, cultural, qualified accessibility, artistic/craft, and user approval.
- Fresh hash-bound specialist closure, commit, push, PR, and exact-head GitHub CI.
- Merge, migration apply, public deployment, cache-busted deployed runtime, and user-triggered real removal.

No local test, build, scanner, hook, or specialist summary converts any row above into PASS.
