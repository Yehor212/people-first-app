# No AI Templates Agent Policy

Purpose: forbid generic AI-template work across ZenFlow agent workflows. This is an operator protocol, not application runtime code. It applies to Codex, Claude Code, Ruflow+, local subagents, connector-backed agents, and any future agent that follows this repository guidance.

## Source Evidence

This policy follows a layered-governance pattern rather than relying on a single instruction:

- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework - use governance, mapping, measurement, and management controls instead of one-off trust in model output.
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/ - treat LLM prompts, outputs, tool use, and supply-chain material as untrusted until verified.
- OpenAI Codex AGENTS.md guidance: https://developers.openai.com/codex/guides/agents-md - keep durable, repository-specific instructions where agents can discover them.
- GitHub protected branches and required checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches - use review and status-check backstops for protected work.
- GitHub pull request templates: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-issue-and-pull-request-templates - make review criteria visible at merge time.
- Google Engineering Practices on small CLs: https://google.github.io/eng-practices/review/developer/small-cls.html - keep changes reviewable, scoped, and easier to roll back.

## Definition

An AI template is any output that looks generated first and ZenFlow-specific second. It includes generic copy, placeholder implementation, stock layouts, shallow boilerplate, vague best-practice filler, fake completeness, and unverified artifacts that could be pasted into any unrelated app.

Forbidden examples:

- Placeholder text such as lorem ipsum, TODO-as-deliverable, TBD-as-deliverable, "coming soon", "AI-generated", "as an AI", or generic launch copy.
- Generic UI sections, card grids, dashboards, modals, onboarding, achievements, empty states, release notes, or docs that ignore the local product language, architecture, i18n, accessibility, platform, privacy, and verification contracts.
- Unadapted snippets copied from model output, tutorials, starter kits, third-party examples, or previous projects.
- Fake proof: claims that code, copy, audio, visuals, native behavior, security, or deployment are complete without current evidence.
- Shipped assets or prompts with missing provenance, license, source, QC, or rollback notes when those are relevant.

## Enforcement Layers

No single agent instruction can honestly prove that future agents will never attempt template output. ZenFlow therefore uses layered controls:

1. AGENTS.md is the routing layer and names this policy for all agents.
2. This policy is the review rubric for product copy, UI, docs, prompts, generated assets, release materials, plans, and agent governance.
3. Subagent prompts must include this policy and must return evidence, platform/domain impact, verification, unresolved risk, and GO / STOP / ASK.
4. The PR template makes reviewers explicitly check for no AI-template output.
5. `npm run check:no-ai-templates` is the local and CI-style drift guard.
6. `npm run check:agent-context` keeps this policy discoverable through the broader agent health check.
7. GitHub branch protection and required status checks should be enabled on the canonical repository before claiming merge-time enforcement as PASS.

## Required Agent Behavior

Agents must:

1. Read current project context before producing durable work.
2. Separate explicit user requirements from implied requirements before narrowing scope.
3. Use local patterns, theme tokens, storage helpers, i18n, accessibility rules, and platform contracts instead of generic defaults.
4. Make copy and UX specific to ZenFlow's actual feature, user state, and supported languages. For ar/he, treat RTL as a risk whenever layout or copy is touched.
5. Replace placeholders with real, reviewable content or mark the item UNVERIFIED with a concrete blocker.
6. Keep generated or assisted artifacts traceable: source, license/provenance, prompt/spec, checks run, and rollback path when applicable.
7. Ask or stop when a real product decision is missing; do not fill policy, brand, legal, privacy, medical, financial, or release decisions with model guesses.
8. Include this policy in subagent rubrics whenever delegating product, docs, copy, UI, release, agent-governance, or artifact review work.

## Allowed Use

The ban does not forbid using AI assistance. It forbids shipping AI-shaped artifacts. Agents may use AI to brainstorm, draft, transform, or analyze only when the final output is grounded in the repository, adapted to ZenFlow, reviewed against the relevant contracts, and verified with current evidence.

Templates, starter snippets, component examples, and generated drafts are allowed only as private scaffolding. Before they become project output, they must be rewritten into project-specific work with local names, local architecture, real copy, tests or checks, and explicit evidence.

## Review Checklist

Before finalizing agent work, check:

- Context: files/docs/current behavior were inspected, not guessed.
- Specificity: names, copy, UI, data, and docs match ZenFlow, not a generic wellness/productivity app.
- Completeness: placeholders, TODO/TBD deliverables, fake examples, and generic filler are absent.
- Cross-platform: Web/PWA, Android, iOS, Desktop, Store/Release, Accessibility, Performance, Security/Privacy, Testing, and Operations are marked PASS, N/A, or UNVERIFIED as required by the task.
- Verification: fresh commands, tests, screenshots, browser evidence, package checks, source links, or explicit UNVERIFIED rows support the final claim.
- Delegation: subagent outputs are treated as untrusted evidence and checked before being used as proof.

## Static Guard

Run this guard when changing agent rules, docs, copy, UI patterns, release docs, completion protocols, generated assets, prompts, or when the user explicitly says "AI templates", "ИИ шаблоны", or a similar phrase:

```bash
npm run check:no-ai-templates
```

The guard verifies that the durable policy, AGENTS.md routing, package script, PR template, drift workflow, agent-context contract, CI-style preflight wiring, and obvious tracked template markers remain controlled. It is not a substitute for human/product review; it is the minimum anti-drift check.

## Failure Handling

If the guard or review finds AI-template drift:

1. Replace the template with project-specific work.
2. Add missing source/provenance/verification where relevant.
3. Re-run the focused check that failed.
4. Mark any remaining platform or proof gap as UNVERIFIED instead of PASS.
