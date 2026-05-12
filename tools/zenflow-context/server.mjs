#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot =
  process.env.ZENFLOW_CONTEXT_ROOT || path.resolve(__dirname, "..", "..");

const DEFAULT_MAX_CHARS = 12000;
const MAX_ALLOWED_CHARS = 30000;

const contextProfiles = {
  startup: {
    label: "Session Startup",
    purpose: "Recover project rules, architecture anchors, memory policy, and verification discipline.",
    keywords: [
      "start",
      "session",
      "context",
      "memory",
      "память",
      "agent",
      "agents",
      "агент",
      "агенты",
      "ruflow",
      "audit",
      "аудит",
      "verification",
      "проверка",
      "верификация",
    ],
    sections: [
      { file: "AGENTS.md", headings: ["Architecture", "Conventions", "Safety", "CI", "Work Mode"] },
      { file: "ARCHITECTURE.md", headings: ["Codebase Metrics", "Tech Stack", "State Management", "Data Flow"] },
      { file: "docs/ai/SYNC_CONTRACT.md", headings: ["North Star", "Non-Negotiable Invariants", "Required Verification For Sync Changes"] },
      { file: "docs/ai/AGENT_CONTEXT_PERSISTENCE.md", headings: ["Session Start Protocol", "Context7-Style Retrieval", "Writeback Protocol", "Verification"] },
      { file: "docs/ai/RUFLOW_PLUS_REPO_INTEGRATION.md", headings: ["Persistent Agent Context", "Shell Environment Defaults"] },
    ],
    scripts: ["doc-counts", "ai:ruflow-plus:check", "ai:context:check", "check:all"],
  },
  memory: {
    label: "Agent Memory",
    purpose: "Recover how cross-session memory, writeback, and MCP context retrieval should work.",
    keywords: ["memory", "память", "context", "контекст", "mcp", "context7", "writeback", "lesson", "урок", "session", "сессия", "agent", "агент"],
    sections: [
      { file: "docs/ai/AGENT_CONTEXT_PERSISTENCE.md", headings: ["Research-Backed Decision", "Context7-Style Retrieval", "Local MCP Memory Setup", "Writeback Protocol", "Memory Taxonomy"] },
      { file: "docs/ai/RUFLOW_PLUS_BLUEPRINT.md", headings: ["Learning Loop", "Evidence Checklist"] },
      { file: "docs/ai/RUFLOW_PLUS_REPO_INTEGRATION.md", headings: ["Persistent Agent Context"] },
      { file: "tools/zenflow-context/README.md", headings: ["Tools", "How Agents Should Use It"] },
    ],
    scripts: ["ai:context", "ai:context:check", "ai:ruflow-plus:check"],
  },
  architecture: {
    label: "Architecture And State",
    purpose: "Recover app structure, stores, hydrate bridges, storage, sync, and architecture constraints.",
    keywords: ["architecture", "архитектура", "store", "zustand", "dexie", "indexeddb", "sync", "синхронизация", "supabase", "state", "состояние", "index"],
    sections: [
      { file: "AGENTS.md", headings: ["Architecture", "Safety"] },
      { file: "ARCHITECTURE.md", headings: ["Codebase Metrics", "Folder Structure", "State Management", "Data Flow", "Storage Rules"] },
      { file: "docs/ai/SYNC_CONTRACT.md", headings: ["North Star", "Non-Negotiable Invariants", "Files To Inspect Before Sync Work", "Required Verification For Sync Changes", "Current Known Gaps"] },
      { file: "docs/ai/RUFLOW_PLUS_BLUEPRINT.md", headings: ["Anti-Drift Contract"] },
    ],
    scripts: ["doc-counts", "check:types-fresh", "check:supabase-migration-prefixes", "ai:ruflow-plus:check"],
  },
  ui: {
    label: "UI, Motion, Accessibility",
    purpose: "Recover visual rules, cross-platform UI requirements, motion/a11y constraints, and verification routes.",
    keywords: ["ui", "интерфейс", "visual", "визуал", "motion", "анимация", "accessibility", "доступность", "rtl", "i18n", "mobile", "android", "ios", "touch", "theme", "тема"],
    sections: [
      { file: "AGENTS.md", headings: ["Conventions", "Safety", "CI"] },
      { file: "ARCHITECTURE.md", headings: ["UI Design Constraints", "Performance & Motion", "i18n"] },
      { file: "docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md", headings: ["Risk Depth", "Visual Audit Matrix", "Verification Plan"] },
    ],
    scripts: ["check:colors", "check:visual", "i18n:check", "i18n:deep", "test:e2e"],
  },
  verification: {
    label: "Verification And CI",
    purpose: "Recover quality gates, blocked-path handling, and evidence discipline.",
    keywords: ["verify", "verification", "проверка", "верификация", "ci", "test", "тест", "lint", "typecheck", "gate", "evidence", "доказательство", "regression", "регрессия", "audit", "аудит", "hooks", "хуки"],
    sections: [
      { file: "AGENTS.md", headings: ["CI", "Commit Pipeline", "Enforcement"] },
      { file: "docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md", headings: ["Verification Plan", "Evidence", "GO / STOP / ASK"] },
      { file: "docs/ai/RUFLOW_PLUS_BLUEPRINT.md", headings: ["Evidence Checklist", "Completion Standard"] },
      { file: "docs/ai/AGENT_CONTEXT_PERSISTENCE.md", headings: ["Verification"] },
    ],
    scripts: ["typecheck", "lint", "check:all", "ci:preflight", "ci:remote", "ci:remote:wait"],
  },
  external_docs: {
    label: "External Library Docs",
    purpose: "Route framework/library questions to Context7 and current official docs before implementation.",
    keywords: ["react", "vite", "capacitor", "supabase", "firebase", "sentry", "tailwind", "radix", "library", "библиотека", "docs", "доки"],
    sections: [
      { file: "AGENTS.md", headings: ["Stack", "Safety"] },
      { file: "docs/ai/AGENT_CONTEXT_PERSISTENCE.md", headings: ["Source Links", "Context7-Style Retrieval"] },
    ],
    scripts: ["ai:context"],
  },
};

