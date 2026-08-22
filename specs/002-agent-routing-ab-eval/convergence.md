# Convergence: Agent Routing A/B/C Evaluation

**Feature**: [spec.md](./spec.md)  
**Status**: `PILOT_COMPLETE_NONPROMOTABLE`

## Spec Kit lifecycle result

| Phase | Status | Evidence |
| --- | --- | --- |
| Specify | `VERIFIED` | [spec.md](./spec.md) defines scope, three arms, evidence limits, and all platform statuses. |
| Clarify | `VERIFIED` | [clarifications.md](./clarifications.md) resolves host-counter, custom-profile, output, and decision boundaries. |
| Plan/checklist/tasks | `VERIFIED` | [plan.md](./plan.md), [checklists](./checklists/requirements.md), and [tasks.md](./tasks.md) bind the implementation to current ZenFlow policies. |
| Analyze | `VERIFIED` | [analysis.md](./analysis.md) identifies the intended proof limits before implementation. |
| Implement | `VERIFIED` | Deterministic preparation/validation core, CLI, focused tests, and local receipt exist. |
| Controlled visible pilot | `VERIFIED` | [pilot summary](./evidence/pilot-summary.md) and the ignored hash-bound receipt record the three executed arms. |
| Role 10 Pass B | `STOP` | [closure ledger](./evidence/role10-closure.md) retains every Pass A category; runtime isolation and effective-permission proof are absent. |
| Promote a routing baseline | `STOP` | No holdout, trusted runtime/profile/cost receipt, qualified independent review, or semantic outcome adjudication. |

## Verification executed

- Focused Vitest contract: **10 passed**.
- `npm run test:agent-orchestra`: **424 passed** in 8 files; its chained isolated workspace suite also completed successfully.
- `node --check` for the new core and CLI: passed.
- `npm run ai:agent-orchestra:ab:prepare`: prepared a local receipt with retained randomized arm order.
- `npm run check:agent-orchestra:ab` on the completed receipt: local structure and all retained raw-output hashes valid; decision remained non-promotable for exact reported reasons.
- `npm run check:agent-orchestra`: passed for the exact ten structural profiles; runtime loading/effective permissions remained `UNVERIFIED`.
- `npm run check:agent-orchestra:eval`: passed for the 40-scenario catalog; semantic/runtime/human/user statuses remained `UNVERIFIED`.
- `npm run check:no-ai-templates`, `npm run check:agent-context`, and `npm run ai:context:check`: passed.
- Separate Role 8 closure rechecked the completed receipt SHA-256, validator, focused tests, and overclaim boundary: `GO_FOR_PROVEN_SCOPE`; it is not qualified-human review.
- Narrow local security-suite profile `ai` completed its available version checks for the new core. Snyk Agent Scan remained `UNVERIFIED` because `SNYK_TOKEN` was unavailable; the suite reported no supported Snyk-Code source for this `.mjs` path, and no model/prompt target existed for the other scanners.

## Decision

Keep the existing evidence-first targeted-routing policy. This pilot does **not** authorize
removing roles, weakening hooks/rules, changing timeout behavior, or claiming that all-ten
or targeted routing is generally superior. The observed 1/6/10 invocation counts alone
show only the cost surface in this host, not a quality/cost tradeoff.

## Required next evidence before promotion

1. An owner-controlled privacy-safe holdout task with the same frozen conditions.
2. Trusted runtime receipts for profile loading, effective permissions, and hook lifecycle delivery.
3. Trusted elapsed/cost/usage counters for every arm.
4. A qualified independent adjudication rubric that records critical misses and duplicate findings without majority-vote scoring.
5. Role 10 Pass B closure with a runtime isolation/context-manifest receipt; without it, the Pass A/B independence claim remains `UNVERIFIED`.

## Rollback

Revert this isolated branch to remove the harness and Spec Kit packet. The local ignored
pilot output can be retained for review or deleted only with explicit owner authorization;
it is not product or release data.
