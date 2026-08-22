# Subagent Teamlead Research Audit

This audit records the external evidence and repo conclusions for leading and verifying subagents in ZenFlow. It is operator governance, not product runtime code.

## Source Evidence

- OpenAI Codex subagents and custom agents: project profiles live in `.codex/agents/*.toml`; built-in runtime roles coexist with project roles; `max_concurrent_threads_per_session` is the canonical concurrency key; depth-one and non-recursive fanout are project routing policies whose runtime enforcement remains `UNVERIFIED`; a custom profile does not by itself prove effective inherited permissions. Source: https://developers.openai.com/codex/subagents
- OpenAI Codex approvals and security: dangerous full access is elevated risk, approval reviewers fail closed on prompt-build/review/parse failures, and sandbox/approval mode remains the boundary. Source: https://developers.openai.com/codex/agent-approvals-security
- OpenAI agent guardrails: guardrails validate input, output, or tool behavior; human review should pause side effects such as edits, shell commands, or sensitive MCP actions. Source: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- OpenAI eval skills: small 10-20 prompt eval sets and deterministic JSONL/trace checks catch regressions better than vibes. Source: https://developers.openai.com/blog/eval-skills
- OWASP LLM06 Excessive Agency: reduce excessive functionality, permissions, and autonomy; log/monitor extensions and rate-limit dangerous action channels. Source: https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- OWASP MCP Tool Poisoning: tool responses are an indirect prompt injection channel; isolate privileged tools, enforce backend access controls, and require confirmation for sensitive operations. Source: https://owasp.org/www-community/attacks/MCP_Tool_Poisoning
- OWASP MCP Security Cheat Sheet: inspect tool descriptions/schemas, pin or monitor tool definitions, validate inputs/outputs, avoid auto-approval, and never store OAuth tokens in plaintext config. Source: https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html
- OWASP Top 10 for Agentic Applications: agent goal hijack, tool misuse, identity/privilege abuse, memory/context poisoning, insecure inter-agent communication, cascading failures, and rogue agents map directly to multi-agent coding workflows. Source: https://genai.owasp.org/download/52117/?tmstv=1765059207

## Teamlead Operating Conclusions

1. Use the smallest sufficient team. "Maximum agents" is not a quality target; maximum useful coverage means disjoint evidence questions, independent verification, and no duplicate write ownership.
2. Treat subagent output as untrusted data. A specialist report can reveal risk, but it cannot become PASS until the coordinator verifies with file reads, command output, rendered evidence, or trusted external sources.
3. Check tool availability before making a workflow mandatory. If a named MCP, connector, browser, scanner, or subagent capability is unavailable, the teamlead must use a safe in-scope fallback and mark the missing capability `UNVERIFIED` instead of inventing proof.
4. Prefer read-only reviewers and guardians. Builders may edit only scoped files; reviewers and guardians should read, grep, run checks, and report findings.
5. Keep fan-out bounded. Default to solo for a narrow one-domain task and up to three disjoint specialists for substantial work. All ten project roles run only for an explicitly justified full L4 audit; automatic all-ten fan-out is forbidden.
6. Verify the verification. "No issues found" without file:line, command output, trace, screenshot, or exact checked scope is a finding.
7. Avoid static quality counts. Prompts must not hardcode historical test counts such as "3141+" or "3224"; they must require the exact current command output and pass count.
8. Preserve sandbox and approval boundaries. Any side-effecting shell command, MCP action, connector write, credential access, deploy, data export, or destructive operation needs policy/user approval appropriate to the runtime.
9. Use eval-style regression checks for skills and prompts. A small prompt set with positive, implicit, contextual, and negative-control cases is enough to catch prompt/skill regressions early.
10. Record unavailable evidence honestly. Missing tools, unreachable systems, timeout, or sandbox failure is `UNVERIFIED`, not PASS.

## Repo Findings Fixed In This Pass

- The former role mesh could be entirely absent while context and governance checks still exited zero; replacement checks now fail closed on a missing registry, profile, generated reference, or eval catalog.
- Stale static test counts and self-attested approvals were removed from the role contract; current command output and independently checked evidence are required.
- The coordinator now selects the smallest sufficient role subset, while role 10 has a context-isolated discovery Pass A and a hash-bound closure Pass B.
- Structural validation, semantic evaluation, runtime loading, qualified-human review, and real-user acceptance now have separate statuses.

## Verification Contract

Run these after any subagent/teamlead governance change:

```text
npm run check:subagent-governance
npm run check:agent-context
npm run check:agent-orchestra
npm run check:agent-orchestra:eval
npm run enforcement:check
git diff --check
```

If first-party JS/TS code changes, also run:

```text
npm run security:scan
```