const toolDefinitions = [
  {
    name: "resolve_zenflow_context",
    description:
      "Resolve a user task into one or more ZenFlow context pack IDs, similar to Context7 library resolution.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The user's task or question." },
        maxContexts: { type: "number", description: "Maximum number of matching context packs to return." },
      },
      required: ["task"],
    },
  },
  {
    name: "get_zenflow_context",
    description:
      "Return a compact, source-backed ZenFlow context pack for the selected context ID and task.",
    inputSchema: {
      type: "object",
      properties: {
        contextId: {
          type: "string",
          description: "Context ID returned by resolve_zenflow_context, or 'auto'.",
        },
        task: { type: "string", description: "The user's task or question." },
        maxChars: { type: "number", description: "Soft character budget for the returned context pack." },
      },
      required: ["contextId"],
    },
  },
  {
    name: "record_zenflow_lesson",
    description:
      "Append a concise reusable lesson to ZenFlow local context memory. Do not use for secrets or raw transcripts.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["decision", "environment_fact", "quality_rule", "operator_protocol", "failure", "success_pattern"],
        },
        summary: { type: "string", description: "One short reusable fact." },
        evidence: { type: "string", description: "Optional file, command, or source evidence." },
      },
      required: ["category", "summary"],
    },
  },
  {
    name: "list_zenflow_contexts",
    description: "List available ZenFlow context pack IDs and their purpose.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

function sanitize(text) {
  return String(text)
    .replace(/ghp_[A-Za-z0-9_]+/g, "ghp_***")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "github_pat_***")
    .replace(/sbp_[A-Za-z0-9_]+/g, "sbp_***")
    .replace(/ctx7sk-[A-Za-z0-9_-]+/g, "ctx7sk-***")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-***")
    .replace(/(Authorization:\s*Bearer\s+)[^\s`'"]+/gi, "$1***");
}

function normalize(text) {
  return sanitize(text).replace(/\r\n/g, "\n");
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function abs(relativePath) {
  return path.join(repoRoot, relativePath);
}

function clampMaxChars(maxChars) {
  if (!Number.isFinite(maxChars)) {
    return DEFAULT_MAX_CHARS;
  }
  return Math.max(2000, Math.min(MAX_ALLOWED_CHARS, Math.floor(maxChars)));
}

function termsFor(task) {
  return String(task || "")
    .toLowerCase()
    .replace(/[^a-zа-яёіїєґ0-9_:+/.-]+/gi, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 3)
    .slice(0, 24);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

async function readText(relativePath) {
  try {
    return normalize(await readFile(abs(relativePath), "utf8"));
  } catch {
    return "";
  }
}

function splitLines(text) {
  return text.split("\n");
}

function findHeadingRange(lines, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRegex = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`, "i");
  const start = lines.findIndex((line) => headingRegex.test(line.trim()));
  if (start === -1) {
    return null;
  }
  const level = lines[start].match(/^(#{1,6})/)?.[1].length ?? 1;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+/);
    if (match && match[1].length <= level) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function takeExcerpt(text, maxChars) {
  const cleaned = text.trim();
  if (cleaned.length <= maxChars) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxChars).trimEnd()}\n...`;
}

function excerptHeadings(relativePath, text, headings, maxCharsPerFile) {
  const lines = splitLines(text);
  const chunks = [];
  const budgetPerHeading = Math.max(600, Math.floor(maxCharsPerFile / Math.max(1, headings.length)));

  for (const heading of headings) {
    const range = findHeadingRange(lines, heading);
    if (!range) {
      continue;
    }
    const body = lines.slice(range.start, range.end).join("\n");
    chunks.push({
      source: `${relativePath}:${range.start + 1}`,
      text: takeExcerpt(body, budgetPerHeading),
    });
  }

  if (chunks.length > 0) {
    return chunks;
  }

  return [
    {
      source: `${relativePath}:1`,
      text: takeExcerpt(text, Math.min(1600, maxCharsPerFile)),
    },
  ];
}

async function readPackageScripts(scriptNames) {
  const text = await readText("package.json");
  if (!text) {
    return [];
  }
  try {
    const pkg = JSON.parse(text);
    return scriptNames
      .filter((name) => pkg.scripts?.[name])
      .map((name) => `- \`${name}\`: \`${pkg.scripts[name]}\``);
  } catch {
    return [];
  }
}

