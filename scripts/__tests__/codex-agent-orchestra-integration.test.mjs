import { spawnSync } from "node:child_process";
import { access, cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("Codex-only agent orchestra integration", () => {
  it("wires canonical exact-ten commands and removes Ruflow command aliases", async () => {
    const packageJson = JSON.parse(await read("package.json"));

    expect(packageJson.scripts["ai:agent-orchestra:sync"]).toContain("sync-persistent-agent-orchestra.mjs --write");
    expect(packageJson.scripts["check:agent-orchestra"]).toContain("sync-persistent-agent-orchestra.mjs --check");
    expect(packageJson.scripts["check:agent-orchestra:eval"]).toContain("validate-persistent-agent-orchestra-eval-report.mjs --catalog");
    expect(packageJson.scripts["ai:ruflow-plus:sync"]).toBeUndefined();
    expect(packageJson.scripts["ai:ruflow-plus:check"]).toBeUndefined();
  });

  it("makes context and drift checks depend on exact-ten rather than a legacy fallback", async () => {
    const [agentContext, driftWorkflow, contextServer, autoContext, ragManifest] = await Promise.all([
      read("scripts/check-agent-context.mjs"),
      read(".github/workflows/drift-checks.yml"),
      read("tools/zenflow-context/server.mjs"),
      read("tools/zenflow-context/auto-context.mjs"),
      read("scripts/rag/corpus-manifest.json"),
    ]);

    for (const text of [agentContext, driftWorkflow, contextServer]) {
      expect(text).toContain("check:agent-orchestra");
      expect(text).not.toContain("ai:ruflow-plus:check");
    }
    expect(ragManifest).toContain("config/persistent-agent-orchestra.json");
    expect(ragManifest).not.toContain("docs/ai/PERSISTENT_AGENT_ORCHESTRA.md");
    expect(ragManifest).not.toContain("RUFLOW_PLUS_ROLE_PROMPTS.md");
    expect(autoContext).toContain('path.join(repoRoot, ".codex", "auto-context")');
    expect(autoContext).not.toContain(".Codex/auto-context");
  });

  it("fails closed before serving a stale generated orchestra reference", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "zenflow-context-orchestra-drift-"));
    try {
      await Promise.all([
        mkdir(path.join(tempRoot, "config"), { recursive: true }),
        mkdir(path.join(tempRoot, "docs/ai"), { recursive: true }),
        mkdir(path.join(tempRoot, ".codex"), { recursive: true }),
      ]);
      await Promise.all([
        cp(path.join(ROOT, "config/persistent-agent-orchestra.json"), path.join(tempRoot, "config/persistent-agent-orchestra.json")),
        cp(path.join(ROOT, "config/persistent-agent-orchestra.source-waivers.json"), path.join(tempRoot, "config/persistent-agent-orchestra.source-waivers.json")),
        cp(path.join(ROOT, ".codex/config.toml"), path.join(tempRoot, ".codex/config.toml")),
        cp(path.join(ROOT, ".codex/agents"), path.join(tempRoot, ".codex/agents"), { recursive: true }),
      ]);
      const generated = await read("docs/ai/PERSISTENT_AGENT_ORCHESTRA.md");
      await writeFile(
        path.join(tempRoot, "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md"),
        `${generated}\n<!-- stale mutation -->\n`,
        "utf8",
      );
      const serverUrl = pathToFileURL(path.join(ROOT, "tools/zenflow-context/server.mjs")).href;
      const probe = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `import(${JSON.stringify(serverUrl)}).then(async (server) => { try { await server.getZenflowContext({ contextId: "startup", task: "agent governance" }); console.log("SERVED"); } catch (error) { console.error(error.message); process.exitCode = 2; } });`,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, ZENFLOW_CONTEXT_ROOT: tempRoot },
        },
      );

      expect(probe.status, probe.stdout).toBe(2);
      expect(probe.stderr).toMatch(/managed artifact (?:drift|parity)/i);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("keeps one canonical role source and one thin compatibility bridge", async () => {
    const [agents, claudeBridge] = await Promise.all([read("AGENTS.md"), read("CLAUDE.md")]);

    expect(agents).toContain("Persistent Codex Agent Orchestra");
    expect(agents).toContain("config/persistent-agent-orchestra.json");
    expect(agents).toContain("exactly ten project custom roles");
    expect(claudeBridge.trimStart()).toMatch(/^@AGENTS\.md/);
    expect(claudeBridge).not.toContain(".claude/agents");
    expect(claudeBridge).not.toContain("Ruflow");
  });

  it("keeps operational documentation aligned with the fail-closed implementation", async () => {
    const [registryRaw, generated, protocol, design] = await Promise.all([
      read("config/persistent-agent-orchestra.json"),
      read("docs/ai/PERSISTENT_AGENT_ORCHESTRA.md"),
      read("docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md"),
      read("docs/ai/PERSISTENT_AGENT_ORCHESTRA_DESIGN.md"),
    ]);
    const registry = JSON.parse(registryRaw);
    const canonicalUrls = new Set(
      registry.source_review.sources.map((source) => source.url),
    );
    const protocolUrls = [
      ...protocol.matchAll(/https:\/\/[^\s|)]+/g),
    ].map((match) => match[0].replace(/[.,;:]$/, ""));

    expect(generated).toContain(
      "The local checker never suppresses a stale normative or operational source",
    );
    expect(generated).not.toContain("unless a strictly valid temporary external-human waiver exists");
    expect(design).toContain("Superseded Operational Decisions (2026-07-13)");
    expect(design).toContain("all ten spawned project profiles declare `READ_ONLY_INTENT`");
    expect(design).not.toContain("spawned role 1 profile declares workspace-write");
    for (const marker of [
      "structured `kind` + `locator`",
      "Duplicate JSON keys",
      "substantive duplicate",
      "`secure_read`",
      "`strict_json`",
      "atomic one-use ledger",
      "`OBSERVED_UNVERIFIED`",
    ]) {
      expect(protocol).toContain(marker);
    }
    expect(protocolUrls.length).toBeGreaterThan(0);
    for (const url of protocolUrls) expect(canonicalUrls.has(url), url).toBe(true);
  });

  it("registers a Codex-native change governance gate", async () => {
    const hooks = JSON.parse(await read(".codex/hooks.json"));
    const preToolCommands = hooks.hooks.PreToolUse.flatMap((group) => group.hooks).map((hook) => hook.command);

    expect(preToolCommands.some((command) => command.includes("change-governance-gate.cjs"))).toBe(true);
  });

  it("makes active enforcement and ratchet checks Codex-native", async () => {
    const [health, metrics, ratchet] = await Promise.all([
      read("scripts/check-enforcement-health.ts"),
      read("scripts/enforcement-metrics.ts"),
      read("scripts/check-ratchet.ts"),
    ]);

    for (const text of [health, metrics, ratchet]) expect(text).toContain(".codex");
    expect(health).not.toContain('HOOKS_DIR = path.join(ROOT, ".claude"');
    for (const text of [metrics, ratchet]) {
      expect(text).not.toContain(".claude/hooks");
      expect(text).not.toContain(".claude/settings.json");
      expect(text).not.toContain(".claude-audit.log");
    }
    expect(health).toContain("check:agent-orchestra");
    expect(metrics).toContain(".codex-audit.log");
  });

  it("retires competing live role and prompt sources after cutover", async () => {
    for (const legacyPath of [
      ".claude/agents",
      ".claude/hooks",
      ".claude/rules",
      ".claude/skills",
      ".claude/settings.json",
      "tools/ruflow-plus",
      "scripts/sync-ruflow-plus.mjs",
      "scripts/claude-agent.bat",
      "CLAUDE_CONTEXT.md",
      ".github/hooks/context-mode.json",
      ".github/workflows/claude-agent.yml",
      ".github/workflows/claude-review.yml",
    ]) {
      await expect(access(path.join(ROOT, legacyPath))).rejects.toThrow();
    }
  });
});

async function read(relativePath) {
  return (await readFile(path.join(ROOT, relativePath), "utf8")).replace(/\r\n/g, "\n");
}
