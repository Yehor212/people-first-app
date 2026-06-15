# Skill Routing Agent Policy

This policy turns plugin and skill mentions into an explicit routing decision. It
does not require running every skill in a plugin. For Codex, that would fight the
official progressive-disclosure model and waste context on unrelated workflows.

## Source Evidence

- OpenAI Codex Skills are task-specific workflows. Codex starts with compact
  skill metadata and loads the full `SKILL.md` only after selecting a skill:
  https://developers.openai.com/codex/skills
- OpenAI Codex Plugins package skills, MCP servers, hooks, and apps. Plugins are
  distribution units; the agent still selects the relevant capability:
  https://developers.openai.com/codex/plugins/build
- OpenAI Codex Hooks can inject context on `UserPromptSubmit` and run command
  checks on `PreToolUse`; project-local hooks must be reviewed/trusted:
  https://developers.openai.com/codex/hooks
- Test-driven development starts from a test list and repeats red, green,
  refactor; use it when behavior can be specified before implementation:
  https://www.martinfowler.com/bliki/TestDrivenDevelopment.html
- Vitest is the default fast runner for Vite-aligned unit/component logic in
  this project:
  https://vitest.dev/guide/
- Testing Library's guiding principle is to test in ways that resemble user
  interaction, not component internals:
  https://testing-library.com/docs/
- Playwright's best-practice guidance is to verify user-visible behavior with
  isolated tests and web-first assertions:
  https://playwright.dev/docs/best-practices

## Routing Rule

When a user names a plugin, skill, or tool family, treat it as a routing signal:

1. Identify explicit mentions such as `@superpowers`, `@chrome`, `@browser`,
   `@openai-developers`, `$skill`, or `/skills`.
2. Select the smallest relevant skill set for the actual task.
3. Read every selected `SKILL.md` completely before acting.
4. State the order of use when multiple skills apply.
5. Name obvious skills not used and why they are not relevant.

Do not activate every skill inside a plugin just because the plugin was named.
Many plugins contain mutually conditional workflows, for example planning,
debugging, TDD, review, branch finishing, and skill writing.

## Development Testing Rule

For first-party behavior changes, start with the smallest useful test before
production code unless the change is purely generated assets, docs-only, or
impossible to specify without exploratory evidence.

Preferred order:

1. Write a short test list: happy path, edge cases, platform/i18n/a11y risks,
   security or privacy risks, and rollback signals.
2. Add one failing focused test for the behavior being changed.
3. Make the smallest production change that turns the test green.
4. Refactor only while the focused test stays green.
5. Add broader proof only where the focused test cannot see the risk:
   Playwright for real user flow, screenshot/visual facts for layout, native
   build/run for Capacitor/Tauri, and security scanner evidence for sensitive
   surfaces.
6. If a pre-code test is skipped, record why and mark the missing proof
   `UNVERIFIED`, not `PASS`.

Test selection:

- Pure logic, hooks, stores, schedulers, guards: Vitest unit tests.
- React UI behavior and accessibility contracts: Vitest with Testing Library.
- Entry flows, navigation, layout, cross-browser, and responsive regressions:
  Playwright with screenshots or structured facts.
- iOS/Android/Desktop wrapper behavior: native build/run smoke plus the
  closest web proof.
- Auth, sync, storage, privacy, permissions, external writes, or security
  changes: focused tests plus audit/scanner evidence.

## Superpowers Default Map

- Multi-step implementation or protected workflow: `superpowers:writing-plans`.
- Code change with behavior risk: `superpowers:test-driven-development`.
- Bug investigation: `superpowers:systematic-debugging`.
- End-of-work proof: `superpowers:verification-before-completion`.
- Review handoff: `superpowers:requesting-code-review` and
  `superpowers:receiving-code-review` only when review is part of the task.

## Browser, Chrome, And Computer Use

- Browser: use for local app routes, public runtime verification, screenshots,
  and deterministic browser checks.
- Chrome: use when the task depends on the user's existing Chrome state, logged
  in sessions, extensions, or tabs.
- Computer Use: use for real desktop UI interaction. Do not use it to automate
  Codex itself.

## Mechanical Gate

Codex registers `.codex/hooks/skill-router-gate.cjs` in `.codex/hooks.json`.

- `UserPromptSubmit` injects a routing checklist into the working context.
- `PreToolUse` guards protected edits for `apply_patch|Edit|Write|MultiEdit`.
- Guarded edits require either `.skill-routing-token` or
  `.preflight-token.skill_routing`.

Evidence shape:

```json
{
  "timestamp": "2026-06-15T12:00:00.000Z",
  "prompt_summary": "One sentence task summary",
  "explicit_plugins": ["Superpowers"],
  "selected_skills": ["superpowers:writing-plans"],
  "skipped_obvious": [
    {
      "name": "all other Superpowers skills",
      "reason": "not relevant to this task"
    }
  ],
  "decision": "Why this routing is enough for the task",
  "verification_plan": "Commands or browser checks to prove the work",
  "verdict": "GO"
}
```

The token is temporary and ignored by git.
