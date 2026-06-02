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
