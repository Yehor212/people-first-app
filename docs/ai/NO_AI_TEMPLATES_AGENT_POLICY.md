# No AI Templates Agent Policy

Purpose: forbid generic AI-template work across ZenFlow agent workflows. This is an operator protocol, not application runtime code. It applies to Codex project roles, built-in workers, local subagents, connector-backed agents, and any future agent that follows this repository guidance.

## Source Evidence

This policy follows a layered-governance pattern rather than relying on a single instruction:

- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework - use governance, mapping, measurement, and management controls instead of one-off trust in model output.
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/ - treat LLM prompts, outputs, tool use, and supply-chain material as untrusted until verified.
- OWASP LLM Prompt Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html - use structured instruction/data separation, output validation, least privilege, monitoring, and recurring testing for LLM-assisted workflows.
- OpenAI Codex AGENTS.md guidance: https://developers.openai.com/codex/guides/agents-md - keep durable, repository-specific instructions where agents can discover them.
- OpenAI Codex hooks and subagents: https://developers.openai.com/codex/hooks and https://developers.openai.com/codex/subagents - use `SubagentStart` for subagent context injection, `SubagentStop` for subagent output review, narrow specialist scope, and bounded fan-out.
- OWASP AI Agent Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html - validate agent outputs, use structured output expectations, isolate context/memory, and treat multi-agent outputs as untrusted until verified.
- GitHub protected branches and required checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches - use review and status-check backstops for protected work.
- GitHub pull request templates: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-issue-and-pull-request-templates - make review criteria visible at merge time.
- Google Engineering Practices on small CLs: https://google.github.io/eng-practices/review/developer/small-cls.html - keep changes reviewable, scoped, and easier to roll back.
- Google People + AI Guidebook, User Needs + Defining Success: https://pair.withgoogle.com/chapter/user-needs/ - require real user problems, AI-appropriate value, and explicit success criteria before treating an AI-flavored idea as product work.

## Definition

An AI template is any output that looks generated first and ZenFlow-specific second. It includes generic copy, placeholder implementation, stock layouts, shallow boilerplate, vague best-practice filler, fake completeness, and unverified artifacts that could be pasted into any unrelated app.

Forbidden examples:

- Placeholder text such as lorem ipsum, TODO-as-deliverable, TBD-as-deliverable, "coming soon", "AI-generated", "as an AI", or generic launch copy.
- Generic UI sections, card grids, dashboards, modals, onboarding, achievements, empty states, release notes, or docs that ignore the local product language, architecture, i18n, accessibility, platform, privacy, and verification contracts.
- Unadapted snippets copied from model output, tutorials, starter kits, third-party examples, or previous projects.
- Fake proof: claims that code, copy, audio, visuals, native behavior, security, or deployment are complete without current evidence.
- Shipped assets or prompts with missing provenance, license, source, QC, or rollback notes when those are relevant.

## ZenFlow Idea Quality Gate

Feature-name lists are not product ideas. For ZenFlow, an idea is reviewable only when it names the specific user failure mode it addresses, the local ZenFlow evidence that shows where it fits, and the acceptance or kill criteria that would prove whether it deserves implementation.

This gate applies to brainstorming, product strategy, UI concepts, roadmap items, visual directions, agent plans, and any answer that proposes what ZenFlow should build next. An agent must not present standalone feature names, generic cool-feature concepts, copied competitor patterns, vague wellness/productivity slogans, or named concepts with no local evidence as ideas.

Every proposed idea must include, in compact form:

1. User failure mode: the concrete breakdown in the user's workflow, such as not starting, losing context, getting interrupted, feeling punished, or being unable to recover.
2. Local ZenFlow evidence: current files, screenshots, metrics, user message, route, component, platform contract, or test proof that anchors the idea in this project.
3. Affected surface and platform: Web/PWA, Android, iOS, Desktop, Store/Release, Accessibility, Performance, Security/Privacy, Testing, or Operations as applicable.
4. Constraint fit: privacy, ads, permissions, i18n/RTL, accessibility, motion, storage/sync, native, and monetization constraints that the idea must respect.
5. Acceptance or kill criteria: the behavior, metric, test, user proof, or explicit reason that would make the idea pass, fail, or stay UNVERIFIED.
6. Non-goal: what the idea must not become, especially AI chat filler, coercive gamification, medical claims, generic dashboard sections, or interruption-heavy UI.

If any required part is missing, the agent must mark the idea `UNVERIFIED`, ask only a blocking question, or return `STOP`; it must not fill the gap with a polished name, marketing copy, or a best-practices phrase.

## Best-Practices-Only Proposal Gate

Best-practices laundering is when an agent uses phrases like "best practice", "industry standard", "recommended", or "obvious improvement" to make a generic proposal sound authoritative without proving that the practice applies to ZenFlow now.
Treat best-practices laundering as a proposal failure, not as a copy-polish problem.

This gate applies to recommendations, implementation options, roadmap proposals, architecture advice, UX ideas, security/privacy guidance, verification plans, and any agent output that tells ZenFlow what it should do. A recommendation is allowed only when it is grounded in local evidence and in an official, primary, or project-canonical source when an external standard is relevant.

Every best-practices proposal must include, in compact form:

