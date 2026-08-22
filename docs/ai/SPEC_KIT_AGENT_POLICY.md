# ZenFlow Spec Kit Agent Policy

Purpose: bind the official GitHub Spec Kit workflow to ZenFlow's real architecture, evidence rules, and side-effect boundaries without modifying the upstream-managed skills. This is an agent-governance policy, not product runtime code.

## Authority And Scope

When instructions conflict, agents follow system/developer instructions, the nearest `AGENTS.md`, and this policy before the managed `.agents/skills/speckit-*` text. Generated skills are workflow inputs, not an authority to weaken ZenFlow policy, invent evidence, or perform external actions.

The installed payload is official Spec Kit v0.15.1 with the Codex integration and `sh` scripts. `.specify/integrations/codex.manifest.json` is the managed-skill hash source. Do not hand-edit those skills to customize ZenFlow; an official upgrade must remain detectable by `specify integration status`.

This policy applies to every Spec Kit artifact and route. It does not claim that an untrusted client, disabled project hook, dynamic shell program, hosted connector, or model will obey it; those paths remain `UNVERIFIED` until directly tested.

## Workflow Routing

- Nontrivial features and system changes use `$speckit-specify` -> `$speckit-clarify` -> `$speckit-plan` -> `$speckit-checklist` -> `$speckit-tasks` -> `$speckit-analyze` -> explicitly authorized `$speckit-implement` -> `$speckit-converge`.
- Small local fixes use the compact test-first path from `AGENTS.md`; they do not create feature artifacts merely to satisfy process.
- Protected or high-risk work uses the full route plus explicit rollback, the complete platform/domain matrix, and fresh evidence or `UNVERIFIED` rows. M2 class metadata does not authorize physical subagent invocation.
- `$speckit-constitution` is a separate governance action. `$speckit-taskstoissues` is a separate external write and requires explicit user instruction plus a verified repository/target.
- Spec Kit chooses no specialist count and does not authorize delegation. Default execution remains SOLO. The repository installs no persistent orchestra; a direct current-user request may separately authorize the smallest useful built-in delegation set.

## Constitution Status Gate

Before any lifecycle skill reads or applies constitution criteria, run:

```sh
.specify/scripts/bash/check-zenflow-constitution-status.sh --json
```

The current constitution is `PROPOSED` and unratified. Until a real human ratification record activates it:

- A finding derived only from the proposal is `PROPOSED_CONSTITUTION_CONSIDERATION`.
- It cannot be `CRITICAL`, block implementation, authorize remediation, or make a release decision.
- `$speckit-converge` must not add, remove, or reprioritize `tasks.md` from a proposal-only finding; verify `tasks.md` is byte-identical for that negative control.
- If the same problem independently violates an active `AGENTS.md` rule, test, security boundary, or user requirement, cite that binding source and classify it from that source—not from the proposal.
- Missing, malformed, ambiguous, or contradictory status output is `STOP`; never guess that the constitution is active.

Ratification is a human governance decision. An agent may draft changes and evidence but cannot set `ratified`, `binding`, `blocking_authority`, or `critical_remediation_authority` to true on its own.

## Sparse Intent Expansion

A short user request is an outcome signal, not permission to copy a generic feature pattern. Before writing the spec, inspect the current route, component owner, state owner, interaction pattern, tests, and platform contracts. Name the concrete user failure mode and preserve the user's words as the explicit requirement.

Industry standards and common patterns must not fill missing product decisions. Use an official/current source only when its applicability to the inspected ZenFlow surface is explained. Otherwise record the choice as `UNVERIFIED` or ask one genuinely blocking product question. Do not fabricate satisfaction, adoption, clinical, artistic, production, or human-review evidence.

Every nontrivial spec separates:

1. Explicit requirements from the user's request.
2. Evidence-backed implied requirements that are safe, reversible, and inside scope.
3. Product-defining decisions that need the user.
4. Non-goals and rejection/kill criteria.
5. Current file/route/state evidence and its freshness.
6. Acceptance evidence and an `UNVERIFIED` ledger.

## UI And Motion Completion Contract

For animation or visual-motion requests, the spec must reason from the actual trigger and user task instead of automatically placing an effect in the center of the screen.

