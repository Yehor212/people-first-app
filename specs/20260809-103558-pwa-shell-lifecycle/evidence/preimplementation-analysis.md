# Pre-Implementation Analysis: PWA Shell Lifecycle

**Analysis date**: 2026-08-09  
**Scope**: Spec Kit artifacts for the PWA shell lifecycle only. No production source, native file, package, `.specify/feature.json`, issue, deployment, or production data was changed.

## Hash ledger

**Normalized request SHA-256**: `c725ba66b86cec0be2fb6e08cfa9e3f4652fe7b588cd865d44f4fbb3af8a368a`.

| Baseline source | SHA-256 |
| --- | --- |
| `src/hooks/usePwaInstall.ts` | `8d85f57466136cbb7e05ed286d18de423ef293fd3e2c4f4ba77f8b079acc5814` |
| `src/main.tsx` | `60a1e637b42b85e23668754dccb56ca28cc68304408b493ee9c6ffa7d4b958eb` |
| `src/sw.ts` | `6a877cb2b72bf4bee0aebada80b04429ad425edfe7f2e8638a135d6587d79be6` |
| `src/lib/serviceWorkerMessages.ts` | `bd6fc1a14003c14c3a09e7e4893a4ed236090705e8795c8211778f34157df68a` |
| `vite.config.ts` | `0f6276987c8ea6d51f2e6fd348376b4033cfad8f3c9590f9b9ebbf5928c0c275` |
| `public/manifest.webmanifest` | `ef0c88b3be200fe9f07f21914a7c7be77be9bbd56503e938eab10c18f58326b4` |
| `docs/manifest.webmanifest` | `ef0c88b3be200fe9f07f21914a7c7be77be9bbd56503e938eab10c18f58326b4` |
| `public/offline.html` | `a297906b97ad2c1b60fc28f84dc97e068d65124a1277f1015b59e34db51aa701` |

The generated artifact manifest is `evidence/artifact-manifest.sha256`. It is a local integrity receipt for this packet, not proof of runtime behavior.

## Inputs and evidence sources

| Source | Evidence used | Status |
| --- | --- | --- |
| Master plan | `docs/superpowers/plans/2026-08-09-pwa-quality.md`, Feature 1 and global constraints | VERIFIED (source read) |
| Current install path | `src/hooks/usePwaInstall.ts`, `src/hooks/__tests__/usePwaInstall.test.ts`, `src/components/InstallBanner.tsx` | VERIFIED (source read) |
| Current update/cache path | `src/main.tsx`, `src/sw.ts`, `src/lib/serviceWorkerMessages.ts`, `vite.config.ts` | VERIFIED (source read) |
| Current metadata/offline contracts | `public/manifest.webmanifest`, `docs/manifest.webmanifest`, `public/offline.html`, corresponding script tests | VERIFIED (source read) |
| Project policy | `AGENTS.md`, Spec Kit, Test-First, No-AI-Templates, Production Data Integrity, Telegram runtime contracts | VERIFIED (source read) |
| Constitution | `.specify/scripts/bash/check-zenflow-constitution-status.sh --json` returned `PROPOSED_CONSTITUTION_CONSIDERATION` | VERIFIED (command); nonbinding |
| Free RAG | `npm run rag:preflight -- "PWA shell install update offline lifecycle Spec Kit pre-implementation artifacts"` returned task context | VERIFIED (command); sources rechecked above |
| Worktree edit doctor | `npm run doctor -- --mode edit --agent codex` missing; fallback script absent in this worktree | UNVERIFIED |

## Current finding inventory

