import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const RETIRED_PATHS = [
  ".codex/config.toml",
  ...Array.from({ length: 10 }, (_, index) => {
    const role = [
      "coordinator-teamlead",
      "psychology-human-factors-emotional-safety",
      "logic-causality-state-coherence",
      "interaction-accessibility-readability-localization-culture",
      "technical-architecture-data-cross-platform",
      "security-privacy-agent-trust",
      "performance-reliability-operations",
      "qa-evidence-release-verification",
      "product-discovery-visual-craft-experience-quality",
      "independent-blind-spot-sentinel",
    ][index];
    return `.codex/agents/${String(index + 1).padStart(2, "0")}-${role}.toml`;
  }),
  "config/persistent-agent-orchestra.eval-baseline.json",
  "config/persistent-agent-orchestra.evals.json",
  "config/persistent-agent-orchestra.json",
  "config/persistent-agent-orchestra.source-waivers.json",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA_DESIGN.md",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md",
  "docs/ai/SUBAGENT_TEAMLEAD_RESEARCH_AUDIT.md",
  "docs/ai/TEN_LENS_EVIDENCE_ASSURANCE_V2_2_1.md",
  "docs/superpowers/plans/2026-07-13-codex-exact-ten-agent-orchestra.md",
  "docs/superpowers/plans/2026-07-20-ten-lens-evidence-assurance-v2-2-1.md",
  "docs/superpowers/plans/2026-07-21-adaptive-evidence-first-agent-router.md",
  "scripts/check-subagent-teamlead-governance.mjs",
  "scripts/run-persistent-agent-orchestra-evals.mjs",
  "scripts/run-ten-lens-assurance.mjs",
  "scripts/sync-persistent-agent-orchestra.mjs",
  "scripts/validate-persistent-agent-orchestra-eval-report.mjs",
  "scripts/persistent-agent-orchestra/assurance-core.mjs",
  "scripts/persistent-agent-orchestra/eval-core.mjs",
  "scripts/persistent-agent-orchestra/registry-core.mjs",
  "scripts/persistent-agent-orchestra/secure-read.mjs",
  "scripts/persistent-agent-orchestra/strict-json.mjs",
  "scripts/__tests__/codex-agent-orchestra-integration.test.mjs",
  "scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs",
  "scripts/__tests__/persistent-agent-orchestra-registry.test.mjs",
];

const RETIRED_PACKAGE_SCRIPTS = [
  "test:agent-orchestra",
  "check:subagent-governance",
  "ai:agent-orchestra:sync",
  "check:agent-orchestra",
  "check:ten-lens-assurance",
  "ai:agent-orchestra:eval:prepare",
  "check:agent-orchestra:eval",
];

describe("custom agent orchestra retirement", () => {
  it("removes all ten profiles and every restoration artifact", () => {
    const remaining = RETIRED_PATHS.filter((path) => existsSync(path));
    expect(remaining).toEqual([]);
  });

  it("registers no subagent lifecycle hooks and keeps their handlers inert", () => {
    const hooks = JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as {
      hooks?: Record<string, unknown>;
    };
    const noTemplateHook = readFileSync(".codex/hooks/no-ai-template-gate.cjs", "utf8");
    const integrityHook = readFileSync(
      ".codex/hooks/production-data-integrity-gate.cjs",
      "utf8",
    );
    const autoContext = readFileSync("tools/zenflow-context/auto-context.mjs", "utf8");

    expect(hooks.hooks).not.toHaveProperty("SubagentStart");
    expect(hooks.hooks).not.toHaveProperty("SubagentStop");
    expect(noTemplateHook).not.toMatch(/eventName === ['"]Subagent(?:Start|Stop)['"]/);
    expect(integrityHook).not.toMatch(/eventName === ['"]Subagent(?:Start|Stop)['"]/);
    expect(autoContext).not.toMatch(/eventName === ['"]Subagent(?:Start|Stop)['"]/);
  });

  it("removes restoration commands from package, CI, and RAG", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    const remainingScripts = RETIRED_PACKAGE_SCRIPTS.filter((name) => name in (pkg.scripts ?? {}));
    const activeWiring = [
      readFileSync(".github/workflows/drift-checks.yml", "utf8"),
      readFileSync("scripts/rag/corpus-manifest.json", "utf8"),
      readFileSync("scripts/rag/search-project-docs.ts", "utf8"),
    ].join("\n");

    expect(remainingScripts).toEqual([]);
    expect(activeWiring).not.toMatch(
      /persistent-agent-orchestra|PERSISTENT_AGENT_ORCHESTRA|TEN_LENS|ten-lens|(?:test|check|ai):agent-orchestra|subagent-teamlead/,
    );
  });

  it("keeps solo ownership and the canonical deferred-findings ledger", () => {
    const agents = readFileSync("AGENTS.md", "utf8");
    const ledger = readFileSync("docs/ai/DEFERRED_FINDINGS_LEDGER.md", "utf8");

    expect(agents).toContain("Default execution is SOLO");
    expect(agents).toContain("No project custom agent profiles are installed");
    expect(agents).toContain("docs/ai/DEFERRED_FINDINGS_LEDGER.md");
    expect(agents).not.toContain("Persistent Codex Agent Orchestra");
    expect(ledger).toContain("## Intake Queue");
    expect(ledger).toContain("does not authorize implementation");
  });
});
