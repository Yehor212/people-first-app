# Pre-Flight Operator Template

Use this when you want a compact, reusable version of the pre-flight discipline from [Law 23](../law23-philosopher.md) and [Law 28](../law28-alchemist.md) without re-reading the full law text every time.

This template keeps the user's original 4-question core:
- implicit requirements
- systemic impact
- failure modes
- step-by-step plan

It also adds the missing fields that make the protocol safe in real repo work:
- request transmutation so we solve the actual need, not just the literal words
- goal + success criterion so we can detect drift
- evidence snapshot so claims are grounded
- scope boundaries so "helpful" expansion does not become hallucinated scope
- verification + rollback so the plan is testable and reversible
- confidence + unknowns so low-certainty work stops early instead of shipping bugs
- explicit `GO / STOP / ASK` verdict so the gate can actually close

## Non-Negotiables

- No implementation code, file edits, or task execution until the `<thinking>` block reaches `VERDICT: GO`
- Every PASS must include evidence: command output, file path, or test checklist
- No evidence = FAIL
- No verification method = FAIL
- No verdict = FAIL
- If any irreversible or hard-to-reverse action is involved, default to `ASK`

## Default Depth For ZenFlow

This repo is large, stateful, and cross-platform. Because of that, "always think at all levels" should mean "always use the right depth", not "always dump the maximum possible text."

- `L1` is only for typo-level, text-only, no-behavior changes that do not alter executable code, prompts, config, hooks, CI behavior, or architecture.
- `L2` is the default minimum for any repo-touching task.
- `L3` is the default for cross-platform UI, stores, Dexie/IndexedDB, Supabase/Firebase, sync, auth, navigation, build/CI, hooks, prompts, skills, configs, or 4+ files.
- `L4` is the default for laws, architecture, orchestration, agent prompts, enforcement gates, or any change that alters how future work is performed.

## Research-Backed Defaults

These defaults are not arbitrary. They are shaped by primary-source research:

