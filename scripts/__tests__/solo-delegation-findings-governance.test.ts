import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const AGENTS = "AGENTS.md";
const HOOKS = ".codex/hooks.json";
const NO_TEMPLATE_HOOK = ".codex/hooks/no-ai-template-gate.cjs";
const FINDINGS_LEDGER = "docs/ai/DEFERRED_FINDINGS_LEDGER.md";

describe("solo-by-default delegation and deferred findings governance", () => {
  it("keeps execution solo and removes project custom role profiles", () => {
    const agents = readFileSync(AGENTS, "utf8");

    expect(agents).toContain("Default execution is SOLO");
    expect(agents).toContain("No project custom agent profiles are installed");
    expect(existsSync(".codex/config.toml")).toBe(false);
    expect(existsSync(".codex/agents/01-coordinator-teamlead.toml")).toBe(false);
  });

  it("does not register or handle subagent lifecycle hooks", () => {
    const hooks = JSON.parse(readFileSync(HOOKS, "utf8")) as {
      hooks?: Record<string, unknown>;
    };
    const hookSource = readFileSync(NO_TEMPLATE_HOOK, "utf8");

    expect(hooks.hooks).not.toHaveProperty("SubagentStart");
    expect(hooks.hooks).not.toHaveProperty("SubagentStop");
    expect(hookSource).not.toMatch(/eventName === ['"]Subagent(?:Start|Stop)['"]/);
  });

  it("uses one canonical evidence-backed ledger for additional out-of-scope findings", () => {
    expect(existsSync(FINDINGS_LEDGER)).toBe(true);

    const agents = readFileSync(AGENTS, "utf8");
    const ledger = readFileSync(FINDINGS_LEDGER, "utf8");
    const hookSource = readFileSync(NO_TEMPLATE_HOOK, "utf8");

    expect(agents).toContain(FINDINGS_LEDGER);
    expect(hookSource).toContain(FINDINGS_LEDGER);
    expect(ledger).toContain("## Intake Queue");
    expect(ledger).toContain("Evidence locator");
    expect(ledger).toContain("Verification path");
    expect(ledger).toContain("No secrets, credentials, raw private content, or user data");
    expect(ledger).toContain("does not authorize implementation");
  });
});