| ID | Finding | Source evidence | Impact | Severity |
| --- | --- | --- | --- | --- |
| F-01 | The deferred browser install event is captured only after a hook consumer mounts. | `src/hooks/usePwaInstall.ts` | Installed PWA/Web user may lose a valid later Settings install action. | HIGH |
| F-02 | The worker activates itself during installation. | `src/sw.ts` install listener calls `self.skipWaiting()`. | An update can interrupt a running shell. | HIGH |
| F-03 | Recovery cleanup enumerates all same-origin Cache Storage keys. | `src/sw.ts` `CLEAR_CACHES` handler maps every `caches.keys()` entry to deletion. | Unrelated same-origin cache may be deleted. | HIGH |
| F-04 | Build registration is configured for automatic updates. | `vite.config.ts` sets `registerType: "autoUpdate"`. | Waiting state/user control may be bypassed. | HIGH |
| F-05 | Static offline copy claims future synchronization rather than current local/offline state. | `public/offline.html` source text. | User receives a remote-state promise the shell cannot establish. | MEDIUM |
| F-06 | Manifest orientation is portrait-only while Feature 1 requires both orientations. | `public/manifest.webmanifest` and `docs/manifest.webmanifest`. | Installed PWA orientation contract is incomplete. | MEDIUM |
| F-07 | Existing worker message filtering is origin/script-URL constrained, but lifecycle-specific route redaction/update state coverage is not present. | `src/lib/serviceWorkerMessages.ts` and unit test. | Privacy/trust contract needs explicit regression proof. | MEDIUM |

## Cross-artifact consistency analysis

### Analysis checks

| Check | Result | Evidence |
| --- | --- | --- |
| Every user story has an independent test definition | PASS | `spec.md` User Stories 1–3 and `tasks.md` phases 3–5. |
| Requirements have stable IDs and measurable success criteria | PASS | `spec.md` FR-001–FR-012 and SC-001–SC-006. |
| Clarifications contain no unresolved question | PASS | `spec.md` Clarifications records five settled decisions from the master plan. |
| Every FR and buildable SC maps to tasks | PASS | Traceability matrix below and `tasks.md` Requirement traceability. |
| Tasks are dependency ordered and test-first | PASS | T001–T006 capture/RED evidence before T008/T014/T021/T032/T034/T036 production work. |
| Tasks name exact expected paths | PASS | Each T001–T046 cites a concrete repository or feature evidence path; T005/T017/T018 use an evidence-discovered owner-path rule before edit. |
| Data lifecycle stays within scope | PASS | `data-model.md` creates only ephemeral states and prohibits new persistence/remote writes. |
| Platform domains are explicit | PASS | `spec.md` and `plan.md` name all five project targets and domain proof boundaries. |
| Proposed constitution treated as binding CRITICAL source | PASS negative control | Status output is proposal-only; no finding/task is classified solely from it. |
| Issue creation/publication implied by tasks | PASS negative control | `tasks.md` explicitly excludes issue, commit, push, PR, deploy, and release authority. |

### Requirement-to-task coverage

| ID | Requirement or success criterion | Task IDs | Coverage status |
| --- | --- | --- |
| FR-001 | Runtime surface separation | T007–T008, T015, T022, T045 | Covered |
| FR-002 | Lifetime install owner | T012–T016 | Covered |
| FR-003 | Install states | T012–T018, T044 | Covered |
| FR-004 | Manual Safari path | T013, T017–T018, T044 | Covered |
| FR-005 | Stable manifest | T033–T034, T040, T044 | Covered |
| FR-006 | Waiting update | T019–T028, T044 | Covered |
| FR-007 | Dirty-writer barrier | T019–T023, T029–T030, T044 | Covered |
| FR-008 | One reload maximum | T019–T029, T044 | Covered |
| FR-009 | Cache ownership | T031–T032, T044 | Covered |
| FR-010 | Offline fallback | T035–T036, T040, T044 | Covered |
| FR-011 | Privacy-safe diagnostics | T009–T010, T037, T042 | Covered |
| FR-012 | Trusted messages | T009–T010, T024–T025, T042 | Covered |
| SC-001 | Late event/state proof | T012–T018, T039 | Covered |
| SC-002 | Barrier/reload proof | T019–T023, T029–T030, T039, T044 | Covered |
| SC-003 | Unrelated cache survival | T031–T032, T044 | Covered |
| SC-004 | Manifest/offline metadata proof | T033–T036, T040 | Covered |
| SC-005 | Route redaction proof | T009–T010, T037, T039 | Covered |
| SC-006 | Runtime installed-PWA proof | T041, T044–T046 | Covered; runtime execution remains UNVERIFIED |

