# Ten-Lens Evidence Assurance v2.2.1 + E1 implementation plan

> Status: superseded in routing details by the owner-approved evidence-first adaptive amendment of 2026-07-21. Promotion and superiority remain out of scope until paired evidence exists.

## Objective and truth boundary

Implement the smallest executable extension of the existing persistent-agent orchestra that:

- preserves exactly ten stable role identities and the canonical registry/generator ownership;
- gives Role 2 separate `CREATE_BRIEF` and `INDEPENDENT_FINAL_REVIEW` phases without granting clinical, accessibility, locale, cultural, legal, or human-acceptance authority;
- represents E1 decision, assurance, execution, closure, risk, and authority state without conflating them;
- uses deterministic routing, hashing, aggregation, and dependency invalidation to avoid repeated model work;
- records only exposed usage fields and uses `UNAVAILABLE` instead of estimates;
- fixes the observed Free RAG `v2.2.1` → `ui_v2` false route;
- uses malformed structural objects only as isolated validator negative controls, never as product, user, human, runtime, or superiority evidence.

The implementation status may be `CANDIDATE_IMPLEMENTED_SUPERIORITY_UNVERIFIED`. It must not claim that the agent understands user feelings, that users prefer the candidate, or that token/cost reduction is proven.

## Evidence-backed design choice

Chosen: extend `config/persistent-agent-orchestra.json`, its generator, and the existing strict local eval boundary with one focused assurance kernel.

Rejected alternatives:

1. Prompt-only Role 2 expansion. It cannot enforce E1 state separation, replay linkage, invalidation, usage accounting, or deterministic aggregation.
2. A second greenfield orchestrator. It would duplicate the canonical registry and increase drift, prompt bytes, and protected-surface risk.
3. Model downgrade or fewer lenses. Neither has role-specific non-inferiority evidence and both violate the supplied contract.

## Explicit and implied requirements

- Apply the master contract whose SHA-256 is `de23c3ff413e14535bef3f05a9be0a8b9f5448b2f16c3db524722070fccfcc42` plus E1 precedence.
- Expand psychologist participation before and after implementation.
- Reduce avoidable context/token use without lowering quality.
- Use primary/official-source research.
- Do not use mock product, user, human, runtime, release, or superiority data.
- Preserve Role 4 ownership of WCAG/AT/readability/i18n/RTL/culture and Role 9 ownership of local product failure/value/craft.
- Keep raw sensitive content out of receipts, Git artifacts, logs, and test fixtures.
- Keep application runtime, Zustand, Dexie, Supabase, sync, native code, and production data unchanged.
- Treat E1's `COMPLETE_WITH_ACCEPTED_RISK` wording as a non-canonical synonym only; the explicit E1 precedence returns `AUTHORIZED_WITH_ACCEPTED_RISK`.

## Platform matrix

| Surface | Planned impact | Proof boundary |
| --- | --- | --- |
| Web/PWA | No application code change | Product/runtime behavior `UNVERIFIED` |
| Android | No native code change | Device/store behavior `UNVERIFIED` |
| iOS/WKWebView | No native code change | Device/store behavior `UNVERIFIED` |
| Desktop/Tauri | No application code change | Desktop runtime `UNVERIFIED` |
| Accessibility | Role boundary and evidence schema only | Conformance/lived usability `UNVERIFIED` |
| Locales/RTL | Role boundary and evidence schema only | Native/cultural acceptance `UNVERIFIED` |
| Security/privacy | Strict schemas, authority, replay/retention contracts | Effective sandbox/host retention `UNVERIFIED` |
| Performance/cost | Generated-byte and usage-ledger instrumentation | Actual token/cost savings `UNVERIFIED` |
| Operations/release | Rollback/promotion states | Deployment/release readiness `UNVERIFIED` |

## Preregistered candidate gates

Structural gate, not a token claim:

- preserve every current semantic invariant and hard stop;
- reduce total generated profile bytes by at least 8% from the measured baseline of 172,099 bytes;
- keep exact-ten identities, generated hashes, and source reverse mappings valid;
- do not increase max depth or concurrency;
- require evidence-backed consideration of all ten roles, adaptive matched-owner M1/M2 phases, explicit deep-audit full council, and a legacy exact-20 M1/M2 `FIXED_FULL_TEN` rollback while M0 remains deterministic, without treating budget exhaustion as a pass.

Future promotion additionally requires no candidate-only critical miss, false pass, dropped finding, or cross-role closure; frozen real ZenFlow cases with leakage quarantine and human-calibrated adjudication; byte-equivalent subject snapshots and matched execution conditions; exposed usage telemetry; and preregistered non-inferiority/meaningful-efficiency thresholds set after a baseline pilot.

## Write set and TDD

Write only the canonical registry, focused assurance/RAG scripts and tests, package scripts, generated profiles/reference, and a versioned operations mapping. Do not touch product source, storage/sync/auth, native code, dependencies, CI enforcement, deployment, or production.

1. Add focused contract tests and capture RED.
2. Add a fresh `.preflight-token` with the exact RED evidence and skill routing.
3. Implement the assurance kernel and registry contracts.
4. Regenerate managed artifacts through `npm run ai:agent-orchestra:sync`.
5. Run focused green plus orchestra/eval/context/governance/PDI/no-template/best-practices/type/lint/count/constitution checks.
6. Run security tooling and final-delta reviews. Subagent reports remain evidence to recheck, not proof.

## Rollback

The candidate is isolated on `codex/ten-lens-assurance-v2-2-1`. Rollback is a normal branch discard or revert followed by regeneration from the prior canonical registry. There are no migrations, production records, external writes, deploys, pushes, or user-data transformations.
