import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

const CHECKER = "scripts/check-no-ai-templates.cjs";
const CHECKER_PATH = resolve(CHECKER);
const POLICY = "docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md";

describe("no AI templates agent policy", () => {
  it("ships a durable policy document and static checker", () => {
    expect(existsSync(POLICY)).toBe(true);
    expect(existsSync(CHECKER)).toBe(true);
  });

  it("is wired into package scripts for agents and CI-style checks", () => {
    const packageJson = require("../../package.json") as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["check:no-ai-templates"]).toBe(
      "node scripts/check-no-ai-templates.cjs",
    );
    expect(packageJson.scripts["ci:preflight"]).toContain("npm run check:no-ai-templates");
  });

  it("passes the current repository guard", () => {
    const output = execFileSync(process.execPath, [CHECKER], { encoding: "utf8" });
    expect(output).toContain("[no-ai-templates] PASS");
  });

  it("documents source-backed enforcement layers across agent and review surfaces", () => {
    const policy = readFileSync(POLICY, "utf8");
    const prTemplate = readFileSync(".github/PULL_REQUEST_TEMPLATE.md", "utf8");
    const driftWorkflow = readFileSync(".github/workflows/drift-checks.yml", "utf8");
    const agentContext = readFileSync("scripts/check-agent-context.mjs", "utf8");

    for (const marker of [
      "Source Evidence",
      "Enforcement Layers",
      "https://www.nist.gov/itl/ai-risk-management-framework",
      "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
      "https://developers.openai.com/codex/guides/agents-md",
      "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches",
      "https://google.github.io/eng-practices/review/developer/small-cls.html",
    ]) {
      expect(policy).toContain(marker);
    }

    expect(prTemplate).toContain("No AI-template output");
    expect(prTemplate).toContain("npm run check:no-ai-templates");
    expect(driftWorkflow).toContain("npm run check:no-ai-templates");
    expect(agentContext).toContain("assertNoAiTemplatesGateContract");
    expect(agentContext).toContain("NO_AI_TEMPLATES_AGENT_POLICY.md");
  });

  it("rejects obvious AI-template markers in tracked durable surfaces", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "no-ai-template-marker-"));
    mkdirSync(join(rootDir, "docs/ai"), { recursive: true });
    mkdirSync(join(rootDir, "scripts/__tests__"), { recursive: true });
    mkdirSync(join(rootDir, ".github/workflows"), { recursive: true });
    mkdirSync(join(rootDir, "src/components"), { recursive: true });
    writeFileSync(join(rootDir, "AGENTS.md"), [
      "# Agent Guide",
      "## No AI Templates Agent Gate",
      "- docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md",
      "- npm run check:no-ai-templates",
      "- ИИ шаблоны",
    ].join("\n"));
    writeFileSync(join(rootDir, POLICY), readFileSync(POLICY, "utf8"));
    writeFileSync(join(rootDir, CHECKER), readFileSync(CHECKER, "utf8"));
    writeFileSync(join(rootDir, "scripts/__tests__/no-ai-templates-policy.test.ts"), readFileSync("scripts/__tests__/no-ai-templates-policy.test.ts", "utf8"));
    writeFileSync(join(rootDir, ".github/PULL_REQUEST_TEMPLATE.md"), "- [ ] No AI-template output (npm run check:no-ai-templates)\n");
    writeFileSync(join(rootDir, ".github/workflows/drift-checks.yml"), "run: npm run check:no-ai-templates\n");
    writeFileSync(join(rootDir, "scripts/check-agent-context.mjs"), "assertNoAiTemplatesGateContract NO_AI_TEMPLATES_AGENT_POLICY.md\n");
    writeFileSync(
      join(rootDir, "package.json"),
      JSON.stringify({
        scripts: {
          "check:no-ai-templates": "node scripts/check-no-ai-templates.cjs",
          "ci:preflight": "npm run check:no-ai-templates",
        },
      }),
    );
    writeFileSync(join(rootDir, "src/components/GenericTemplate.tsx"), "export const copy = 'Lorem ipsum copy goes here';\n");

    const result = spawnSync(process.execPath, [join(rootDir, CHECKER)], {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("AI-template marker");
    expect(output).toContain("src/components/GenericTemplate.tsx");
  });

  it("rejects policy drift when required markers are missing", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "no-ai-templates-policy-"));
    mkdirSync(join(rootDir, "docs/ai"), { recursive: true });
    mkdirSync(join(rootDir, "scripts"), { recursive: true });
    writeFileSync(join(rootDir, "AGENTS.md"), "# Agent Guide\n");
    writeFileSync(
      join(rootDir, "package.json"),
      JSON.stringify({ scripts: { "check:no-ai-templates": "node scripts/check-no-ai-templates.cjs" } }),
    );

    const result = spawnSync(process.execPath, [CHECKER_PATH], {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("[no-ai-templates] FAIL");
    expect(output).toContain("AGENTS.md");
    expect(output).toContain("NO_AI_TEMPLATES_AGENT_POLICY.md");
  });
});
