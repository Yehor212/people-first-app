import { existsSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const HOOK = ".codex/hooks/no-ai-template-gate.cjs";
const HOOK_PATH = resolve(HOOK);
const EVALUATOR_PATH = resolve("scripts/__tests__/helpers/run-no-ai-template-evaluator.cjs");

function runHook(input: unknown) {
  return spawnSync(process.execPath, [EVALUATOR_PATH], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
}

describe("Codex no-AI-template hook", () => {
  it("ships and registers the runtime hook for prompt, stop, and subagent checks", () => {
    expect(existsSync(HOOK)).toBe(true);

    const hooksConfig = JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as {
      hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
    };

    const userPromptHooks = hooksConfig.hooks?.UserPromptSubmit || [];
    const stopHooks = hooksConfig.hooks?.Stop || [];
    const subagentStartHooks = hooksConfig.hooks?.SubagentStart || [];
    const subagentStopHooks = hooksConfig.hooks?.SubagentStop || [];

    expect(JSON.stringify(userPromptHooks)).toContain("skill-router-gate.cjs");
    expect(JSON.stringify(stopHooks)).toContain("no-ai-template-gate.cjs");
    expect(JSON.stringify(subagentStartHooks)).toContain("subagent-evidence-gate.cjs");
    expect(JSON.stringify(subagentStopHooks)).toContain("subagent-evidence-gate.cjs");
  });

  it("injects the no-template best-practices contract for idea requests", () => {
    const result = runHook({
      hook_event_name: "UserPromptSubmit",
      prompt: "дай идеи по лучшим практикам без ии шаблонов",
    });

    expect(result.status).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain("NO AI TEMPLATE GATE");
    expect(output).toContain("Best-Practices-Only Proposal Gate");
    expect(output).toContain("source-backed applicability");
  });

  it("injects the subagent evidence contract when a subagent starts", () => {
    const result = runHook({
      hook_event_name: "SubagentStart",
      agent_type: "reviewer",
    });

    expect(result.status).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain("SUBAGENT EVIDENCE CONTRACT");
    expect(output).toContain("GO / STOP / ASK");
    expect(output).toContain("coordinator must verify");
  });

  it("forces revision when final output contains obvious AI-template placeholders", () => {
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message:
        "Here is the page copy: " +
        ["Lorem", "ipsum"].join(" ") +
        " " +
        ["copy goes", "here"].join(" ") +
        ".",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("NO AI TEMPLATE GATE BLOCKED");
    expect(result.stderr).toContain(["lorem", "ipsum placeholder"].join(" "));
  });

  it("forces revision when best-practices recommendations lack local evidence and verification", () => {
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: "Best practice: add a dashboard with cards and achievements.",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("best-practices laundering");
  });

  it("forces subagent revision when all-clear proof lacks evidence", () => {
    const result = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: "All clear. No issues found. PASS.",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("subagent proof laundering");
  });

  it("allows source-backed best-practices recommendations with evidence and verification", () => {
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: [
        "Best practice recommendation:",
        "Source-backed applicability: OWASP output validation applies to agent output.",
        "Local evidence: docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md defines the gate.",
        "Tradeoffs and rejection criteria: do not block legitimate template files.",
        "Verification path: npm run check:no-ai-templates and explicit UNVERIFIED rows.",
      ].join("\n"),
    });

    expect(result.status).toBe(0);
  });

  it("allows an explicitly historical placeholder quoted in an inline code span", () => {
    const historicalPlaceholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: [
        `Removed the historical marker \`${historicalPlaceholder}\` from the reviewed policy.`,
        "Verification run: npm run check:no-ai-templates PASS.",
      ].join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("still blocks a proposed placeholder even when it is formatted as inline code", () => {
    const proposedPlaceholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: `Use this as the final page copy: \`${proposedPlaceholder}\`.`,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TODO/TBD final content marker");
  });

  it("does not treat an example proposed as final copy as historical evidence", () => {
    const proposedPlaceholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: `Use this example as the final page copy: \`${proposedPlaceholder}\`.`,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TODO/TBD final content marker");
  });

  it("blocks a new placeholder even when a separate historical quote is nearby", () => {
    const placeholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: [
        `Removed the historical marker \`${placeholder}\` from the reviewed policy.`,
        `Use this as the final page copy: \`${placeholder}\`.`,
      ].join("\n"),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TODO/TBD final content marker");
  });

  it.each([
    "We never removed the historical marker",
    "Do not say we removed the historical marker",
    "If we removed the historical marker",
    "It is false that we removed the historical marker",
  ])("blocks a placeholder after the non-factual prefix %s", (prefix) => {
    const placeholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: `${prefix} \`${placeholder}\`; keep it as the final copy.`,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TODO/TBD final content marker");
  });

  it("blocks reusing an otherwise historical quoted marker as final copy", () => {
    const placeholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: `Removed the historical marker \`${placeholder}\`; keep it as the final copy.`,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TODO/TBD final content marker");
  });

  it.each([
    "Use the quoted marker above as the final copy.",
    "Ship that quoted marker as production copy.",
    "\nRetain the quoted value above in production.",
    "Ship that quoted marker.",
    "Publish the quoted value above verbatim.",
    "Adopt the quoted placeholder unchanged.",
    "Use the quoted marker above verbatim in the app.",
    "Deploy the quoted marker above.",
    "Release the quoted placeholder unchanged.",
    "Paste the quoted copy into production.",
    "Put that quoted marker in the app.",
    "Deploy the marker above.",
    "Use the above value in the app.",
  ])("blocks bounded cross-line reuse of a historical quoted marker: %s", (reuse) => {
    const placeholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: [
        `Removed the historical marker \`${placeholder}\` from the reviewed policy.`,
        reuse,
      ].join("\n"),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TODO/TBD final content marker");
  });

  it.each([
    ["generic pronoun", "Use it as final copy."],
    ["generic text reference", "Use that text as final copy."],
    [
      "reuse beyond the former bounded window",
      `${"Reviewed the local governance evidence without changing product copy. ".repeat(
        8
      )}\nUse it as final copy.`,
    ],
  ])("blocks historical-marker reuse through %s", (_label, reuse) => {
    const placeholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: [
        `Removed the historical marker \`${placeholder}\` from the reviewed policy.`,
        reuse,
      ].join("\n"),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TODO/TBD final content marker");
  });

  it.each([
    "We do not use that placeholder anywhere.",
    "Never reuse the quoted marker; it remains deleted.",
    "Do not ship that quoted marker.",
    "The quoted marker above remains deleted and is evidence only.",
    "The marker above remains deleted and is evidence only.",
    "Use npm run check:no-ai-templates for verification. Separately, production copy in docs/intro.md was unchanged.",
    "Keep the verification log above. The production command passed.",
  ])("allows a historical quote followed by the non-reuse statement %s", (statement) => {
    const placeholder = ["TODO", "replace actual copy"].join(": ");
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: [
        `Removed the historical marker \`${placeholder}\` from the reviewed policy.`,
        statement,
        "Verification run: npm run check:no-ai-templates PASS.",
      ].join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("allows evidence-backed subagent findings with explicit verification", () => {
    const result = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: [
        "Findings: none after checking docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md.",
        "File/source evidence: docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md:1.",
        "Platform/domain impact: agent-governance.",
        "Verification run: npm run check:no-ai-templates PASS.",
        "Remaining risk: GitHub branch protection UNVERIFIED.",
        "Verdict: GO.",
      ].join("\n"),
    });

    expect(result.status).toBe(0);
  });

  it("shares one semantic subagent evidence validator with the production-data hook", () => {
    const sharedValidator = "scripts/codex-governance/subagent-evidence.cjs";
    expect(existsSync(sharedValidator)).toBe(true);
    for (const hookPath of [
      ".codex/hooks/no-ai-template-gate.cjs",
      ".codex/hooks/production-data-integrity-gate.cjs",
    ]) {
      expect(readFileSync(hookPath, "utf8")).toContain("subagent-evidence.cjs");
    }
  });

  it("blocks the same unknown-heading evidence bypass in both SubagentStop hooks", () => {
    const payload = {
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: [
        "## Findings",
        "- The reviewed governance output contains no claimed blocking issue.",
        "## File/source evidence",
        "Web/PWA reviewed",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification run",
        "### npm test",
        "## Remaining risk",
        "- Fresh-session loading remains UNVERIFIED.",
        "## Verdict",
        "GO",
      ].join("\n"),
    };
    const noAi = spawnSync(process.execPath, [HOOK_PATH], {
      input: JSON.stringify(payload),
      encoding: "utf8",
    });
    expect(noAi.status).toBe(2);
    expect(noAi.stderr).toContain("subagent");

    const pdi = spawnSync(
      process.execPath,
      [resolve(".codex/hooks/production-data-integrity-gate.cjs")],
      {
        input: JSON.stringify(payload),
        encoding: "utf8",
      }
    );
    expect(pdi.status, pdi.stderr).toBe(0);
    expect(JSON.parse(pdi.stdout)).toEqual({
      decision: "block",
      reason:
        "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.",
    });
  });

  it.each([
    ["level-one Markdown headings", "#", "\n"],
    ["level-two Markdown headings with CRLF", "##", "\r\n"],
  ])("allows an evidence-complete SubagentStop report using %s", (_label, heading, newline) => {
    const result = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: [
        `${heading} Findings`,
        "",
        "- The reviewed hook delta contains no unresolved no-template marker.",
        `${heading} File/source evidence`,
        "",
        "- .codex/hooks/no-ai-template-gate.cjs:1",
        "- scripts/__tests__/no-ai-template-hook.test.ts:238",
        `${heading} Platform/domain impact`,
        "",
        "- Agent-governance output only; product runtimes are unchanged.",
        `${heading} Verification run`,
        "",
        "- npm run check:no-ai-templates completed for the reviewed tree.",
        `${heading} Verification skipped`,
        "",
        "- Native Windows hook loading remains UNVERIFIED because no Windows runner was used.",
        `${heading} Remaining risk`,
        "",
        "- Fresh-session runtime loading remains UNVERIFIED.",
        `${heading} Verdict`,
        "",
        "GO",
      ].join(newline),
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("does not reinterpret an explicit STOP verdict as success because verification passed", () => {
    const result = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: [
        "## Findings",
        "- A blocking no-template concern remains in the reviewed output.",
        "## File/source evidence",
        "- .codex/hooks/no-ai-template-gate.cjs:1",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification run",
        "- npm run check:no-ai-templates PASS for the focused reproduction.",
        "## Remaining risk",
        "- The unresolved finding can still affect generated governance output.",
        "## Verdict",
        "STOP",
      ].join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("allows trailing labeled manifest metadata after one exact STOP verdict in both hooks", () => {
    const payload = {
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: [
        "## Findings",
        "- A blocking governance concern remains in the reviewed hook delta.",
        "## File/source evidence",
        "- scripts/codex-governance/subagent-evidence.cjs:1",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification run",
        "- npm run check:no-ai-templates PASS for the focused reproduction.",
        "## Remaining risk",
        "- The unresolved finding still blocks closure.",
        "## Verdict",
        "STOP",
        "Final manifest SHA-256: 4a3f17d60cb4e7d25ba1eb4b0ee0d22a3f395a425311bcc477c31f62d6c960a1",
      ].join("\n"),
    };

    const noAi = runHook(payload);
    expect(noAi.status, noAi.stderr).toBe(0);

    const pdi = spawnSync(
      process.execPath,
      [resolve(".codex/hooks/production-data-integrity-gate.cjs")],
      {
        input: JSON.stringify(payload),
        encoding: "utf8",
      }
    );
    expect(pdi.status, pdi.stderr).toBe(0);
    expect(JSON.parse(pdi.stdout)).toEqual({});
  });

  it("still rejects an ambiguous verdict list before trailing labeled metadata", () => {
    const result = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: [
        "Findings: no blocking issue was claimed.",
        "File/source evidence: scripts/codex-governance/subagent-evidence.cjs:1",
        "Platform/domain impact: agent governance only.",
        "Verification run: npm run check:no-ai-templates passed.",
        "Remaining risk: native runtime loading remains UNVERIFIED.",
        "Verdict: GO / STOP / ASK",
        "Final manifest SHA-256: 4a3f17d60cb4e7d25ba1eb4b0ee0d22a3f395a425311bcc477c31f62d6c960a1",
      ].join("\n"),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("subagent");
    expect(result.stderr).toContain("evidence");
  });

  it("rejects a second terminal disposition after an exact first verdict", () => {
    const result = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: [
        "Findings: a blocking governance issue remains.",
        "File/source evidence: scripts/codex-governance/subagent-evidence.cjs:1",
        "Platform/domain impact: agent governance only.",
        "Verification run: npm run check:no-ai-templates passed.",
        "Remaining risk: closure remains blocked.",
        "Verdict: STOP",
        "GO",
      ].join("\n"),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("verdict_missing_or_invalid");
  });

  it("rejects a GO verdict contradicted by a failed verification run", () => {
    const result = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: [
        "Findings: no blocking issue was claimed.",
        "File/source evidence: .codex/hooks/no-ai-template-gate.cjs:1",
        "Platform/domain impact: agent governance only.",
        "Verification run: npm run check:no-ai-templates failed with exit 1.",
        "Remaining risk: the failed check is unresolved.",
        "Verdict: GO",
      ].join("\n"),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("subagent");
    expect(result.stderr).toContain("evidence");
  });

  it.each([
    [
      "empty body",
      [
        "## Findings",
        "",
        "## File/source evidence",
        "- .codex/hooks/no-ai-template-gate.cjs:1",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification run",
        "- npm run check:no-ai-templates completed.",
        "## Remaining risk",
        "- Runtime loading remains UNVERIFIED.",
        "## Verdict",
        "GO",
      ],
    ],
    [
      "missing source locator",
      [
        "## Findings",
        "- No blocking issue was found in the reviewed output.",
        "## File/source evidence",
        "- Source was reviewed without a concrete locator.",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification skipped",
        "- Verification was skipped because no runner was available.",
        "## Remaining risk",
        "- Runtime loading remains UNVERIFIED.",
        "## Verdict",
        "GO",
      ],
    ],
    [
      "fake PASS verification",
      [
        "## Findings",
        "- No blocking issue was found in the reviewed output.",
        "## File/source evidence",
        "- .codex/hooks/no-ai-template-gate.cjs:1",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification run",
        "- PASS PASS PASS",
        "## Remaining risk",
        "- Runtime loading remains UNVERIFIED.",
        "## Verdict",
        "GO",
      ],
    ],
  ])("blocks a content-free Markdown SubagentStop report with %s", (_label, lines) => {
    const result = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: lines.join("\n"),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("subagent");
    expect(result.stderr).toContain("evidence");
  });

  it("fails closed on invalid hook input", () => {
    const result = spawnSync(process.execPath, [HOOK_PATH], {
      input: "NOT JSON",
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("HOOK ERROR [no-ai-template-gate]");
  });

  it("is covered by the repository no-AI-template static guard", () => {
    const output = execFileSync(process.execPath, ["scripts/check-no-ai-templates.cjs"], {
      encoding: "utf8",
    });
    expect(output).toContain("[no-ai-templates] PASS");
  });
});
