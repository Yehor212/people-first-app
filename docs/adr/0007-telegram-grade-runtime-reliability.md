# ADR-0007 - Telegram-Grade Runtime Reliability

## Status

Accepted - 2026-05-14

## Context

ZenFlow now has several runtime-sensitive surfaces that share state and visual
primitives across V1, V2, web, PWA, Android, iOS, desktop, phone layout,
sidebar, and drawer.

Recent regressions were not isolated to one component. They came from systemic
gaps:

1. Performance fixes could improve one metric while changing the visible orb or
   animation quality.
2. Sync fixes could make one shell look correct while stale snapshots or another
   shell resurrected older state.
3. Local verification could pass while GitHub Pages, service worker state, or a
   desktop layout still served the old behavior.
4. Static review could miss long main-thread work, late renderer swaps, native
   lifecycle duplication, or multi-tab races.

The project already has two important contracts:

- `docs/ai/CANONICAL_ORB_INVARIANT.md` freezes the orb family.
- `docs/ai/SYNC_CONTRACT.md` defines Telegram-style ordered sync semantics.

What was missing was a single runtime contract tying performance, sync, visual
stability, deployment proof, and cross-platform evidence together before code
changes begin.

## Decision

ZenFlow adopts a Telegram-grade runtime reliability contract. Runtime-sensitive
work must preserve visual canon, prioritize first paint, move or defer heavy
work, apply state through ordered sync events, and prove behavior with route,
sync, visual, and platform evidence.

The tracked contract is `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`. Future
agents must read it before changing performance, startup, sync, navigation,
service workers, WebGL/canvas, canonical orbs, IndexedDB/Dexie, Supabase,
offline queue, app lifecycle, or cross-platform user flows.

## Alternatives Considered

### Keep performance rules inside individual task prompts

This is flexible, but it is not durable. Repeated regressions showed that local
task prompts are easy to miss, especially across future agents and branch
switches.

### Use visual downgrades to reduce blocking

This can make a route faster, but it violates the product canon. Canonical
`ValenceOrb` and `MiniValenceOrb` visuals are final unless a product-level
visual-system migration is explicitly approved.

### Rely on snapshot or backup sync as the main convergence path

Snapshots are useful for bootstrap and recovery, but they do not provide
Telegram-style ordering. `sync_events.seq` and durable tombstones must own
cross-device convergence.

### Accept static-only performance review

Static review can find likely hotspots, but it cannot prove Chrome long tasks,
late renderer swaps, service worker state, public deploy freshness, or native
resume behavior. Runtime evidence is required for runtime claims.

## Consequences

### Positive

- Future agents have one runtime source of truth before implementation.
- Performance work cannot silently weaken canonical visuals.
- Sync work inherits ordered-event and anti-resurrection rules.
- Public production claims require public production proof.
- Cross-platform parity becomes part of the definition of complete.

### Negative

- Small runtime changes require more verification than a narrow code diff.
- Some iOS or native claims may remain `UNVERIFIED` when tooling is unavailable.
- Browser performance gates can expose unrelated debt that must be triaged
  honestly instead of hidden.

### Neutral

- The contract links existing docs rather than replacing them.
- The first implementation phase after this ADR should be instrumentation and
  guardrails, then measured bottleneck fixes.

## Rollout / Migration Plan

1. Add `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`.
2. Link the contract from `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`.
3. Add runtime gates to `docs/DEFINITION_OF_DONE.md`.
4. Add platform runtime checks to `docs/RELEASE_CHECKLIST.md`.
5. Keep law docs and `docs/visual-aesthetic.md` unchanged.
6. Start the code phase with measurable guardrails: extend performance smoke
   coverage first, then handle sync ownership and bottleneck fixes based on
   measured risk.

Rollback is simple: revert this ADR and the documentation links. No runtime
code or schema is changed by this decision.

## Verification

The decision is working when:

- Future performance/sync/orb plans cite the runtime contract.
- `npm run check:canonical-orbs` remains mandatory for visual/orb-sensitive work.
- Performance claims include route metrics.
- Sync claims include convergence evidence.
- Public URL claims include deploy or cache-busted public proof.
- Cross-platform gaps are marked `UNVERIFIED` instead of overclaimed.

## References

- `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`
- `docs/ai/SYNC_CONTRACT.md`
- `docs/ai/CANONICAL_ORB_INVARIANT.md`
- `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`
- `scripts/smoke-chrome-performance.cjs`
- `scripts/check-canonical-orbs.mjs`
- Telegram TDLib architecture as the conceptual local-first, ordered-update
  model
- Chrome Long Tasks and Long Animation Frames documentation