- Planning before execution helps reduce missing-step failures and semantic drift: [Plan-and-Solve Prompting](https://arxiv.org/abs/2305.04091).
- Structured metacognition improves understanding better than one-pass prompting: [Metacognitive Prompting](https://aclanthology.org/2024.naacl-long.106/).
- Iterative refinement can help, but only when feedback is explicit and actionable: [Self-Refine](https://arxiv.org/abs/2303.17651), [Reflexion](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html).
- Intrinsic self-correction alone is not reliable enough for high-confidence execution; external feedback and tools matter: [Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798), [CRITIC](https://arxiv.org/abs/2305.11738), [Chain-of-Verification](https://aclanthology.org/2024.findings-acl.212.pdf).
- Multi-perspective reflection helps more than single-track self-critique on knowledge-rich tasks: [Mirror](https://arxiv.org/abs/2402.14963).
- Confidence should be explicit, calibrated, and evidence-backed rather than intuitive: [Language Models (Mostly) Know What They Know](https://arxiv.org/abs/2207.05221), [Calibration-Tuning](https://aclanthology.org/anthology-files/pdf/uncertainlp/2024.uncertainlp-1.1.pdf).

Practical conclusion:
- self-reflection is required
- self-reflection alone is insufficient
- factual, external, time-sensitive, or cross-platform claims require external evidence, tool checks, or both

## Agent-Wide Inheritance

This template is not just for the main coordinator.

- Every coordinator, researcher, reviewer, and memory-keeper pass inherits the same evidence discipline.
- Child agents may narrow scope, but they may not weaken the pre-flight bar.
- The coordinator is responsible for rejecting work that lacks evidence, platform impact analysis, or a clear `GO / STOP / ASK` verdict.
- The reviewer must check the original failure modes and the final platform/domain coverage, not just the patch diff.

## Allowed Before The `<thinking>` Block

Only grounding work is allowed before the block, and every item must be cited inside it:
- required architecture reads such as `ARCHITECTURE.md`
- file discovery via `rg`, `find`, or direct read commands
- official docs or authoritative sources for time-sensitive external facts
- protocol prerequisites such as Android-first checks for user-facing work

These are not implementation steps. They are reality checks that keep the pre-flight honest.

## Ready-To-Use Template

```xml
<thinking>
DEPTH:
- Chosen depth:
- Why not shallower:

REQUEST TRANSMUTATION:
- Raw request:
- Interpreted outcome:
- Missing but necessary outcomes I will include:

GOAL:
- Atomic goal:
- Success criterion:

EVIDENCE SNAPSHOT:
- [READ: path/file.ext:line] What I verified directly
- [SEARCH: pattern -> result] What I found this session
- [MCP: tool -> result] External or system verification, if applicable
- [WEB: url] Primary or official external source, if applicable
- [ASSUMED] Anything not yet verified

1. IMPLICIT REQUIREMENTS
- Missing constraints, dependencies, and hidden expectations:
- What I am inferring:
- How each gap will be handled:

2. SYSTEMIC IMPACT
- Files, modules, hooks, stores, schemas, CI, or global state affected:
- Cross-platform or user-flow risks:
- Invariants that must not break:

3. PLATFORM + DOMAIN MATRIX
- Platforms checked: Web / iOS / Android / Desktop / CI
- Domains checked: UI / state / storage / sync / auth / i18n / analytics / performance / accessibility / security
- Why each touched platform/domain is safe, risky, or N/A:

4. FAILURE MODES
- Failure 1:
  Cause:
  Prevention in upcoming implementation:
  Proof I will collect:
- Failure 2:
  Cause:
  Prevention in upcoming implementation:
  Proof I will collect:

5. STEP-BY-STEP PLAN
1. [Action]
   Source:
   Verify:
   Rollback:
2. [Action]
   Source:
   Verify:
   Rollback:

6. SCOPE BOUNDARIES
- In scope:
- Out of scope:
- What I am intentionally NOT changing:

7. ANTI-PATTERNS CHECKED
- Applicable laws / anti-patterns:
- Violations ruled out:
- Remaining risk:

8. DEPENDENCIES AND UNKNOWNS
- Verified dependencies:
- Unknowns still requiring proof:
- Blockers that would force STOP or ASK:

9. POST-VERIFICATION PLAN
- Commands:
- Manual checks:
- Evidence I expect to collect:

10. CONFIDENCE CALIBRATION
- Codebase familiarity:
- Change scope:
- Regression risk:
- Platform coverage:
- State integrity:
- Overall confidence:

11. VERDICT
- GO / STOP / ASK:
- Reason:
- Immediate next action:
</thinking>
```

## Pass / Fail Rubric

Mark the pre-flight `FAIL` if any of these are true:
- more than 30% of the evidence is `[ASSUMED]`
- affected files or APIs are referenced without proof from this session
- failure modes are generic and not tied to the actual change
- platform/domain impact is skipped on a user-facing, stateful, or cross-platform change
- anti-patterns or applicable laws are ignored without explanation
- the plan has no `Verify` step
- the run has no explicit post-verification plan
- the plan touches more scope than the goal requires and does not justify it
- confidence is low but the verdict is still `GO`

Mark the pre-flight `PASS` only when all of these are true:
- the atomic goal is concrete and observable
- the four core checks are complete and task-specific
- every important factual claim has evidence or is explicitly marked `[ASSUMED]`
- platform and domain coverage are explicit for touched areas
- each plan step says how success will be proved
- anti-patterns and laws were actively scanned
- scope boundaries are explicit
- unknowns are named rather than hidden
- the final proof plan is concrete, fresh, and executable
- the verdict is written and justified

## Token Alignment

If this work also needs a `.preflight-token`, map the block to the validator fields in `.claude/hooks/preflight-validate.cjs`:

| Template area | Token field |
| --- | --- |
| Depth | `depth` |
| Goal | `goal` |
| Request transmutation | `transmutation` |
| Evidence snapshot | `evidence.read`, `evidence.search`, `evidence.assumed` |
| Platform + domain matrix | `confidence.platform_coverage` + `scope_boundaries` |
| Failure modes | `pre_mortem` |
| Scope boundaries | `scope_boundaries` |
| Anti-patterns checked | `anti_patterns_checked` |
| Verification / rollback | `post_verification_plan` |
| Confidence calibration | `confidence`, `overall_score` |
| Unknowns | `unknowns` |
| Verdict | `verdict` |

## Why This Template Exists

The full law text is intentionally deep and philosophical. This file is the operator-grade version:
- fast enough for real work
- strong enough to catch hallucinated scope
- strict enough for a large cross-platform repo
- explicit enough to produce evidence
- compatible with the existing pre-flight validator and repo laws
