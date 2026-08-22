import { existsSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const HOOK = ".codex/hooks/no-ai-template-gate.cjs";
const HOOK_PATH = resolve(HOOK);

function runHook(input: unknown) {
  return spawnSync(process.execPath, [HOOK_PATH], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
}

describe("Codex no-AI-template hook", () => {
  it("ships prompt and stop checks but registers no subagent lifecycle hooks", () => {
    expect(existsSync(HOOK)).toBe(true);

    const hooksConfig = JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as {
      hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
    };

    const userPromptHooks = hooksConfig.hooks?.UserPromptSubmit || [];
    const stopHooks = hooksConfig.hooks?.Stop || [];

    expect(JSON.stringify(userPromptHooks)).toContain("no-ai-template-gate.cjs");
    expect(JSON.stringify(stopHooks)).toContain("no-ai-template-gate.cjs");
    expect(hooksConfig.hooks).not.toHaveProperty("SubagentStart");
    expect(hooksConfig.hooks).not.toHaveProperty("SubagentStop");
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

  it("keeps stale subagent lifecycle events inert", () => {
    const start = runHook({
      hook_event_name: "SubagentStart",
      agent_type: "reviewer",
    });
    const stop = runHook({
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: "All clear. No issues found. PASS.",
    });

    expect(start.status).toBe(0);
    expect(start.stdout).toContain('"continue":true');
    expect(stop.status).toBe(0);
    expect(stop.stdout).toContain('"continue":true');
  });

  it("forces revision when final output contains obvious AI-template placeholders", () => {
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: "Here is the page copy: " + ["Lorem", "ipsum"].join(" ") + " " + ["copy goes", "here"].join(" ") + ".",
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