1. Source-backed applicability: the local contract, official/current source, or primary-source evidence behind the recommendation, plus why it applies to the named ZenFlow surface.
2. Local evidence: the file, route, test, screenshot, user report, metric, or project rule that shows the problem exists here.
3. Affected surface and owner: the Web/PWA, Android, iOS, Desktop, Store/Release, Accessibility, Performance, Security/Privacy, Testing, Operations, or agent-governance surface affected by the proposal.
4. Tradeoffs and rejection criteria: the cost, risk, non-goal, rollback concern, or condition that would make this recommendation wrong for ZenFlow.
5. Verification path: the exact command, browser/runtime proof, source check, review gate, or explicit `UNVERIFIED` row needed before claiming the proposal is valid.

If any part is missing, the agent must downgrade the recommendation to a hypothesis, mark it `UNVERIFIED`, ask only a blocking question, or return `STOP`. It must not hide uncertainty behind polished copy, generic best-practice language, competitor mimicry, or a confident feature name.

## Enforcement Layers

No single agent instruction can honestly prove that future agents will never attempt template output. ZenFlow therefore uses layered controls:

1. AGENTS.md is the routing layer and names this policy for all agents.
2. This policy is the review rubric for product copy, UI, docs, prompts, generated assets, release materials, plans, and agent governance.
3. Subagent prompts must include this policy and must return findings with file/command/source evidence, platform/domain impact, verification run or skipped checks, unresolved risk, and GO / STOP / ASK.
4. The PR template makes reviewers explicitly check for no AI-template output.
5. `.codex/hooks/no-ai-template-gate.cjs` injects the no-template contract on `UserPromptSubmit` and `SubagentStart`, then uses `Stop` and `SubagentStop` to force a rewrite when obvious AI-template markers, best-practices laundering, or subagent proof laundering appear.
6. `npm run check:no-ai-templates` is the local and CI-style drift guard for the policy, hook, tests, and wiring.
7. `npm run check:agent-context` keeps this policy discoverable through the broader agent health check.
8. GitHub branch protection and required status checks should be enabled on the canonical repository before claiming merge-time enforcement as PASS.

## Required Agent Behavior

Agents must:

1. Read current project context before producing durable work.
2. Separate explicit user requirements from implied requirements before narrowing scope.
3. Use local patterns, theme tokens, storage helpers, i18n, accessibility rules, and platform contracts instead of generic defaults.
4. Make copy and UX specific to ZenFlow's actual feature, user state, and supported languages. For ar/he, treat RTL as a risk whenever layout or copy is touched.
5. Replace placeholders with real, reviewable content or mark the item UNVERIFIED with a concrete blocker.
6. Keep generated or assisted artifacts traceable: source, license/provenance, prompt/spec, checks run, and rollback path when applicable.
7. Ask or stop when a real product decision is missing; do not fill policy, brand, legal, privacy, medical, financial, or release decisions with model guesses.
8. Include this policy in subagent rubrics whenever delegating product, docs, copy, UI, release, agent-governance, or artifact review work; require findings with file/command/source evidence, platform/domain impact, verification run or skipped checks, remaining risk, and Verdict: GO / STOP / ASK.
9. Apply the ZenFlow Idea Quality Gate before presenting brainstorming, product strategy, roadmap, UI concept, or visual direction output as an idea.
10. Apply the Best-Practices-Only Proposal Gate before presenting recommendations, implementation options, roadmap proposals, architecture advice, UX ideas, security/privacy guidance, verification plans, or agent-governance changes as best practices.

## Allowed Use

The ban does not forbid using AI assistance. It forbids shipping AI-shaped artifacts. Agents may use AI to brainstorm, draft, transform, or analyze only when the final output is grounded in the repository, adapted to ZenFlow, reviewed against the relevant contracts, and verified with current evidence.

Templates, starter snippets, component examples, and generated drafts are allowed only as private scaffolding. Before they become project output, they must be rewritten into project-specific work with local names, local architecture, real copy, tests or checks, and explicit evidence.

## Review Checklist

Before finalizing agent work, check:

- Context: files/docs/current behavior were inspected, not guessed.
- Specificity: names, copy, UI, data, and docs match ZenFlow, not a generic wellness/productivity app.
- Idea quality: brainstorming and roadmap items identify a user failure mode, local ZenFlow evidence, affected platforms, constraints, and acceptance or kill criteria.
- Best-practices-only proposals: recommendations include source-backed applicability, local evidence, affected surface, tradeoffs and rejection criteria, and a verification path or explicit `UNVERIFIED` status.
- Completeness: placeholders, TODO/TBD deliverables, fake examples, and generic filler are absent.
- Cross-platform: Web/PWA, Android, iOS, Desktop, Store/Release, Accessibility, Performance, Security/Privacy, Testing, and Operations are marked PASS, N/A, or UNVERIFIED as required by the task.
- Verification: fresh commands, tests, screenshots, browser evidence, package checks, source links, or explicit UNVERIFIED rows support the final claim.
- Delegation: subagent outputs are treated as untrusted evidence, must satisfy the subagent evidence contract, and are checked by the coordinator before being used as proof.

## Static Guard

Run this guard when changing agent rules, docs, copy, UI patterns, release docs, completion protocols, generated assets, prompts, or when the user explicitly says "AI templates", "ИИ шаблоны", or a similar phrase:

```bash
npm run check:no-ai-templates
```

The guard verifies that the durable policy, Codex runtime hook, AGENTS.md routing, package script, PR template, drift workflow, agent-context contract, CI-style preflight wiring, and obvious tracked template markers remain controlled. It is not a substitute for human/product review; it is the minimum anti-drift check.

## Failure Handling

If the guard or review finds AI-template drift:

1. Replace the template with project-specific work.
2. Add missing source/provenance/verification where relevant.
3. Re-run the focused check that failed.
4. Mark any remaining platform or proof gap as UNVERIFIED instead of PASS.