async function readMemoryHits(task, maxItems = 8) {
  const memoryPaths = [
    ".Codex/memory/mcp-memory.jsonl",
    ".Codex/memory/zenflow-lessons.jsonl",
  ];
  const terms = termsFor(task);
  const hits = [];

  for (const relativePath of memoryPaths) {
    const text = await readText(relativePath);
    if (!text) {
      continue;
    }
    const lines = text.split("\n").filter(Boolean);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lower = line.toLowerCase();
      const score =
        terms.reduce((total, term) => total + (lower.includes(term) ? 2 : 0), 0) +
        (lower.includes("zenflow") ? 1 : 0) +
        (lower.includes("ruflow") ? 1 : 0) +
        (lower.includes("verification") ? 1 : 0);
      if (score === 0 && hits.length >= maxItems) {
        continue;
      }
      if (score > 0 || relativePath.endsWith("mcp-memory.jsonl")) {
        hits.push({
          score,
          source: `${relativePath}:${index + 1}`,
          text: takeExcerpt(formatMemoryLine(line), 700),
        });
      }
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
    .slice(0, maxItems);
}

function formatMemoryLine(line) {
  try {
    const item = JSON.parse(line);
    if (item.type === "entity") {
      return `entity ${item.name} (${item.entityType}): ${(item.observations || []).join(" ")}`;
    }
    if (item.type === "relation") {
      return `relation ${item.from} -[${item.relationType}]-> ${item.to}`;
    }
    return JSON.stringify(item);
  } catch {
    return line;
  }
}

async function walkFiles(startRelativePath, options = {}) {
  const start = abs(startRelativePath);
  if (!existsSync(start)) {
    return [];
  }
  const {
    maxFiles = 800,
    extensions = new Set([".md", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".css"]),
    skipDirs = new Set([
      ".git",
      "node_modules",
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
      "android",
      ".Codex",
      ".codex",
      ".claude",
      ".agents",
      "artifacts",
      "screenshots",
    ]),
  } = options;
  const out = [];

  async function visit(dir) {
    if (out.length >= maxFiles) {
      return;
    }
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) {
        return;
      }
      if (entry.name.startsWith(".") && entry.name !== ".github") {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          await visit(full);
        }
      } else if (extensions.has(path.extname(entry.name))) {
        out.push(rel(full));
      }
    }
  }

  await visit(start);
  return out;
}

async function relevantFileHits(task, maxItems = 10) {
  const terms = termsFor(task);
  if (terms.length === 0) {
    return [];
  }
  const files = [
    ...(await walkFiles("src", { maxFiles: 1200 })),
    ...(await walkFiles("scripts", { maxFiles: 200 })),
    ...(await walkFiles("docs", { maxFiles: 200 })),
  ];
  const hits = [];

  for (const file of files) {
    const lowerFile = file.toLowerCase();
    let score = terms.reduce((total, term) => total + (lowerFile.includes(term) ? 4 : 0), 0);
    if (score === 0) {
      const text = await readText(file);
      const lowerText = text.toLowerCase();
      score = terms.reduce((total, term) => total + (lowerText.includes(term) ? 1 : 0), 0);
    }
    if (score > 0) {
      hits.push({ file, score });
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file)).slice(0, maxItems);
}

