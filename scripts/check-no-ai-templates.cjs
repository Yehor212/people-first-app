#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".scss",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const SCAN_PREFIXES = [
  ".github/",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs/",
  "scripts/",
  "src/",
  "tools/",
];

const SCAN_ALLOWLIST = new Set([
  "AGENTS.md",
  "docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md",
  "scripts/check-no-ai-templates.cjs",
  "scripts/__tests__/no-ai-templates-policy.test.ts",
]);

const SKIP_PREFIXES = [
  ".git/",
  ".codex/auto-context/",
  "coverage/",
  "dist/",
  "node_modules/",
  "output/",
  "playwright-report/",
  "public/sounds/",
  "test-results/",
];

const TEMPLATE_MARKERS = [
  { label: "lorem ipsum placeholder", pattern: /\blorem ipsum\b/i },
  { label: "copy goes here placeholder", pattern: /\bcopy goes here\b/i },
  { label: "as an AI language model", pattern: /\bas an ai language model\b/i },
  {
    label: "AI-generated placeholder",
    pattern: /\bAI-generated (?:placeholder|template|content)\b/i,
  },
  {
    label: "TODO replace real content",
    pattern: /TODO:\s*replace (?:with )?(?:real|actual|this)/i,
  },
  { label: "your app name placeholder", pattern: /\byour app name\b/i },
  { label: "insert real copy", pattern: /\binsert (?:real|actual) copy here\b/i },
  { label: "generic wellness app", pattern: /\bgeneric wellness app\b/i },
];
const LIFECYCLE_ENTRYPOINTS = Object.freeze({
  UserPromptSubmit: "skill-router-gate.cjs",
  PreToolUse: "agent-workspace-guard.cjs",
  PostToolUse: "production-data-integrity-gate.cjs",
  Stop: "no-ai-template-gate.cjs",
  SubagentStart: "subagent-evidence-gate.cjs",
  SubagentStop: "subagent-evidence-gate.cjs",
});

function parseArgs(argv) {
  if (argv.length > 0) {
    throw new Error("Unknown argument: " + argv[0]);
  }
  return { rootDir: process.cwd() };
}

function normalizePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function readText(rootDir, relativePath, failures) {
  const file = path.join(rootDir, relativePath);
  if (!fs.existsSync(file)) {
    failures.push(relativePath + " is missing");
    return "";
  }
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function requireIncludes(relativePath, text, snippets, failures) {
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      failures.push(relativePath + " is missing required no-ai-template marker: " + snippet);
    }
  }
}

function requirePattern(relativePath, text, label, pattern, failures) {
  if (!pattern.test(text)) {
    failures.push(relativePath + " is missing required no-ai-template pattern: " + label);
  }
}

function hookFilename(command) {
  const match = String(command || "")
    .replace(/\\/g, "/")
    .match(/\.codex\/hooks\/([A-Za-z0-9._-]+\.cjs)/);
  return match?.[1] || "";
}

function validateLifecycleTopology(text, failures) {
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    failures.push(".codex/hooks.json must be valid JSON");
    return;
  }

  const commands = [];
  for (const [event, groups] of Object.entries(config.hooks || {})) {
    for (const group of groups || []) {
      for (const hook of group.hooks || []) {
        if (hook.type !== "command") {
          failures.push(`.codex/hooks.json has unsupported ${event} hook type`);
          continue;
        }
        commands.push({ event, hook, filename: hookFilename(hook.command) });
      }
    }
  }

  if (commands.length !== 6) {
    failures.push(
      `.codex/hooks.json must register exactly 6 lifecycle commands; found ${commands.length}`
    );
  }
  for (const [event, expectedFilename] of Object.entries(LIFECYCLE_ENTRYPOINTS)) {
    const eventCommands = commands.filter((entry) => entry.event === event);
    if (eventCommands.length !== 1) {
      failures.push(`.codex/hooks.json must register exactly one ${event} command`);
      continue;
    }
    if (eventCommands[0].filename !== expectedFilename) {
      failures.push(`.codex/hooks.json ${event} must use ${expectedFilename}`);
    }
    if (hookFilename(eventCommands[0].hook.commandWindows) !== expectedFilename) {
      failures.push(`.codex/hooks.json ${event} commandWindows must use ${expectedFilename}`);
    }
  }
  for (const entry of commands) {
    if (!(entry.event in LIFECYCLE_ENTRYPOINTS)) {
      failures.push(`.codex/hooks.json has an unexpected command for ${entry.event}`);
    }
    if (entry.filename === "change-governance-gate.cjs") {
      failures.push(
        ".codex/hooks.json must not register the removed standalone change-governance hook"
      );
    }
  }
}

function listFilesFromGit(rootDir) {
  try {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      {
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    );
    return output.split("\0").filter(Boolean).map(normalizePath);
  } catch {
    return null;
  }
}