- Placement: identify the initiating control, attention target, overlay owner, safe areas, keyboard, and mobile/desktop geometry. ZenFlow modals route through `ModalLayer` and `OverlayLayer`; do not create a competing overlay path without evidence and approval.
- User value: state what uncertainty, delay, transition, or completion signal the motion resolves. Decoration alone is not a success criterion.
- Visibility and frequency: define entry/exit, first/repeat behavior, interruption cost, cancellation, rapid re-trigger, background/foreground, and app-resume behavior.
- Background dimming is conditional, not a default. Use it only when the interaction intentionally becomes modal and background interaction must pause; then specify focus ownership, pointer blocking, Escape, Android back, dismissal, and recovery. Reject dimming for ambient or inline feedback when it would steal attention or hide needed context.
- Accessibility: preserve the semantic outcome with reduced motion, keyboard/screen-reader focus order, at least 44 px targets where interactive, contrast, non-color cues, and no seizure/flash risk. Automated checks do not prove human comfort.
- Localization: cover all eight locales and check bidi/RTL placement and directionality for `ar` and `he`; do not concatenate translated fragments.
- Platforms: record Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri separately, including safe areas, native back, lifecycle suspension, input modality, and graceful fallback.
- Performance: define a measurable budget or current baseline for affected startup/frame/long-task/bundle behavior. Do not replace ZenFlow's frozen `ValenceOrb`/`MiniValenceOrb` craft with a cheaper approximation merely to make a metric green.
- Quality gates: report Technical, Visual Runtime, Artistic/Craft, Motion, Model, and Plan separately when applicable. Browser/build/tests cannot manufacture `ARTISTIC_PASS` or user acceptance.

## Lifecycle, Data, And Failure States

Specifications and plans cover creation, loading, success, empty/unavailable, partial/degraded, offline, retry, cancellation, duplicate/re-entry, background/resume, sync, deletion, recovery, rollback, and observability when those states apply.

IndexedDB/Dexie remains local truth and Zustand hydration follows the documented bridges. Production runtime must never substitute fake, demo, sample, canned, synthetic, or fallback business records when a source is unavailable. Isolated test fixtures and negative controls are allowed only in tests/tooling and never count as production or human evidence.

Security/privacy analysis names data provenance, retention, least privilege, secrets/PII boundaries, auth/sync effects, external destinations, and failure behavior. No Spec Kit artifact grants permission to read private logs/user content, write production data, migrate, deploy, install dependencies, change remote settings, or weaken a guard.

## Tasks And Evidence

For first-party behavior changes, tests are mandatory even if managed skill text says they are optional. `$speckit-tasks` must include the smallest red/characterization proof before implementation, the same green proof afterward, and blast-radius checks. UI claims add rendered/browser evidence; native, public, store, human, and artistic claims stay `UNVERIFIED` until freshly observed.

`$speckit-analyze` and `$speckit-converge` must preserve traceability from explicit/implied requirements through plan and tasks. A green structural check proves only its scope. Inherited failures remain `FAIL`; missing tools or skipped checks remain `UNVERIFIED` or `SKIP` with a reason, never `PASS`.

## Automatic And Explicit Behavior

When the project is trusted and the client supports repository hooks, `UserPromptSubmit` automatically injects a compact version of the constitution-status, grounding, and test-first priority. `PreToolUse` automatically denies supported direct writes and recognizable commands that mutate extension policy, constitution authority, or official managed skills. Trust-state validation also compares managed skills to the official Codex manifest.

The skills themselves do not run automatically. The full/compact/high-risk route, each `$speckit-*` command, implementation, issue creation, connector action, deployment, production write, and ratification remain explicit decisions. `.specify/extensions.yml` keeps optional extensions and automatic extension hooks disabled.

The hook is defense in depth. Complete shell parsing, dynamically generated commands, project-trust state, Windows/native execution, hosted tools, external clients, and universal model obedience remain `UNVERIFIED`. Post-tool drift detection cannot undo a completed side effect.

## Supported Maintenance

For a future official upgrade or integration switch:

1. Verify the latest stable official release/tag and tool provenance.
2. Use a clean isolated `codex/` branch and inventory every collision first.
3. Obtain explicit authorization for the exact version, integration, script type, and write set.
4. Update the preflight tests/expected manifest under review before allowing the exact supported `specify` maintenance command; never add a broad bypass or disable the guard silently.
5. Run the supported CLI command, review every changed path, refresh provenance/hashes, and restore the deny-by-default maintenance boundary in the same reviewable change.
6. Re-run integration status, extensions status, all governance/integrity/security checks, and fresh Codex discovery/activation.

## Verification Sources

- Project contracts: `AGENTS.md`, `ARCHITECTURE.md`, `docs/ai/TEST_FIRST_AGENT_POLICY.md`, `docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md`, `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md`, and `docs/ai/AGENT_CHANGE_GOVERNANCE.md`.
- Official Spec Kit v0.15.1 workflow: https://github.com/github/spec-kit/tree/v0.15.1
- OpenAI Codex project instructions, skills, and hooks: https://developers.openai.com/codex/guides/agents-md, https://developers.openai.com/codex/skills, and https://developers.openai.com/codex/hooks
- Accessibility basis: https://www.w3.org/TR/WCAG22/

These sources define applicability and verification paths; they do not prove the current app, devices, human response, or deployed runtime without fresh evidence.
