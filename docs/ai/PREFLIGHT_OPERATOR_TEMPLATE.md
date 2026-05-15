# Pre-Flight Operator Template

Use this when you want a compact, reusable version of the pre-flight discipline from [Law 23](../law23-philosopher.md) and [Law 28](../law28-alchemist.md) without re-reading the full law text every time.

This template keeps the user's original 4-question core:
- implicit requirements
- systemic impact
- failure modes
- step-by-step plan

It also adds the missing fields that make the protocol safe in real repo work:
- request transmutation so we solve the actual need, not just the literal words
- user-centric adjacency scan so a visible symptom triggers checks of the next/previous user states, not only the selected pixel
- goal + success criterion so we can detect drift
- checks completed so the validator can tell whether the pass was actually deep enough
- evidence snapshot so claims are grounded
- diagnostic sources + root-cause hypothesis so audits and fixes do not stop at symptoms
- visual audit matrix for UI-touching work so "looks fine" becomes a real checklist
- scope boundaries so "helpful" expansion does not become hallucinated scope
- verification + rollback so the plan is testable and reversible
- confidence + unknowns so low-certainty work stops early instead of shipping bugs
- explicit `GO / STOP / ASK` verdict so the gate can actually close

## Non-Negotiables

- No implementation code, file edits, or task execution until the visible `PRE-FLIGHT ARTIFACT` reaches `VERDICT: GO`
- Do not expose or require raw hidden chain-of-thought. The artifact is a concise, evidence-backed decision record, not private reasoning transcript.
- Every PASS must include evidence: command output, file path, or test checklist
- No evidence = FAIL
- No verification method = FAIL
- No verdict = FAIL
- UI-touching PASS requires visual proof: screenshot diff, browser trace, inspector output, or a manual viewport/state checklist tied to files or commands
- If any irreversible or hard-to-reverse action is involved, default to `ASK`

## Default Depth For ZenFlow

This repo is large, stateful, and cross-platform. Because of that, "always think at all levels" should mean "always use the right depth", not "always dump the maximum possible text."

- `L1` is only for typo-level, text-only, no-behavior changes that do not alter executable code, prompts, config, hooks, CI behavior, or architecture.
- `L2` is the default minimum for any repo-touching task.
- `L3` is the default for cross-platform UI, stores, Dexie/IndexedDB, Supabase/Firebase, sync, auth, navigation, build/CI, hooks, prompts, skills, configs, or 4+ files.
- `L4` is the default for laws, architecture, orchestration, agent prompts, enforcement gates, or any change that alters how future work is performed.
- User-facing work must be planned several steps ahead across Web, iOS, Android, desktop, phone, light/dark/OLED, RTL/i18n, accessibility, motion comfort, and adjacent empty/filled/error states. A fix that only satisfies the selected browser node but breaks a neighboring platform/state is not a valid pass.

## Mandatory Runtime Contract For L3/L4 Work

For any performance, startup, sync, navigation, service worker, WebGL/canvas,
canonical orb, IndexedDB/Dexie, Supabase, offline queue, app lifecycle, or
cross-platform user-flow work, read
[TELEGRAM_GRADE_RUNTIME_CONTRACT.md](TELEGRAM_GRADE_RUNTIME_CONTRACT.md)
before planning.

This contract does not replace this pre-flight template. It adds the runtime
invariants that future agents must preserve:

- first paint before non-critical work
- no main-thread freezes hidden by static-only review
- canonical `ValenceOrb` / `MiniValenceOrb` visuals only
- ordered sync through `sync_events.seq`
- tombstones over stale snapshots
- public URL proof for public-user claims
- phone, desktop, PWA, Android, iOS, sidebar, and drawer parity where applicable

If a task touches runtime behavior and the artifact does not cite the runtime
contract, the pre-flight is incomplete.

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
- visible evidence-backed self-reflection is the deliverable; raw hidden chain-of-thought is not
- self-reflection alone is insufficient
- factual, external, time-sensitive, or cross-platform claims require external evidence, tool checks, or both

## Visual Audit Defaults

Visual audit in this repo should be layered and evidence-backed, not taste-based:

