# ZenFlow PWA Quality Implementation

## Goal

Deliver four independently specified and verified PWA improvements without changing Android/Capacitor, iOS/WKWebView, or Desktop/Tauri behavior: shell lifecycle, audio, sync continuity, and motion/navigation/icon quality.

## Global Constraints

- Installed PWA is the primary target; Web/Vite receives a progressive fallback.
- Shared code may change only behind an explicit Web/PWA runtime capability boundary. Native behavior must remain unchanged and requires owner compatibility receipts before release.
- IndexedDB remains local truth. No schema migration, production write, mock production data, paid service, dependency addition, new music, rebrand, native edit, public deploy, commit, push, PR, or merge is authorized.
- A service worker must not promise convergence while every PWA client is closed.
- Audio always pauses while the document is hidden and resumes only through an explicit visible user action.
- Existing canonical orb quality and generator-owned logo geometry remain unchanged.
- Feature `002-habit-model-library` remains upstream-owned and disabled until an exact hash-bound approved handoff exists.
- Technical, runtime, accessibility, artistic, audio-fit, platform, and release verdicts remain separate.

## Required Workflow

For each feature run the complete repository Spec Kit route:

1. Specify the user failure, non-goals, requirements, measurable outcomes, edge cases, and UNVERIFIED ledger.
2. Clarify using the decisions already supplied by the user; do not reopen settled product choices.
3. Plan architecture, state transitions, contracts, failure paths, rollback, and platform matrix.
4. Validate requirements with domain checklists.
5. Generate dependency-ordered, test-first tasks with exact paths.
6. Analyze spec, plan, and tasks non-destructively; implementation starts only with zero unresolved critical conflicts.
7. Add and run the smallest focused RED evidence before production edits, then implement minimal GREEN changes and blast-radius checks.
8. Converge against current code; append and implement any real remaining tasks until no actionable local gaps remain.

Every feature retains hashes for the normalized request, spec artifacts, evidence receipts, requirement-to-proof map, rejected alternatives, platform matrix, and local diff. Missing live, device, public, native, human, or artistic proof remains `UNVERIFIED`.

## Feature 1: PWA Shell Lifecycle

- Add one runtime-surface resolver and one shell-lifetime install owner.
- Preserve a stable manifest identity, support both orientations, progressive locale metadata, square/maskable PWA icons, and manual Safari installation help without an automatic install banner.
- Replace automatic service-worker activation/reload with a user-visible waiting state and a dirty-writer barrier covering normal updates and stale-chunk recovery.
- Restrict cache deletion to ZenFlow-owned names and prove an unrelated same-origin cache survives.
- Store only sanitized route identifiers in diagnostics and serve an accessible localized emergency offline page.

Acceptance: install event is retained before Settings mounts; accepted/dismissed/error/installed paths are explicit; reload never crosses a rejected or timed-out writer; one update causes at most one reload; raw query/hash secrets never reach diagnostics.

## Feature 2: PWA Audio Offline

- Remove whole-library startup warming. Long audio has zero cold-launch requests.
- Cache only an explicitly selected track using a same-origin hash/size/revision manifest, user-visible progress/cancel/delete, storage estimate, quota failure, and targeted eviction.
- Confirm unlock only after successful playback or a running audio context.
- Pause on hidden/pagehide/lock and require an explicit visible Resume control.
- Localize Media Session metadata and emit semantic success cues only after durable local persistence.

Acceptance: Save-Data/slow-network cannot be overridden by a query flag; corrupt or stale bytes are rejected; offline Range playback either works or reports honest unavailability; no failed save produces a success cue. Human listening remains a separate user-owned gate.

## Feature 3: PWA Sync Continuity

- Derive sync UI only from existing queue/cursor/receipt truth and separate local save, outbound pending, confirmed online, and inbound applied states.
- On reopen, drain durable outbound work before delta pull; preserve leader, sequence, gap, idempotency, tombstone, and account-boundary contracts.
- For Web/PWA, forbid new content-bearing localStorage fallbacks. Preserve the existing legacy migration as atomic validate, Dexie commit, then legacy deletion.
- Keep the cursor unchanged on failed transactions, expose storage-full incidents, and exclude content, IDs, raw URLs, and OAuth secrets from diagnostics.

Acceptance: closed-client behavior is described honestly; offline reopen, duplicate delivery, gaps, account switch, migration interruption, quota, and diagnostic canaries have focused tests. Live same-account and cross-platform convergence require user-assisted and platform-owner proof.

## Feature 4: PWA Motion, Tabs, Grids, and Icons

- Classify every affected motion as essential, event, decorative, or canonical. Optional loops and assets do not start when effective motion is disabled.
- Preserve static meaning for functional timing and canonical orb craft.
- Implement complete keyboard/focus/RTL tab semantics for current lightweight local panels.
- Replace the 182-focus-stop heatmap interaction with a noninteractive summary plus one 44px history action.
- Add date and mood/status to calendar accessible names and require emotion icons to be either explicitly decorative or localized and labelled.
- Bound the PWA journal list to 96 mounted cards while preserving order, focus, search, and scroll.
- Keep install identity, Lucide controls, and habit pictograms as separate ownership tracks. Do not activate feature `002`.

Acceptance: reduced motion causes zero optional animation fetches and no decorative change after six seconds; tabs, heatmap, calendar, large-list, RTL, touch-target, icon mutation, and route performance contracts pass without lowering canonical visual quality.

## Verification and Release Gates

- Focused Vitest RED/GREEN evidence for each behavior, followed by typecheck, lint, i18n, translation, sync, audio, canonical-orb, logo, production-data-integrity, security, build, browser, performance, and CI checks appropriate to the changed paths.
- Installed Chrome/Edge PWA is the primary runtime. Safari macOS/iOS Home Screen receives manual install and lifecycle checks. Firefox is a Web/offline fallback without install claims.
- Android, iOS native wrapper, and Tauri files remain untouched. Their owners must supply compatibility receipts before release if shared modules changed.
- Rollback dependency is `4 -> 3 -> 2 -> 1`; feature 1 cannot be reverted while later features import its runtime contract.
- GitHub issues may be created only from completed `tasks.md`, only against the verified canonical GitHub remote, and only after open/closed issue deduplication by exact task ID.
- The branch and locked worktree remain local at the end. Publication requires a separate user decision.