function scoreProfile(profile, task) {
  const terms = termsFor(task);
  const keywordSet = new Set(profile.keywords);
  return terms.reduce((total, term) => total + (keywordSet.has(term) ? 4 : 0), 0) +
    profile.keywords.reduce((total, keyword) => total + (String(task).toLowerCase().includes(keyword) ? 1 : 0), 0);
}

function resolveZenflowContext({ task, maxContexts = 3 }) {
  const scored = Object.entries(contextProfiles)
    .map(([id, profile]) => ({
      id,
      label: profile.label,
      purpose: profile.purpose,
      score: scoreProfile(profile, task),
      reason:
        profile.keywords
          .filter((keyword) => String(task || "").toLowerCase().includes(keyword))
          .slice(0, 6)
          .join(", ") || "default repo context candidate",
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const selected = scored.some((item) => item.score > 0)
    ? scored
    : scored
        .map((item) =>
          item.id === "startup" ? { ...item, score: 1, reason: "default startup pack" } : item,
        )
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return selected.slice(0, Math.max(1, Math.min(8, Number(maxContexts) || 3)));
}

async function getZenflowContext({ contextId = "startup", task = "", maxChars = DEFAULT_MAX_CHARS }) {
  let selectedId = contextId;
  if (contextId === "auto") {
    selectedId = resolveZenflowContext({ task, maxContexts: 1 })[0]?.id || "startup";
  }
  if (!contextProfiles[selectedId]) {
    selectedId = "startup";
  }
  const profile = contextProfiles[selectedId];
  const budget = clampMaxChars(maxChars);
  const docBudget = Math.max(1800, Math.floor(budget * 0.55));
  const chunks = [];

  for (const section of profile.sections) {
    const text = await readText(section.file);
    if (!text) {
      continue;
    }
    chunks.push(...excerptHeadings(section.file, text, section.headings, Math.floor(docBudget / Math.max(1, profile.sections.length))));
  }

  const scripts = await readPackageScripts(profile.scripts || []);
  const memoryHits = await readMemoryHits(`${selectedId} ${task}`, 8);
  const fileHits = await relevantFileHits(task || selectedId, 10);
  const generatedAt = new Date().toISOString();
  const packLines = [
    `# ZenFlow Context Pack`,
    ``,
    `- generated_at: ${generatedAt}`,
    `- context_id: ${selectedId}`,
    `- label: ${profile.label}`,
    `- task_hash: ${hash(task || selectedId)}`,
    `- purpose: ${profile.purpose}`,
    ``,
    `## Rules`,
    ``,
    `- This pack is routing context, not proof of current command status.`,
    `- Re-verify drift-prone facts with live repo files, commands, or official docs.`,
    `- Do not load secrets or ignored environment files into agent prompts.`,
    ``,
    `## Source Excerpts`,
    ``,
    ...chunks.flatMap((chunk) => [`### ${chunk.source}`, "", chunk.text, ""]),
    `## Useful Scripts`,
    ``,
    ...(scripts.length > 0 ? scripts : ["- No matching scripts found in package.json."]),
    ``,
    `## Memory Hits`,
    ``,
    ...(memoryHits.length > 0
      ? memoryHits.flatMap((hit) => [`### ${hit.source}`, hit.text, ""])
      : ["- No local memory hits found."]),
    `## Relevant File Candidates`,
    ``,
    ...(fileHits.length > 0
      ? fileHits.map((hit) => `- ${hit.file} (score ${hit.score})`)
      : ["- No task-specific file candidates found."]),
    ``,
    `## Recommended Next Step`,
    ``,
    nextStepFor(selectedId),
  ];

  return takeExcerpt(packLines.join("\n"), budget);
}

function nextStepFor(contextId) {
  if (contextId === "external_docs") {
    return "- Use Context7 for current, version-specific library documentation, then cross-check against this repo's installed package versions.";
  }
  if (contextId === "verification") {
    return "- Run the narrowest fresh verification command that proves the claim; do not cite older green gates as current.";
  }
  if (contextId === "memory") {
    return "- Resolve context first, fetch this pack, then write back only one durable lesson after completion.";
  }
  return "- Read the cited files, then build the pre-flight or implementation plan from current repo evidence.";
}

async function recordZenflowLesson({ category, summary, evidence = "" }) {
  const allowed = new Set(["decision", "environment_fact", "quality_rule", "operator_protocol", "failure", "success_pattern"]);
  if (!allowed.has(category)) {
    throw new Error(`Unsupported category: ${category}`);
  }
  const cleanSummary = sanitize(summary).trim();
  const cleanEvidence = sanitize(evidence).trim();
  if (cleanSummary.length < 12 || cleanSummary.length > 700) {
    throw new Error("summary must be 12-700 characters");
  }
  if (/(ghp_|github_pat_|sbp_|ctx7sk-|sk-)/i.test(summary + evidence)) {
    throw new Error("lesson appears to contain a secret token");
  }
  const record = {
    type: "lesson",
    category,
    summary: cleanSummary,
    evidence: cleanEvidence,
    created_at: new Date().toISOString(),
  };
  const target = abs(".Codex/memory/zenflow-lessons.jsonl");
  await mkdir(path.dirname(target), { recursive: true });
  const existing = existsSync(target) ? await readFile(target, "utf8") : "";
  await writeFile(target, `${existing}${JSON.stringify(record)}\n`, "utf8");
  return { ok: true, path: rel(target), record };
}

function listZenflowContexts() {
  return Object.entries(contextProfiles).map(([id, profile]) => ({
    id,
    label: profile.label,
    purpose: profile.purpose,
    keywords: profile.keywords,
  }));
}

async function callTool(name, args = {}) {
  if (name === "resolve_zenflow_context") {
    return resolveZenflowContext(args);
  }
  if (name === "get_zenflow_context") {
    return await getZenflowContext(args);
  }
  if (name === "record_zenflow_lesson") {
    return await recordZenflowLesson(args);
  }
  if (name === "list_zenflow_contexts") {
    return listZenflowContexts();
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function runCli() {
  const args = process.argv.slice(3);
  const valueAfter = (flag, fallback = "") => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1] || fallback;
  };
  const task = valueAfter("--topic", valueAfter("--task", "startup context"));
  const contextId = valueAfter("--context", "auto");
  const maxChars = Number(valueAfter("--max-chars", String(DEFAULT_MAX_CHARS)));
  if (args.includes("--resolve")) {
    console.log(JSON.stringify(resolveZenflowContext({ task }), null, 2));
    return;
  }
  const pack = await getZenflowContext({ contextId, task, maxChars });
  console.log(pack);
}

function createMcpServer() {
  let buffer = Buffer.alloc(0);
  let framing = "newline";

  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      const newlineEnd = buffer.indexOf("\n");

      if (headerEnd !== -1) {
        const header = buffer.slice(0, headerEnd).toString("utf8");
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (match) {
          const length = Number(match[1]);
          const bodyStart = headerEnd + 4;
          const bodyEnd = bodyStart + length;
          if (buffer.length < bodyEnd) {
            return;
          }
          const body = buffer.slice(bodyStart, bodyEnd).toString("utf8");
          buffer = buffer.slice(bodyEnd);
          framing = "header";
          handleMessage(body, () => framing).catch((error) => {
            send({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32603, message: error.message },
            }, framing);
          });
          continue;
        }
      }

      if (newlineEnd === -1) {
        return;
      }

      const line = buffer.slice(0, newlineEnd).toString("utf8").trim();
      buffer = buffer.slice(newlineEnd + 1);
      if (!line) {
        continue;
      }
      framing = "newline";
      handleMessage(line, () => framing).catch((error) => {
        send({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32603, message: error.message },
        }, framing);
      });
    }
  });
}