Coverage: 18/18 requirements and buildable criteria have one or more implementation/verification task(s), 100%.

## Requirement quality checklist results

- `checklists/requirements.md`: 18/18 complete.
- `checklists/ux-security.md`: 12/12 complete.

These counts certify document completeness only. They do not certify a runtime, device, browser, deployed page, or human acceptance.

## Artifact-stage verification executed

| Command/check | Result | Scope |
| --- | --- | --- |
| `npm run rag:preflight -- "PWA shell install update offline lifecycle Spec Kit pre-implementation artifacts"` | PASS | Retrieved context was source-checked before use. |
| `.specify/scripts/bash/check-zenflow-constitution-status.sh --json` | PASS | Returned proposal-only status; no binding constitution finding. |
| `shasum -a 256 -c evidence/artifact-manifest.sha256` | PASS | Ten artifact content hashes matched before this verification section was added; the final receipt is refreshed after the section's addition. |
| Task format/sequence static check | PASS | 46 tasks, contiguous T001–T046, each with checkbox, exact path, and required story label where applicable. |
| Template-marker scan | PASS | No unresolved feature/date/argument/clarification/template marker in this feature directory. |
| Whitespace check against `/dev/null` | PASS | No whitespace errors in feature artifacts. |
| `npm run check:no-ai-templates` | PASS | Repository policy/hook/wiring guard; not a claim that visual or product review occurred. |
| `npm run check:production-data-integrity:diff` | PASS | `errors=0 warnings=0 baselined=0 waived=0 scanned=1865 reachable=783`; source policy scan, not runtime behavior proof. |

No production behavior test, PWA build, browser/device test, deployment, release, security scan, or native build ran in this artifact-only stage.

## Unresolved risks and evidence gaps

| Gap | Why it remains | Required later evidence | Status |
| --- | --- | --- | --- |
| Browser implementation behavior | This task created artifacts only; no source/test/browser mutation was authorized. | Focused RED/GREEN tests, installed Chrome/Edge PWA test, console/network capture. | UNVERIFIED |
| Safari macOS/iOS Home Screen | Chromium `beforeinstallprompt` is not Safari behavior. | Manual-install and lifecycle observation on Safari/iOS Home Screen. | UNVERIFIED |
| Android/Capacitor, iOS/WKWebView, Desktop/Tauri | Native files are intentionally untouched; shared runtime compatibility has no owner receipt yet. | Resolver test plus owner build/device receipts. | UNVERIFIED |
| Public GitHub Pages | Deployment not authorized. | Cache-busted deployed URL after a separately authorized release. | UNVERIFIED |
| Accessibility/visual craft | Requirements are specified, not rendered. | Keyboard/screen-reader/RTL/safe-area screenshot and visual review. | UNVERIFIED |
| Security scan | No production code changed in this delegated artifact task. | Narrow scoped scanner after implementation. | SKIP (not yet applicable) |
| Worktree lock health | The specified doctor command/script is absent from this worktree. | Parent-controlled workspace protocol proof or available doctor command. | UNVERIFIED |

## Critical-finding decision

**Unresolved active-policy CRITICAL findings: 0.** The pre-implementation packet is ready to enter the authorized implementation stage, subject to its test-first token and scope recheck.

This is not a readiness claim for release: high-risk implementation findings F-01 through F-04 still require code and fresh tests. Any failure of the RED/GREEN safety contracts, cache negative control, message trust boundary, manifest identity check, production-data integrity check, or user authorization boundary is `STOP` for implementation handoff.

## Verdict

**GO (artifact stage only).** The Spec Kit packet is internally traceable and has no unresolved active-policy CRITICAL inconsistency. Production behavior, browser/device/public evidence, release, and worktree-doctor proof remain `UNVERIFIED` as listed above.