- Local repo standards come first: [docs/visual-aesthetic.md](../visual-aesthetic.md) defines the intended UX bar, and [scripts/check-visual-guards.ts](../../scripts/check-visual-guards.ts) captures mechanical visual regressions already enforced in CI.
- W3C WCAG 2.2 should be the baseline for focus, reflow, and target sizing, not just text contrast: [WCAG 2.2 overview](https://www.w3.org/TR/WCAG22/), [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), [Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html).
- Apple guidance is important because this repo ships cross-platform UI: motion should be purposeful and optional, accessibility testing should cover Reduce Motion and Larger Text, and touch targets should reach at least 44x44 pt. Sources: [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Performing accessibility testing for your app](https://developer.apple.com/documentation/accessibility/performing-accessibility-testing-for-your-app), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [UI Design Dos and Don’ts](https://developer.apple.com/design/tips/).
- Android guidance complements that baseline: touch targets should reach at least 48dp, adaptive layouts must be checked across device classes, and keyboard/focus visibility matters on larger-screen and desktop-like setups. Sources: [Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/apps), [API defaults](https://developer.android.com/develop/ui/compose/accessibility/api-defaults), [Adaptive optimized tier](https://developer.android.com/docs/quality-guidelines/adaptive-app-quality/tier-2).
- Browser preference signals are part of visual quality, not an optional extra: reduced motion, contrast, forced colors, and transparency preferences can change whether a UI is actually usable. Sources: [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [Using media queries for accessibility](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries_for_accessibility), [forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/forced-colors), [prefers-reduced-transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/%40media/prefers-reduced-transparency), [backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter).
- Functional UI tests are not enough to prove visual correctness. Visual changes need screenshot or trace evidence because hidden, obscured, clipped, or layered bugs can pass logic-only tests. Sources: [Playwright visual comparisons](https://playwright.dev/docs/next/test-snapshots), [Playwright trace viewer](https://playwright.dev/docs/trace-viewer), [Chromatic visual testing](https://www.chromatic.com/docs/visual/).

## Incident-Derived Runtime Truth Gates

These gates exist because repeated regressions in this repo were not caused by
one bad line of code. They came from stale public deploys, cache/service-worker
state, phone/desktop drift, late renderer swaps, and V1/V2 state ownership gaps.

- Public-user claims require public-user proof. A local dev server, local preview,
  or green unit test is not enough when the user reports a production URL. Verify
  the deployed asset/hash or GitHub Pages run, then open the public URL with a
  cache-buster and service workers disabled when possible.
- CI success must include the deploy job, not only test or visual jobs. A previous
  deploy failure can leave GitHub Pages serving an older artifact while the branch
  head looks fixed locally. Inspect the newest deploy workflow and the first
  failing step before assuming the site is current.
- Cross-platform UI means at minimum phone viewport and desktop viewport for the
  touched route. If V1 and V2 share a visual primitive, verify both shells or state
  explicitly why one is out of scope.
- Motion/canvas/WebGL work needs lifecycle evidence. For orbit, shader, canvas, or
  animation fixes, include a stability check that the visible renderer is not
  silently replaced after the first stable frame unless that replacement is the
  intentional behavior being tested.
- Stateful V1/V2 work needs a round-trip check. If a user action changes durable
  data, verify the action from the source surface, navigate to the adjacent surface,
  and confirm the latest action wins after hydration, broadcast, and any remote
  delta application settles.
- Memory and self-reflection are not proof. Treat memory as routing context, then
  re-check drift-prone facts with repo files, current command output, browser
  evidence, CI logs, or official documentation.

## Agent-Wide Inheritance

This template is not just for the main coordinator.

- Every coordinator, researcher, reviewer, and memory-keeper pass inherits the same evidence discipline.
- Child agents may narrow scope, but they may not weaken the pre-flight bar.
- UI-touching specialists may narrow scope, but they may not skip the visual audit matrix, device/state coverage, or proof requirements.
- When the user reports a UI or product-logic mismatch, every agent must check the adjacent user flow states that make the fix believable: before/after, empty/filled, compact/expanded, long text, target sizing, and the primary action path.
- The coordinator is responsible for rejecting work that lacks evidence, platform impact analysis, or a clear `GO / STOP / ASK` verdict.
- The coordinator must reject prompts or worker instructions that demand raw hidden chain-of-thought; convert them into a visible `PRE-FLIGHT ARTIFACT`.
- The reviewer must check the original failure modes, the final platform/domain coverage, and any required visual audit coverage, not just the patch diff.

## Allowed Before The Pre-Flight Artifact

Only grounding work is allowed before the artifact, and every item must be cited inside it:
- required architecture reads such as `ARCHITECTURE.md`
- file discovery via `rg`, `find`, or direct read commands
- official docs or authoritative sources for time-sensitive external facts
- protocol prerequisites such as Android-first checks for user-facing work

These are not implementation steps. They are reality checks that keep the pre-flight honest.

## Ready-To-Use Template

```text
PRE-FLIGHT ARTIFACT

DEPTH:
- Chosen depth:
- Why not shallower:
- Checks completed:

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
- [CHECK: command -> output] Fresh command or test evidence
- [MCP: tool -> result] External or system verification, if applicable
- [WEB: url] Primary or official external source, if applicable
- [PERF: route -> max long task / max long animation frame] Runtime budget evidence, if applicable
- [SYNC: action -> event/apply/convergence proof] Ordered-sync evidence, if applicable
- [VISUAL: viewport/state -> screenshot or trace] Visual proof, if applicable
- [PUBLIC: URL/build/deploy -> cache-busted proof] Public-user proof, if applicable
- [ASSUMED] Anything not yet verified

1. IMPLICIT REQUIREMENTS
- Missing constraints, dependencies, and hidden expectations:
- What I am inferring:
- How each gap will be handled:

2. ROOT CAUSE + DIAGNOSTIC SOURCES
- Symptom vs likely root cause:
- 5 Whys / root-cause hypothesis:
- diagnostic_sources[] across logic / state / ui / infra / test / pattern-search:
- Why this source set is MECE enough:

3. SYSTEMIC IMPACT
- Files, modules, hooks, stores, schemas, CI, or global state affected:
- Cross-platform or user-flow risks:
- Invariants that must not break:

4. PLATFORM + DOMAIN MATRIX
- Platforms checked: Web / iOS / Android / Desktop / CI
- Domains checked: UI / state / storage / sync / auth / i18n / analytics / performance / accessibility / security
- Why each touched platform/domain is safe, risky, or N/A:
- Runtime contract read: yes/no/N/A
- Route budget evidence:
- Sync convergence evidence:
- Public deploy evidence:

5. VISUAL AUDIT MATRIX (required for UI / motion / layout / style / accessibility work)
- Repo baselines read:
- Layers checked: hierarchy & spacing / readability / contrast & non-text contrast / focus visibility & not obscured / touch targets & hit regions / responsive reflow / motion & reduced-motion / transparency & blur fallbacks / logical DOM order vs visual/focus order / safe areas / z-layer overlap
- States checked: default / hover / focus / pressed / disabled / loading / empty / error / offline
- Devices or viewports to verify:
- Visual evidence plan:

6. FAILURE MODES
- Failure 1:
  Cause:
  Prevention in upcoming implementation:
  Proof I will collect:
- Failure 2:
  Cause:
  Prevention in upcoming implementation:
  Proof I will collect:

7. STEP-BY-STEP PLAN
1. [Action]
   Source:
   Verify:
   Rollback:
2. [Action]
   Source:
   Verify:
   Rollback:

8. SCOPE BOUNDARIES
- In scope:
- Out of scope:
- What I am intentionally NOT changing:

9. ANTI-PATTERNS CHECKED
- Applicable laws / anti-patterns:
- Violations ruled out:
- Remaining risk:

10. DEPENDENCIES AND UNKNOWNS
- Verified dependencies:
- Unknowns still requiring proof:
- Blockers that would force STOP or ASK:

11. POST-VERIFICATION PLAN
- Commands:
- Manual checks:
- Evidence I expect to collect:

12. CONFIDENCE CALIBRATION
- Codebase familiarity:
- Change scope:
- Regression risk:
- Platform coverage:
- State integrity:
- Overall confidence:

13. VERDICT
- GO / STOP / ASK:
- Reason:
- Immediate next action:
```

## Pass / Fail Rubric

Mark the pre-flight `FAIL` if any of these are true:
- more than 30% of the evidence is `[ASSUMED]`
- affected files or APIs are referenced without proof from this session
- `checks_completed` is missing or clearly inconsistent with the actual depth of analysis
- audit or fix work has no root-cause hypothesis or no multi-dimensional `diagnostic_sources`
- failure modes are generic and not tied to the actual change
- platform/domain impact is skipped on a user-facing, stateful, or cross-platform change
- UI-touching work skips the visual audit matrix, state coverage, or device/viewport coverage
- anti-patterns or applicable laws are ignored without explanation
- the plan has no `Verify` step
- the run has no explicit post-verification plan
- UI-touching work has no visual proof plan such as screenshots, traces, inspector output, `check:visual`, or a concrete manual checklist
- the plan touches more scope than the goal requires and does not justify it
- confidence is low but the verdict is still `GO`

Mark the pre-flight `PASS` only when all of these are true:
- the atomic goal is concrete and observable
- `checks_completed` matches the actual number of meaningful checks performed
- the four core checks are complete and task-specific
- audit and fix work name a real root-cause hypothesis and diagnostic source set
- every important factual claim has evidence or is explicitly marked `[ASSUMED]`
- platform and domain coverage are explicit for touched areas
- UI-touching work includes explicit visual audit coverage and proof expectations
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
| Checks completed | `checks_completed` |
| Goal | `goal` |
| Request transmutation | `transmutation` |
| Evidence snapshot | `evidence.read`, `evidence.search`, `evidence.assumed` |
| Root cause + diagnostic sources | `pre_mortem`, `diagnostic_sources` |
| Platform + domain matrix | `confidence.platform_coverage` + `scope_boundaries` |
| Visual audit matrix | `diagnostic_sources`, `scope_boundaries`, `post_verification_plan` |
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
