# Feature Specification: Agent and PWA Visibility Audit

**Feature Branch**: `codex/agent-pwa-visibility-audit`

**Feature Directory**: `specs/20260804-000837-agent-pwa-visibility-audit`

**Created**: 2026-08-04

**Status**: Analysis only — no product, GitHub, or deployment mutation is authorized.

**Input**: User description: "Я всё ещё не понимаю, почему агенты работают в VS Code, но я не вижу их файлы и PWA не обновилась. Проведи анализ через Spec Kit."

## Explicit Requirements

- Establish why a user can see an agent working while the expected files are absent from the VS Code window they opened.
- Establish where the pending "898 files" went and whether they reached `main`.
- Establish whether the public Web/PWA release reflects the current `main` commit, and distinguish a failed deploy from an installed-PWA cache state.
- Follow the Spec Kit lifecycle for the diagnostic work.
- Do not push, merge, deploy, reset, clear browser data, alter production records, or change user-facing product code during the analysis.

## Evidence Snapshot at Start

The following observations are direct, timestamped audit inputs and not a claim about an end-user's personal browser profile:

- The legacy checkout at `/Users/yehor/Documents/Codex/2026-06-10/new-chat/people-first-app` and clean control `main` both resolve to `13ca51a80d23220574deba762851fe5a32372e46`.
- `codex/agent-doctor` is a locked linked worktree at `/Users/yehor/Projects/ZenFlow/worktrees/codex-agent-doctor`, but its doctor-command files are uncommitted. It therefore cannot be visible in either `main` checkout or a deployed artifact.
- `codex/pending-898-speckit-batch` is an ancestor of current `main`; PR #64 and PR #65 were merged. The PR #64 final diff contains 150 paths, while its preserved snapshot accounts for 893 legitimate paths after five generated cache files were excluded.
- GitHub Actions run `30801612477` deployed `13ca51a80d23220574deba762851fe5a32372e46` successfully. A cache-busted public navigation returned the deployed Settings screen and bundle `assets/index-u1b3za2B.js`.

## User Scenarios & Testing

### User Story 1 - Locate an agent change (Priority: P1)

As the repository owner, I can tell which exact worktree and Git state an agent used, so I know why a file is absent from the VS Code window currently open.

**Why this priority**: A local file in another worktree is not a missing Git change; confusing the two can cause unsafe copying, reset, or edits in the wrong checkout.

**Independent Test**: Compare the VS Code root candidate, the relevant linked-worktree root, branch, `HEAD`, and `git status --short` without modifying any of them.

**Acceptance Scenarios**:

1. **Given** an agent has uncommitted edits in a linked worktree, **When** the audit compares that worktree with a `main` checkout, **Then** it reports the two absolute roots and marks the change as local-only rather than claiming it is lost or deployed.
2. **Given** a generated one-root `.code-workspace` file exists for the agent lane, **When** the audit checks its folder mapping, **Then** it identifies that as the VS Code window that can show the lane's Source Control changes.

---

### User Story 2 - Trace the 898-file batch to its release state (Priority: P1)

As the repository owner, I can distinguish an initial snapshot count from the final merged change and know whether it is reachable from `main`.

**Why this priority**: A large count is not evidence that the same number of visible screens changed, and a remote branch name is not evidence of publication.

**Independent Test**: Compare `origin/main` with `origin/codex/pending-898-speckit-batch`, inspect PR merge state, and calculate the merge-commit file count and top-level path distribution.

**Acceptance Scenarios**:

1. **Given** a branch appears to contain the pending batch, **When** its merge base and left/right commit distance are calculated, **Then** the audit states whether it is unmerged, ahead, behind, or already reachable from `main`.
2. **Given** a preserved snapshot mentions 898 paths, **When** the final PR diff is counted, **Then** the audit reports both counts with their meanings instead of treating them as one number.

---

### User Story 3 - Separate deployed PWA freshness from cache state (Priority: P1)

As the person using the installed PWA, I can know whether the server actually deployed the relevant `main` SHA before taking any action that might risk local offline data.

**Why this priority**: GitHub Pages deployment, a normal browser tab, and an installed PWA can have different freshness states. Clearing site data can affect unsynced IndexedDB data.

**Independent Test**: Match `origin/main` to a completed `deploy.yml` run, inspect its `deploy` job, and open the public URL with a cache-busting query in a clean browser context.

**Acceptance Scenarios**:

1. **Given** `main` has a successful deploy job for its current SHA, **When** the public route is opened with a cache-buster, **Then** the audit records the deployed bundle and route state as public-release evidence.
2. **Given** an installed PWA might retain an old service worker or be offline, **When** the audit offers a next step, **Then** it uses the in-app update check/reload path first and does not tell the user to clear site data or unregister a service worker.

---

### User Story 4 - See release parity clearly (Priority: P2)

As the repository owner, I can see which platform was updated by the web deploy and which platforms require their own release evidence.

**Why this priority**: A GitHub Pages deploy does not update Android, iOS, or Tauri artifacts.

**Independent Test**: Map each platform to its documented release channel and classify the available evidence as `VERIFIED`, `UNVERIFIED`, or `N/A`.

**Acceptance Scenarios**:

1. **Given** a `main` deploy succeeds, **When** platform release channels are compared, **Then** Web/Vite is marked as deployed, the installed PWA is marked `UNVERIFIED` until its own profile is observed, and native/Desktop release status is not inferred.

### Edge Cases

