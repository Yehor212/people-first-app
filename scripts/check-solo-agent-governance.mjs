#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const retiredArtifacts = [
  ".codex/config.toml",
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
  "scripts/persistent-agent-orchestra",
];

const retiredScripts = [
  "test:agent-orchestra",
  "check:subagent-governance",
  "ai:agent-orchestra:sync",
  "check:agent-orchestra",
  "check:ten-lens-assurance",
  "ai:agent-orchestra:eval:prepare",
  "check:agent-orchestra:eval",
];

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.endsWith(".md") ? [target] : [];
  });
}

for (const relativePath of retiredArtifacts) {
  if (existsSync(path.join(repoRoot, relativePath))) {
    failures.push(`retired artifact still exists: ${relativePath}`);
  }
}

const profileDirectory = path.join(repoRoot, ".codex/agents");
if (existsSync(profileDirectory)) {
  const profiles = readdirSync(profileDirectory).filter((name) => name.endsWith(".toml"));
  if (profiles.length > 0) {
    failures.push(`custom role profiles still exist: ${profiles.join(", ")}`);
  }
}

const hooks = JSON.parse(read(".codex/hooks.json"));
for (const eventName of ["SubagentStart", "SubagentStop"]) {
  if (Object.hasOwn(hooks.hooks ?? {}, eventName)) {
    failures.push(`.codex/hooks.json still registers ${eventName}`);
  }
}

for (const hookPath of [
  ".codex/hooks/no-ai-template-gate.cjs",
  ".codex/hooks/production-data-integrity-gate.cjs",
  "tools/zenflow-context/auto-context.mjs",
]) {
  if (/eventName === ['"]Subagent(?:Start|Stop)['"]/.test(read(hookPath))) {
    failures.push(`${hookPath} still implements a subagent lifecycle handler`);
  }
}

const pkg = JSON.parse(read("package.json"));
for (const scriptName of retiredScripts) {
  if (Object.hasOwn(pkg.scripts ?? {}, scriptName)) {
    failures.push(`package.json still exposes retired script ${scriptName}`);
  }
}
for (const requiredScript of ["test:agent-governance", "check:solo-agent-governance"]) {
  if (!Object.hasOwn(pkg.scripts ?? {}, requiredScript)) {
    failures.push(`package.json is missing ${requiredScript}`);
  }
}

const activeWiring = [
  read(".github/workflows/drift-checks.yml"),
  read("scripts/rag/corpus-manifest.json"),
  read("scripts/rag/search-project-docs.ts"),
].join("\n");
if (
  /persistent-agent-orchestra|PERSISTENT_AGENT_ORCHESTRA|TEN_LENS|ten-lens|(?:test|check|ai):agent-orchestra|subagent-teamlead/.test(
    activeWiring,
  )
) {
  failures.push("CI or RAG still wires the retired custom role system");
}

const agents = read("AGENTS.md");
for (const required of [
  "Default execution is SOLO",
  "No project custom agent profiles are installed",
  "Never create the next task, chat, agent, or implementation lane automatically",
  "docs/ai/DEFERRED_FINDINGS_LEDGER.md",
]) {
  if (!agents.includes(required)) failures.push(`AGENTS.md is missing: ${required}`);
}
if (agents.includes("Persistent Codex Agent Orchestra")) {
  failures.push("AGENTS.md still declares the retired custom orchestra");
}

const staleDocPattern =
  /subagent-driven-development|Spawn a read-only subagent|all ten canonical roles|all ten roles|ten-role closure|Final ten-role|nine non-coordinator orchestra roles|agent-orchestra (?:guards|structure)|check:agent-orchestra|SubagentStart|SubagentStop/;
for (const filePath of markdownFiles(path.join(repoRoot, "docs"))) {
  if (staleDocPattern.test(readFileSync(filePath, "utf8"))) {
    failures.push(
      `documentation still contains an executable retired-agent instruction: ${path.relative(repoRoot, filePath)}`,
    );
  }
}

const ledger = read("docs/ai/DEFERRED_FINDINGS_LEDGER.md");
for (const required of [
  "## Intake Queue",
  "Evidence locator",
  "Verification path",
  "does not authorize implementation",
]) {
  if (!ledger.includes(required)) failures.push(`deferred findings ledger is missing: ${required}`);
}

if (failures.length > 0) {
  console.error("[solo-agent-governance] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "[solo-agent-governance] PASS - custom roles and subagent lifecycle hooks are retired; SOLO ownership and deferred findings remain enforced.",
);
