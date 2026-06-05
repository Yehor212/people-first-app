# Subagent Teamlead Research Audit

This audit records the external evidence and repo conclusions for leading and verifying subagents in ZenFlow. It is operator governance, not product runtime code.

## Source Evidence

- OpenAI Codex subagents: Codex only spawns subagents when explicitly asked, orchestration waits for requested results, and subagents add token cost. Source: https://developers.openai.com/codex/subagents
- OpenAI Codex approvals and security: dangerous full access is elevated risk, approval reviewers fail closed on prompt-build/review/parse failures, and sandbox/approval mode remains the boundary. Source: https://developers.openai.com/codex/agent-approvals-security
- OpenAI agent guardrails: guardrails validate input, output, or tool behavior; human review should pause side effects such as edits, shell commands, or sensitive MCP actions. Source: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- OpenAI eval skills: small 10-20 prompt eval sets and deterministic JSONL/trace checks catch regressions better than vibes. Source: https://developers.openai.com/blog/eval-skills
- Anthropic building effective agents: start simple, add agentic complexity only when it improves outcomes, use ground truth from tool/code execution, add guardrails, and test in sandboxes. Source: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic subagents: subagents are separate context windows with custom prompts and tool access; tool allowlists and disallowed tools reduce blast radius. Source: https://code.claude.com/docs/en/sub-agents
- OWASP LLM06 Excessive Agency: reduce excessive functionality, permissions, and autonomy; log/monitor extensions and rate-limit dangerous action channels. Source: https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- OWASP MCP Tool Poisoning: tool responses are an indirect prompt injection channel; isolate privileged tools, enforce backend access controls, and require confirmation for sensitive operations. Source: https://owasp.org/www-community/attacks/MCP_Tool_Poisoning
- OWASP MCP Security Cheat Sheet: inspect tool descriptions/schemas, pin or monitor tool definitions, validate inputs/outputs, avoid auto-approval, and never store OAuth tokens in plaintext config. Source: https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html
- OWASP Top 10 for Agentic Applications: agent goal hijack, tool misuse, identity/privilege abuse, memory/context poisoning, insecure inter-agent communication, cascading failures, and rogue agents map directly to multi-agent coding workflows. Source: https://genai.owasp.org/download/52117/?tmstv=1765059207

## Teamlead Operating Conclusions

1. Use the smallest sufficient team. "Maximum agents" is not a quality target; maximum useful coverage means disjoint evidence questions, independent verification, and no duplicate write ownership.
2. Treat subagent output as untrusted data. A specialist report can reveal risk, but it cannot become PASS until the coordinator verifies with file reads, command output, rendered evidence, or trusted external sources.
3. Check tool availability before making a workflow mandatory. If a Ruflo, MCP, Browser, Data Analytics, or subagent tool is unavailable, the teamlead must emulate the behavior manually and mark the tool-specific evidence as unavailable instead of inventing it.
4. Prefer read-only reviewers and guardians. Builders may edit only scoped files; reviewers and guardians should read, grep, run checks, and report findings.
5. Keep fan-out bounded. Default to solo for 1-3 file tasks, guided mode for moderate tasks, up to 3 specialists for medium Ruflow+ tasks, and up to 5 only for large disjoint domains. More than 5 requires hierarchical ownership and a written reason.
6. Verify the verification. "No issues found" without file:line, command output, trace, screenshot, or exact checked scope is a finding.
7. Avoid static quality counts. Prompts must not hardcode historical test counts such as "3141+" or "3224"; they must require the exact current command output and pass count.
8. Preserve sandbox and approval boundaries. Any side-effecting shell command, MCP action, connector write, credential access, deploy, data export, or destructive operation needs policy/user approval appropriate to the runtime.
9. Use eval-style regression checks for skills and prompts. A small prompt set with positive, implicit, contextual, and negative-control cases is enough to catch prompt/skill regressions early.
10. Record unavailable evidence honestly. Missing tools, unreachable systems, timeout, or sandbox failure is `UNVERIFIED`, not PASS.

## Repo Findings Fixed In This Pass

- Stale static test counts existed in teamlead/test prompts and could make future agents compare against obsolete numbers instead of current command output.
- Teamlead prompts required Ruflo MCP calls even when tool discovery did not expose Ruflo MCP tools in the current runtime.
- Teamlead prompts said the coordinator must never write code, but the actual Codex runtime may not provide an Agent tool. The corrected rule is: delegate when a safe subagent mechanism is available; otherwise act as coordinator plus implementer and compensate with independent checks.
- Existing Ruflow+ docs had the right small-team instinct, but did not explicitly model subagent output as untrusted data or require tool availability checks before mandatory app/plugin routing.

## Verification Contract

Run these after any subagent/teamlead governance change:

```text
npm run check:subagent-governance
npm run check:agent-context
npm run ai:ruflow-plus:check
npm run enforcement:check
git diff --check
```

If first-party JS/TS code changes, also run:

```text
npm run security:scan
```