- A VS Code window can be a different root or a multi-root review workspace; the title alone is insufficient proof of its folder mapping.
- A PWA can be offline, suspended, or controlled by an older service worker even while GitHub Pages serves the latest page to a clean client.
- Browser data clearing can remove local offline state; this diagnostic must not prescribe it without a separate backup/sync assessment and owner approval.
- The generated pre-React `version-check.js` intentionally clears Cache Storage and unregisters service workers when it itself detects a version mismatch. That is distinct from manual site-data clearing and does not directly delete IndexedDB, but its end-to-end impact on an installed profile remains `UNVERIFIED` here.
- The public repository may show a successful workflow while an unrelated build annotation is non-blocking; the deploy job and deployed SHA remain separate evidence.
- Tauri, Android, and iOS consume separate release channels and do not update merely because `deploy.yml` publishes GitHub Pages.

## Requirements

### Functional Requirements

- **FR-001**: The audit MUST map each relevant change to an absolute worktree root, branch, `HEAD`, and clean/dirty state.
- **FR-002**: The audit MUST distinguish local uncommitted agent changes from committed branch changes, merged `main` changes, and deployed web artifacts.
- **FR-003**: The audit MUST trace the 898-file snapshot through PR #64/#65 and state the final diff scope without claiming every initial path became a visible UI change.
- **FR-004**: The audit MUST match the current `origin/main` SHA to a specific `deploy.yml` run and a cache-busted public URL before saying Web/PWA is deployed.
- **FR-005**: The audit MUST distinguish the in-app cache-busted reload from the generated bootstrap's mismatch-triggered Cache Storage/service-worker cleanup, and retain the user-profile cache state as `UNVERIFIED` unless directly inspected.
- **FR-006**: The audit MUST supply an explicit Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri matrix.
- **FR-007**: The audit MUST not write to remote Git, GitHub Pages, installed-app storage, production data, or native release channels.

### Key Entities

- **Workspace lane**: One linked Git worktree, its branch, lock state, generated VS Code workspace file, and uncommitted-path set.
- **Change lineage**: The relationship from a local lane or remote branch through commit/PR/`main` to a deploy run.
- **Web deployment receipt**: Current `main` SHA, Actions run, deploy-job conclusion, public URL, and observed cache-busted bundle identity.
- **Client freshness state**: The state of one browser/PWA profile's service worker, caches, online status, and pending durable writes. It is private to that profile and must not be inferred from a clean-browser inspection.

## Platform and Domain Matrix

| Surface | Current audit question | Evidence target | Initial status |
|---|---|---|---|
| Web/Vite | Does the public page serve the deployed `main` artifact? | Cache-busted public route plus Actions deploy receipt | Pending fresh proof |
| Installed PWA | Can an existing installed profile still be stale? | In-app update check/reload and profile-specific observation | `UNVERIFIED` until the installed profile is inspected |
| Android/Capacitor | Did this web deployment update an Android artifact? | AAB/versionCode and device/release receipt | `UNVERIFIED`; GitHub Pages is not an Android release |
| iOS/WKWebView | Did this web deployment update an iOS artifact? | archive/TestFlight/version receipt | `UNVERIFIED`; GitHub Pages is not an iOS release |
| Desktop/Tauri | Is the screenshot a released Tauri build and did it update? | desktop-release workflow/GitHub Release and app build identifier | `UNVERIFIED`; web deployment is not a Tauri release |
| Security and privacy | Could a diagnostic or refresh discard private local records? | no manual data-clearing action; separate review of generated bootstrap cache cleanup | Pending fresh proof |
| Accessibility and i18n | Does public screen expose the expected translated settings route? | public DOM snapshot, including Ukrainian labels | Pending fresh proof |
| Operations | Can an operator identify which SHA is live? | immutable commit/run/deployment identifiers | Pending fresh proof |

## Non-Goals

- Do not implement a user-facing change, alter the PWA service worker, or enable the journal save ceremony.
- Do not stage, commit, push, merge, deploy, create a pull request, or modify release configuration.
- Do not inspect or clear the user's personal PWA storage, sign-in state, journal content, or browser history.
- Do not call local source inspection proof of an Android, iOS, Tauri, store, or human-acceptance release.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every relevant visibility claim is tied to a concrete root, branch, SHA, Actions run, or public bundle identity recorded by a fresh command/browser observation.
- **SC-002**: The report explains the 898 snapshot count and the 150-path final PR #64 diff without conflating them.
- **SC-003**: The report identifies a safe first action for a potentially stale installed PWA that does not clear local data.
- **SC-004**: All five supported platforms have an explicit outcome (`VERIFIED`, `UNVERIFIED`, or `N/A with reason`) rather than inheriting Web/PWA status.
- **SC-005**: The Spec Kit analysis contains no placeholder text, fabricated human/device proof, or unapproved side effects.

## Assumptions and Unverified Items

- The user screenshot appears to be a Chromium/PWA-style window because it includes a browser extension puzzle/menu affordance; a Tauri runtime cannot be confirmed from the image alone. `UNVERIFIED`.
- The clean in-app browser proves what a fresh public client can fetch, not the state of the user's installed PWA profile. `UNVERIFIED`.
- Cache Storage/service-worker cleanup by the generated bootstrap is source-confirmed on a mismatch, but whether it ran in the user's profile and its offline/recovery effect are `UNVERIFIED`.
- The desired end state is diagnosis and a safe operational path, not automatic publication or a force-refresh of user data.
- The ZenFlow Spec Kit constitution is `PROPOSED` and nonbinding; it is considered only as proposal criteria, never as release authority.