function walkFiles(rootDir, dir = rootDir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = normalizePath(path.relative(rootDir, absolute));
    if (entry.isDirectory()) {
      if (
        !SKIP_PREFIXES.some(
          (prefix) => relative === prefix.slice(0, -1) || relative.startsWith(prefix)
        )
      ) {
        walkFiles(rootDir, absolute, files);
      }
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

function listCandidateFiles(rootDir) {
  const files = listFilesFromGit(rootDir) || walkFiles(rootDir);
  return [...new Set(files)].filter(isDurableTextSurface);
}

function isDurableTextSurface(relativePath) {
  const normalized = normalizePath(relativePath);
  if (SCAN_ALLOWLIST.has(normalized)) return false;
  if (SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (!SCAN_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix)))
    return false;
  if (normalized === ".github/PULL_REQUEST_TEMPLATE.md") return true;
  if (["AGENTS.md", "CLAUDE.md", "README.md"].includes(normalized)) return true;
  return TEXT_EXTENSIONS.has(path.extname(normalized));
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split("\n").length;
}

function previewMatch(value) {
  return value.replace(/\s+/g, " ").slice(0, 80);
}

function scanForTemplateMarkers(rootDir, failures) {
  for (const relativePath of listCandidateFiles(rootDir)) {
    const absolute = path.join(rootDir, relativePath);
    let text;
    try {
      text = fs.readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    for (const marker of TEMPLATE_MARKERS) {
      const match = marker.pattern.exec(text);
      if (match) {
        failures.push(
          relativePath +
            ":" +
            lineNumberFor(text, match.index) +
            " has AI-template marker (" +
            marker.label +
            ') near "' +
            previewMatch(match[0]) +
            '"'
        );
      }
    }
  }
}

function validateNoAiTemplatesPolicy(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const failures = [];

  const agents = readText(rootDir, "AGENTS.md", failures);
  const policy = readText(rootDir, "docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md", failures);
  const packageText = readText(rootDir, "package.json", failures);
  const prTemplate = readText(rootDir, ".github/PULL_REQUEST_TEMPLATE.md", failures);
  const driftWorkflow = readText(rootDir, ".github/workflows/drift-checks.yml", failures);
  const agentContext = readText(rootDir, "scripts/check-agent-context.mjs", failures);
  const testFile = readText(rootDir, "scripts/__tests__/no-ai-templates-policy.test.ts", failures);
  const hookTestFile = readText(rootDir, "scripts/__tests__/no-ai-template-hook.test.ts", failures);
  const codexHooks = readText(rootDir, ".codex/hooks.json", failures);
  const noAiHook = readText(rootDir, ".codex/hooks/no-ai-template-gate.cjs", failures);
  const promptRouter = readText(rootDir, ".codex/hooks/skill-router-gate.cjs", failures);
  const subagentHook = readText(rootDir, ".codex/hooks/subagent-evidence-gate.cjs", failures);

  requireIncludes(
    "AGENTS.md",
    agents,
    [
      "No AI Templates Agent Gate",
      "docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md",
      "npm run check:no-ai-templates",
      "ИИ шаблоны",
      "ZenFlow Idea Quality Gate",
      "Do not answer brainstorming requests with standalone feature-name lists",
      "Best-Practices-Only Proposal Gate",
      "Do not present recommendations as best practices",
      "SubagentStart",
      "SubagentStop",
      "subagent proof laundering",
    ],
    failures
  );

  requireIncludes(
    "docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md",
    policy,
    [
      "Purpose: forbid generic AI-template work across ZenFlow agent workflows.",
      "Codex project roles, built-in workers, local subagents, connector-backed agents",
      "Source Evidence",
      "Enforcement Layers",
      "An AI template is any output that looks generated first and ZenFlow-specific second.",
      "Templates, starter snippets, component examples, and generated drafts are allowed only as private scaffolding.",
      "ZenFlow Idea Quality Gate",
      "Feature-name lists are not product ideas",
      "user failure mode",
      "local ZenFlow evidence",
      "acceptance or kill criteria",
      "Best-Practices-Only Proposal Gate",
      "best-practices laundering",
      "source-backed applicability",
      "tradeoffs and rejection criteria",
      "verification path",
      "npm run check:no-ai-templates",
      "npm run check:agent-context",
      "https://www.nist.gov/itl/ai-risk-management-framework",
      "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
      "https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html",
      "https://developers.openai.com/codex/guides/agents-md",
      "https://developers.openai.com/codex/hooks",
      "https://developers.openai.com/codex/subagents",
      "https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html",
      "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches",
      "https://google.github.io/eng-practices/review/developer/small-cls.html",
      "https://pair.withgoogle.com/chapter/user-needs/",
      "UNVERIFIED",
      "custom ZenFlow roles",
    ],
    failures
  );
  requirePattern(
    "docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md",
    policy,
    "forbidden placeholder examples",
    /lorem ipsum|TODO-as-deliverable|TBD-as-deliverable|coming soon/i,
    failures
  );
  requirePattern(
    "docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md",
    policy,
    "subagent rubric requirement",
    /subagent/i,
    failures
  );

  validateLifecycleTopology(codexHooks, failures);

  requireIncludes(
    ".codex/hooks/no-ai-template-gate.cjs",
    noAiHook,
    [
      "NO AI TEMPLATE GATE",
      "Best-Practices-Only Proposal Gate",
      "best-practices laundering",
      "source-backed applicability",
      "detectViolations",
      "evaluatePdiStop",
      "productionDataIntegrityContext",
      "process.exit(2)",
    ],
    failures
  );

  requireIncludes(
    ".codex/hooks/skill-router-gate.cjs",
    promptRouter,
    [
      "buildSkillRoutingContext",
      "buildPromptContext",
      "isNoTemplatePromptRelevant",
      "isPdiPromptRelevant",
      "if (!additionalContext)",
      "process.exit(2)",
    ],
    failures
  );

  requireIncludes(
    ".codex/hooks/subagent-evidence-gate.cjs",
    subagentHook,
    [
      "evaluateSubagentEvidence",
      "detectSubagentViolations",
      "loadProjectRoleNames",
      "PDI_TRUST_CONTEXT",
      "process.exit(2)",
    ],
    failures
  );

  requireIncludes(
    ".github/PULL_REQUEST_TEMPLATE.md",
    prTemplate,
    ["No AI-template output", "npm run check:no-ai-templates"],
    failures
  );

  requireIncludes(
    ".github/workflows/drift-checks.yml",
    driftWorkflow,
    [
      "name: no-ai-templates",
      "npm run check:no-ai-templates",
      "scripts/check-no-ai-templates.cjs",
      "scripts/__tests__/no-ai-templates-policy.test.ts",
    ],
    failures
  );

  requireIncludes(
    "scripts/check-agent-context.mjs",
    agentContext,
    [
      "assertNoAiTemplatesGateContract",
      "NO_AI_TEMPLATES_AGENT_POLICY.md",
      "npm run check:no-ai-templates",
    ],
    failures
  );

  requireIncludes(
    "scripts/__tests__/no-ai-templates-policy.test.ts",
    testFile,
    [
      "Source Evidence",
      "No AI-template output",
      "rejects obvious AI-template markers",
      "ZenFlow Idea Quality Gate",
      "Best-Practices-Only Proposal Gate",
    ],
    failures
  );

  requireIncludes(
    "scripts/__tests__/no-ai-template-hook.test.ts",
    hookTestFile,
    [
      "no-ai-template-gate.cjs",
      "UserPromptSubmit",
      "Stop",
      "SubagentStart",
      "SubagentStop",
      "SUBAGENT EVIDENCE CONTRACT",
      "subagent proof laundering",
      "best-practices laundering",
    ],
    failures
  );

  let packageJson = null;
  if (packageText) {
    try {
      packageJson = JSON.parse(packageText);
    } catch (error) {
      failures.push("package.json is not valid JSON: " + error.message);
    }
  }

  if (!packageJson?.scripts?.["check:no-ai-templates"]) {
    failures.push('package.json must define "check:no-ai-templates"');
  } else if (
    packageJson.scripts["check:no-ai-templates"] !== "node scripts/check-no-ai-templates.cjs"
  ) {
    failures.push(
      'package.json script "check:no-ai-templates" must run node scripts/check-no-ai-templates.cjs'
    );
  }

  if (
    !String(packageJson?.scripts?.["ci:preflight"] || "").includes("npm run check:no-ai-templates")
  ) {
    failures.push('package.json script "ci:preflight" must include npm run check:no-ai-templates');
  }

  if (!fs.existsSync(path.join(rootDir, "scripts/check-no-ai-templates.cjs"))) {
    failures.push("scripts/check-no-ai-templates.cjs is missing");
  }

  scanForTemplateMarkers(rootDir, failures);

  return { ok: failures.length === 0, failures };
}

function main() {
  let rootDir;
  try {
    ({ rootDir } = parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error("[no-ai-templates] FAIL");
    console.error("- " + error.message);
    process.exitCode = 1;
    return;
  }

  const result = validateNoAiTemplatesPolicy({ rootDir });
  if (!result.ok) {
    console.error("[no-ai-templates] FAIL");
    for (const failure of result.failures) {
      console.error("- " + failure);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    "[no-ai-templates] PASS - policy, consolidated Codex lifecycle wiring, custom-role evidence gate, AGENTS.md, PR review, drift CI, agent-context, package wiring, and obvious template markers verified."
  );
}

if (require.main === module) {
  main();
}

module.exports = { validateNoAiTemplatesPolicy, scanForTemplateMarkers };
