# Implementation Plan: Evidence-Bound Agent Routing A/B/C Pilot

**Spec Kit Feature ID**: `002-agent-routing-ab-eval`  
**Branch**: `codex/agent-routing-ab-eval`  
**Spec**: [spec.md](./spec.md)  
**Clarifications**: [clarifications.md](./clarifications.md)

## Summary

Add a small Node.js-only harness that prepares and validates an A/B/C agent-routing
receipt. It compares one coordinator, the smallest evidence-backed route, and the
fixed full-ten route against the same frozen privacy-safe governance task. The harness
is deliberately unable to declare a winner from missing token, runtime, human, or
holdout evidence. It does not change any ZenFlow application surface.

## Technical Context

| Area | Decision |
| --- | --- |
| Runtime | Node.js ESM under the repository's existing Vitest setup. |
| New source | `scripts/persistent-agent-orchestra/routing-ab-core.mjs` plus a narrow CLI runner. |
| Existing interfaces | Canonical role IDs come from the existing registry; SHA-256 and strict JSON patterns match `eval-core.mjs`. |
| Storage | Local ignored `output/agent-orchestra/` only; no IndexedDB, Supabase, sync queue, analytics, or remote write. |
| Dependencies | None added. |
| Verification | Focused red/green Vitest, CLI prepare/validate round trip, existing orchestra checks, policy checks, and diff/status review. |

## Constitution Status

`.specify/scripts/bash/check-zenflow-constitution-status.sh --json` reports
`PROPOSED`, `ratified=false`, and `blocking_authority=false`. The constitution is
therefore proposal-only input. Binding constraints remain `AGENTS.md` and the cited
ZenFlow policies.

## Design

1. `createPreparedRoutingAbReport` creates exactly three arms and retains a cryptographically shuffled execution order.
2. `validateRoutingAbReport` rejects malformed reports, mismatched frozen conditions, duplicate outputs, missing targeted dispositions, and incomplete full-ten execution.
3. The validator accepts literal `UNAVAILABLE` for pilot-only usage/runtime evidence but reports a non-promotion reason; `PROMOTABLE` then fails closed.
4. The CLI can prepare a local receipt from a privacy-safe task descriptor and validate a supplied report. It does not call models, edit roles/hooks, or transmit data.
5. A user-authorized visible task pilot records actual collaboration outputs separately; the tracked feature files retain the mechanism and decision boundaries, not private output text.

## Cross-Platform and Domain Matrix

| Surface | Impact | Verification |
| --- | --- | --- |
| Web/Vite | N/A | No `src/`, Vite, service-worker, or UI change. |
| Installed PWA | N/A | No manifest, cache, or install change. |
| Android/Capacitor | N/A | No `android/`, Capacitor, or native API change. |
| iOS/WKWebView | N/A | No `ios/`, safe-area, or WebView change. |
| Desktop/Tauri | N/A | No `src-tauri/`, Tauri config, or desktop runtime change. |
| Accessibility/i18n | N/A | No user-facing string or layout change. |
| Performance/operations | In scope | Capture local agent elapsed/retry/interruption observations without inferring product performance. |
| Security/privacy | In scope | Reject data outside the local operator receipt boundary; scan changed first-party JavaScript. |
| Agent governance | In scope | Validate routing evidence without altering role authority or hook behavior. |

## Rollback

Revert the isolated feature branch. Delete only its ignored local output receipt after
confirming it is not needed for review. No migration, remote branch, deployment, or
application data recovery is necessary.
