# Clarifications: Agent Routing A/B/C Evaluation

**Feature**: [spec.md](./spec.md)  
**Resolved**: 2026-08-04

## Decisions

| Question | Decision | Why it is safe and testable |
| --- | --- | --- |
| What is the comparison unit? | One current, privacy-safe ZenFlow governance review task, frozen before the first arm. | The user asked whether roles, hooks, and rules are useful; a product task or synthetic catalog would answer a different question. |
| Which arms are compared? | `ROOT_ONLY`, evidence-first `TARGETED`, and `FIXED_FULL_TEN`, each exactly once in retained randomized order. | This mirrors the project protocol's routing alternatives and prevents a one-sided role-count claim. |
| Does an unavailable token counter stop the pilot? | No; it stops promotion or an efficiency conclusion. The pilot must record `UNAVAILABLE`. | The Codex host does not expose trusted billed-token accounting to this harness. Fabricating it would violate the evidence policy. |
| Can a visible-only local pilot select a permanent routing policy? | No. It may identify a task-specific observation only and remains `PILOT_NONPROMOTABLE` without a holdout, qualified review, and trusted runtime evidence. | The existing baseline explicitly says `NO_SEMANTIC_BASELINE`; the new tool cannot turn a structural result into semantic proof. |
| How are custom agent profiles represented? | The report records requested role IDs and observed outputs; custom-profile loading and effective sandbox permission remain `UNVERIFIED` unless an external runtime receipt proves them. | The current app tool boundary does not expose a trusted profile-loading receipt. |
| Where do arm outputs live? | Under ignored `output/agent-orchestra/`; the tracked report stores only hashes and non-sensitive metadata. | This keeps operational artifacts out of product/runtime/release data while retaining reviewable identities. |
| How is a winner selected? | There is no numeric winner or majority vote. A promotion is valid only when strict prerequisites hold; otherwise the report lists non-promotion reasons and per-arm observations. | Averages can hide critical misses and duplicate output. |

## Remaining Evidence Boundaries

- A local report cannot establish semantic quality, real-user value, or qualified-human acceptance.
- A role label in a collaboration run does not prove the host actually loaded the corresponding custom profile.
- The first user-authorized task slice is visible-pilot evidence, not an owner-controlled holdout.
- A hook can be structurally validated and timed locally, but actual desktop-host reliability still needs a trusted host receipt.
