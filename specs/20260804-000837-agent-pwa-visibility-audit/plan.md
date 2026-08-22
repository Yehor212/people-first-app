# Implementation Plan: Agent and PWA Visibility Audit

**Branch**: `codex/agent-pwa-visibility-audit` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Analysis-only specification from `specs/20260804-000837-agent-pwa-visibility-audit/spec.md`.

## Summary

Produce a read-only, evidence-bound explanation for three different visibility paths:

1. agent worktree files versus the folder open in VS Code;
2. a preserved 898-path batch versus the final merged PR content;
3. `main` versus GitHub Pages and an already-installed PWA profile.

The approach uses Git's worktree and commit graph as source-of-truth, GitHub Actions deployment metadata for the published SHA, and one cache-busted public browser observation. It produces no product implementation, deployment, or cache-clearing action.

## Technical Context

**Language/Version**: TypeScript/React 18/Vite in the product; Node.js-backed repository scripts and Git CLI for this audit.

**Primary Dependencies**: Git linked worktrees; repository `agent:workspace` guard; GitHub Actions `deploy.yml`; Vite PWA/Workbox; public GitHub Pages; in-app browser observation.

**Storage**: Audit artifacts are Markdown only. The product's Dexie/IndexedDB local truth and any user PWA storage are out of scope and must not be read or cleared.

**Testing**: Read-only Git graph/state commands, Actions run/job inspection, cache-busted public browser DOM observation, and a structural review of the final Spec Kit artifacts.

**Target Platform**: Audit covers Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri separately; no binary/mobile/desktop build is produced.

**Project Type**: Cross-platform React application with native Capacitor shells and a separate Tauri release channel; this feature itself is an internal diagnostic packet.

**Performance Goals**: No runtime change. Network evidence calls are bounded; public page is observed without changing its state.

**Constraints**: No commit, push, merge, deploy, reset, cache deletion, service-worker unregister, production data access, personal PWA storage access, or credential use beyond existing read-only GitHub metadata access.

**Scale/Scope**: Current lineage is `codex/agent-doctor`, `codex/pending-898-speckit-batch`, PR #64/#65, current `main` SHA `13ca51a80d23220574deba762851fe5a32372e46`, and Actions run `30801612477`.

## Constitution Check

The constitution status check returned `PROPOSED`, `ratified=false`, and `blocking_authority=false`. It is therefore recorded as `PROPOSED_CONSTITUTION_CONSIDERATION`, not as a blocking or release authority.

Binding gates used instead:

| Gate | Evidence / Decision | Status |
|---|---|---|
| Isolated workspace | Clean control-lane doctor and clean locked audit-lane doctor both returned `GO` before artifact writes. | `VERIFIED` |
| Spec Kit lifecycle | Specify → clarify (no material question) → plan → checklist → tasks → analyze is required. Implement/converge are excluded because product implementation is not authorized. | `VERIFIED` route; later stages pending |
| No product side effects | Scope explicitly forbids GitHub/production/PWA-storage writes. | `VERIFIED` intent; final command review required |
| Public runtime proof | The target public URL must be observed with a cache-buster and tied to current `main` deploy. | `VERIFIED` before plan; retained in evidence artifacts |
| Installed PWA state | A clean browser cannot inspect the user's installed profile. | `UNVERIFIED` by design |
| Native/Desktop release parity | GitHub Pages does not publish Android, iOS, or Tauri. | `UNVERIFIED` unless separate release receipts are inspected |

Post-design re-check: no design asks to bypass a binding gate, alter architecture, or make a release decision from the proposed constitution.

## Research and Design Plan

### Phase 0 — Evidence Research

1. Establish each relevant repository root, linked-worktree mapping, lock, branch, `HEAD`, and dirty state.
2. Compare the pending-batch branch to `origin/main`; inspect PR #64/#65 merger facts and final path distribution.
3. Match `origin/main` to the latest `deploy.yml` action, its `deploy` job, and the GitHub Pages deployment receipt.
4. Observe the public URL with a cache-busting query and record the active document title, route, bundle identity, and user-visible settings labels.
5. Read both update layers: `src/lib/versionCheck.ts` for the in-app durable-write-aware reload and `vite-plugin-version.ts` for the generated early-bootstrap mismatch path.

### Phase 1 — Diagnostic Design

1. Model four distinct entities: workspace lane, change lineage, web deployment receipt, and private client freshness state.
2. Define a read-only evidence contract that distinguishes `VERIFIED`, `UNVERIFIED`, and `N/A` claims.
3. Define an operator quickstart that opens the correct single-root VS Code workspace and uses the built-in PWA update check before any manual destructive browser action, while disclosing the bootstrap's existing automatic cache/SW cleanup on mismatch.
4. Add a complete platform/domain matrix, explicitly withholding Android, iOS, Desktop/Tauri, and personal-PWA claims without their own receipts.

## Project Structure

### Documentation (this feature)

```text
specs/20260804-000837-agent-pwa-visibility-audit/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── visibility-evidence-contract.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Existing Source and Operations Surfaces Inspected

```text
.github/workflows/deploy.yml                     # deploy only from push to main
docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md         # isolated worktree and VS Code root rule
docs/CROSS_PLATFORM_RELEASE.md                   # Web/PWA vs native/Tauri release channels
src/lib/versionCheck.ts                           # cache-busted, write-safe PWA update path
src/main.tsx                                     # SW activation and resume freshness flow
src/sw.ts                                        # Workbox worker and current cache behavior
vite.config.ts                                   # PWA and default-disabled ceremony build flag
vite-plugin-version.ts                           # generated early version-check behavior
```

**Structure Decision**: This analysis changes only the feature packet in this isolated audit lane. It does not modify the existing product, deployment, native, or service-worker paths above.

## Complexity Tracking

No implementation architecture is introduced. The only generated files are audit documentation required by the selected Spec Kit lifecycle.
