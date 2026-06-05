#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const MAX_AGENTS_BYTES = 32 * 1024;
const MAX_AGENTS_LINES = 220;
const MAX_CLAUDE_BYTES = 8 * 1024;
const MAX_CLAUDE_LINES = 80;

const SECRET_PATTERN =
  /(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sbp_[A-Za-z0-9_]{20,}|ctx7sk-[A-Za-z0-9_-]{10,}|\bsk-[A-Za-z0-9_-]{20,}|Authorization:\s*Bearer\s+(?!<|\$\{|process\.env|env:|REDACTED|\*{3})[^\s`'"]+)/i;

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function isTracked(relativePath) {
  try {
    git(["ls-files", "--error-unmatch", relativePath]);
    return true;
  } catch {
    return false;
  }
}

function isIgnored(relativePath) {
  try {
    git(["check-ignore", "-q", "--", relativePath]);
    return true;
  } catch {
    return false;
  }
}

function byteLength(text) {
  return Buffer.byteLength(text, "utf8");
}

function lineCount(text) {
  return text.trimEnd().split("\n").length;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasHeading(text, heading) {
  const pattern = new RegExp(`^#{1,6}\\s+${escapeRegex(heading)}\\s*$`, "mi");
  return pattern.test(text);
}

function assertTrackedInstructionFile(relativePath) {
  if (!existsSync(path.join(repoRoot, relativePath))) {
    fail(`${relativePath} is missing`);
    return "";
  }
  if (!isTracked(relativePath)) {
    fail(`${relativePath} must be tracked by git`);
  }
  return read(relativePath);
}

function assertGovernanceFile(relativePath) {
  if (!existsSync(path.join(repoRoot, relativePath))) {
    fail(`${relativePath} is missing`);
    return "";
  }
  if (isIgnored(relativePath) && !isTracked(relativePath)) {
    fail(`${relativePath} must not be ignored unless it is tracked`);
  }
  const text = read(relativePath);
  assertNoSecrets(relativePath, text);
  return text;
}

function assertSizeBudget(relativePath, text, maxBytes, maxLines) {
  const bytes = byteLength(text);
  const lines = lineCount(text);
  if (bytes > maxBytes) {
    fail(`${relativePath} is ${bytes} bytes; max is ${maxBytes}`);
  }
  if (lines > maxLines) {
    fail(`${relativePath} is ${lines} lines; max is ${maxLines}`);
  }
}

function assertNoRepoIgnoreForCanonicalFiles() {
  const gitignore = read(".gitignore");
  for (const line of gitignore.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    if (trimmed === "AGENTS.md" || trimmed === "/AGENTS.md") {
      fail(".gitignore must not ignore AGENTS.md");
    }
    if (trimmed === "CLAUDE.md" || trimmed === "/CLAUDE.md") {
      fail(".gitignore must not ignore CLAUDE.md");
    }
  }
}

function assertLocalMcpBoundary() {
  if (isTracked(".mcp.json")) {
    fail(".mcp.json must stay untracked");
  }
  if (!isIgnored(".mcp.json")) {
    fail(".mcp.json must stay ignored as the local credential boundary");
  }
}

function assertNoSecrets(relativePath, text) {
  const match = text.match(SECRET_PATTERN);
  if (match) {
    fail(`${relativePath} appears to contain a raw secret-like token near "${match[0].slice(0, 24)}"`);
  }
}

function assertAgentChangeGovernance(agents) {
  if (agents && !hasHeading(agents, "Agent Change Governance")) {
    fail('AGENTS.md is missing required heading "Agent Change Governance"');
  }

  const governance = assertGovernanceFile("docs/ai/AGENT_CHANGE_GOVERNANCE.md");
  if (governance) {
    for (const required of [
      "Source Evidence",
      "Radical Change Triggers",
      "Required Agent Change Notice",
      "Protected Surfaces",
      "Evidence Gates",
      "Human Escalation",
      "PR And CI Backstops",
      "Subagent Audit Rules",
    ]) {
      if (!hasHeading(governance, required)) {
        fail(`docs/ai/AGENT_CHANGE_GOVERNANCE.md is missing required heading "${required}"`);
      }
    }
    if (!/\bAGENT_CHANGE_NOTICE\b/.test(governance)) {
      fail("docs/ai/AGENT_CHANGE_GOVERNANCE.md must define AGENT_CHANGE_NOTICE");
    }
  }

  const subagentAudit = assertGovernanceFile("docs/ai/SUBAGENT_TEAMLEAD_RESEARCH_AUDIT.md");
  if (subagentAudit) {
    for (const required of [
      "Source Evidence",
      "Teamlead Operating Conclusions",
      "Repo Findings Fixed In This Pass",
      "Verification Contract",
    ]) {
      if (!hasHeading(subagentAudit, required)) {
        fail(`docs/ai/SUBAGENT_TEAMLEAD_RESEARCH_AUDIT.md is missing required heading "${required}"`);
      }
    }
  }

  const prTemplate = assertGovernanceFile(".github/PULL_REQUEST_TEMPLATE.md");
  if (prTemplate) {
    if (!hasHeading(prTemplate, "Agent Change Notice")) {
      fail('.github/PULL_REQUEST_TEMPLATE.md is missing heading "Agent Change Notice"');
    }
    if (!/\bAGENT_CHANGE_NOTICE\b/.test(prTemplate)) {
      fail(".github/PULL_REQUEST_TEMPLATE.md must include AGENT_CHANGE_NOTICE");
    }
  }

  const codeowners = assertGovernanceFile(".github/CODEOWNERS");
  if (codeowners && !/@Yehor212\b/.test(codeowners)) {
    warn(".github/CODEOWNERS does not mention @Yehor212; verify owner review routing");
  }

  const driftWorkflow = assertGovernanceFile(".github/workflows/drift-checks.yml");
  if (driftWorkflow) {
    if (!/npm run ai:ruflow-plus:check/.test(driftWorkflow)) {
      fail("drift-checks.yml must run npm run ai:ruflow-plus:check");
    }
    if (!/npm run enforcement:check/.test(driftWorkflow)) {
      fail("drift-checks.yml must run npm run enforcement:check");
    }
    if (!/npm run check:subagent-governance/.test(driftWorkflow)) {
      fail("drift-checks.yml must run npm run check:subagent-governance");
    }
  }

  const claudeSettings = assertGovernanceFile(".claude/settings.json");
  if (claudeSettings) {
    if (!/"PreToolUse"/.test(claudeSettings)) {
      fail(".claude/settings.json must register PreToolUse hooks");
    }
    if (!/\.claude\/hooks\/tool-guard\.cjs/.test(claudeSettings)) {
      fail(".claude/settings.json must register tool-guard.cjs");
    }
    if (!/\.claude\/hooks\/protected-files\.cjs/.test(claudeSettings)) {
      fail(".claude/settings.json must register protected-files.cjs");
    }
  }

  if (isTracked(".claude/settings.local.json")) {
    fail(".claude/settings.local.json must stay untracked; local agent permissions are machine-local");
  }

  const toolGuard = assertGovernanceFile(".claude/hooks/tool-guard.cjs");
  if (toolGuard && !/BLOCKED_PARSE_ERROR/.test(toolGuard)) {
    fail("tool-guard.cjs must fail closed on malformed hook input");
  }

  const protectedFiles = assertGovernanceFile(".claude/hooks/protected-files.cjs");
  if (protectedFiles) {
    for (const marker of ["AGENTS.md", ".Codex-md-unlock", ".claude-md-unlock"]) {
      if (!protectedFiles.includes(marker)) {
        fail(`protected-files.cjs must protect or recognize ${marker}`);
      }
    }
  }

  const pkg = assertGovernanceFile("package.json");
  if (pkg && !/"security:scan"\s*:/.test(pkg)) {
    fail('package.json must define "security:scan" for Snyk/audit fallback');
  }
  if (pkg && !/"check:subagent-governance"\s*:/.test(pkg)) {
    fail('package.json must define "check:subagent-governance"');
  }

  const subagentCheck = assertGovernanceFile("scripts/check-subagent-teamlead-governance.mjs");
  if (subagentCheck) {
    for (const marker of ["Subagent Safety Contract", "Runtime Availability Rule", "Tool Availability Rule"]) {
      if (!subagentCheck.includes(marker)) {
        fail(`scripts/check-subagent-teamlead-governance.mjs must enforce ${marker}`);
      }
    }
  }

  const telegramWorkflow = assertGovernanceFile(".github/workflows/telegram-control.yml");
  if (telegramWorkflow) {
    if (/git add -A/.test(telegramWorkflow)) {
      fail("telegram-control.yml must not use git add -A");
    }
    if (/--body[\s\S]{0,500}Prompt:\\n\$\{PROMPT\}/.test(telegramWorkflow)) {
      fail("telegram-control.yml must not write the raw Telegram prompt into PR bodies");
    }
    for (const marker of ["Prompt SHA256", "Sensitive staged path", "Secret-like staged diff"]) {
      if (!telegramWorkflow.includes(marker)) {
        fail(`telegram-control.yml must include ${marker} guard`);
      }
    }
  }
}

async function assertContextManifest() {
  const serverPath = pathToFileURL(path.join(repoRoot, "tools/zenflow-context/server.mjs")).href;
  const { getZenflowContext, getZenflowContextManifest } = await import(serverPath);
  const manifest = getZenflowContextManifest();
  const seenProfiles = new Set();

  for (const profile of manifest) {
    if (seenProfiles.has(profile.id)) {
      fail(`Duplicate ZenFlow context profile id: ${profile.id}`);
    }
    seenProfiles.add(profile.id);

    for (const section of profile.sections) {
      if (!existsSync(path.join(repoRoot, section.file))) {
        fail(`Context profile ${profile.id} references missing file ${section.file}`);
        continue;
      }
      if (isIgnored(section.file) && !isTracked(section.file)) {
        fail(`Context profile ${profile.id} references ignored untracked file ${section.file}`);
      }
      const source = read(section.file);
      assertNoSecrets(section.file, source);
      for (const heading of section.headings) {
        if (!hasHeading(source, heading)) {
          fail(`Context profile ${profile.id} references missing heading "${heading}" in ${section.file}`);
        }
      }
    }

    const pack = await getZenflowContext({
      contextId: profile.id,
      task: "agent context verification",
      maxChars: 12000,
    });
    assertNoSecrets(`context pack ${profile.id}`, pack);
  }
}

async function main() {
  const agents = assertTrackedInstructionFile("AGENTS.md");
  const claude = assertTrackedInstructionFile("CLAUDE.md");

  if (agents) {
    assertSizeBudget("AGENTS.md", agents, MAX_AGENTS_BYTES, MAX_AGENTS_LINES);
    assertNoSecrets("AGENTS.md", agents);
    for (const required of [
      "Snyk Security At Inception",
      "Architecture",
      "Agent Entry Points",
      "Ruflow+ And Work Mode",
      "Agent Change Governance",
      "Snyk And Security Fallback",
    ]) {
      if (!hasHeading(agents, required)) {
        fail(`AGENTS.md is missing required heading "${required}"`);
      }
    }
  }

  if (claude) {
    assertSizeBudget("CLAUDE.md", claude, MAX_CLAUDE_BYTES, MAX_CLAUDE_LINES);
    assertNoSecrets("CLAUDE.md", claude);
    if (!/^@AGENTS\.md\s*$/m.test(claude)) {
      fail("CLAUDE.md must import AGENTS.md using @AGENTS.md");
    }
    if ((claude.match(/^#{1,6}\s+/gm) || []).length > 2) {
      warn("CLAUDE.md has more headings than expected for a thin bridge");
    }
  }

  assertNoRepoIgnoreForCanonicalFiles();
  assertLocalMcpBoundary();
  assertAgentChangeGovernance(agents);

  for (const example of [
    "tools/zenflow-context/mcp-server.example.json",
  ]) {
    if (existsSync(path.join(repoRoot, example))) {
      assertNoSecrets(example, read(example));
    }
  }

  await assertContextManifest();

  for (const message of warnings) {
    console.warn(`[agent-context] warning: ${message}`);
  }

  if (failures.length > 0) {
    console.error("[agent-context] FAIL");
    for (const message of failures) {
      console.error(`- ${message}`);
    }
    process.exit(1);
  }

  console.log("[agent-context] OK");
}

await main();