function send(message, framing = "newline") {
  const body = JSON.stringify(message);
  if (framing === "header") {
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
    return;
  }
  process.stdout.write(`${body}\n`);
}

async function handleMessage(body, getFraming = () => "newline") {
  const message = JSON.parse(body);
  if (message.method?.startsWith("notifications/")) {
    return;
  }
  try {
    if (message.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: message.params?.protocolVersion || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "zenflow-context", version: "0.1.0" },
        },
      }, getFraming());
      return;
    }
    if (message.method === "ping") {
      send({ jsonrpc: "2.0", id: message.id, result: {} }, getFraming());
      return;
    }
    if (message.method === "tools/list") {
      send({ jsonrpc: "2.0", id: message.id, result: { tools: toolDefinitions } }, getFraming());
      return;
    }
    if (message.method === "tools/call") {
      const result = await callTool(message.params?.name, message.params?.arguments || {});
      const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          content: [{ type: "text", text }],
          isError: false,
        },
      }, getFraming());
      return;
    }
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32601, message: `Method not found: ${message.method}` },
    }, getFraming());
  } catch (error) {
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32603, message: error.message },
    }, getFraming());
  }
}

export {
  getZenflowContext,
  listZenflowContexts,
  recordZenflowLesson,
  resolveZenflowContext,
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  if (process.argv.includes("--cli")) {
    await runCli();
  } else {
    createMcpServer();
  }
}
