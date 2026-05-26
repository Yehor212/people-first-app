import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const targets = [
  "tools/telegram-control",
  ".github/workflows/telegram-control.yml",
  "docs/ai/TELEGRAM_CONTROL_PLANE.md",
  "docs/ai/TELEGRAM_CONTROL_COMPLETION_AUDIT.md",
];

const patterns: Array<{ name: string; pattern: RegExp }> = [
  { name: "OpenAI API key", pattern: /\bsk-(?:proj-|admin-)?[A-Za-z0-9_-]{24,}\b/g },
  { name: "Telegram bot token", pattern: /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g },
  { name: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9_.-]{30,}|github_pat_[A-Za-z0-9_.-]{20,})\b/g },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

const allowedLongLiterals = new Set([
  "REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID",
  "comma-separated-telegram-user-ids",
  "set-in-cloudflare-secret",
  "set-in-cloudflare-secret-and-github-secret",
]);

const findings: Array<{ file: string; name: string; match: string }> = [];

for (const target of targets) {
  const fullPath = resolve(root, target);
  if (!existsSync(fullPath)) {
    continue;
  }
  for (const file of enumerateFiles(fullPath)) {
    const content = readFileSync(file, "utf8");
    for (const { name, pattern } of patterns) {
      pattern.lastIndex = 0;
      for (const match of content.matchAll(pattern)) {
        const value = match[0] ?? "";
        if (isAllowed(value)) {
          continue;
        }
        findings.push({ file: relative(root, file).replaceAll("\\", "/"), name, match: redact(value) });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Telegram control secret guard FAIL");
  for (const finding of findings) {
    console.error(`${finding.file}: ${finding.name} ${finding.match}`);
  }
  process.exit(1);
}

console.log("Telegram control secret guard PASS - no token-shaped values found in control-plane files.");

function* enumerateFiles(path: string): Generator<string> {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (isTextFile(path)) {
      yield path;
    }
    return;
  }

  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === ".wrangler") {
      continue;
    }
    yield* enumerateFiles(join(path, entry));
  }
}

function isTextFile(path: string): boolean {
  return /\.(?:cjs|css|d\.ts|html|json|jsonc|md|mjs|ts|tsx|txt|yml|yaml|example)$/.test(path);
}

function isAllowed(value: string): boolean {
  if (allowedLongLiterals.has(value)) {
    return true;
  }
  if (/^[0-9a-f]{64}$/i.test(value)) {
    return true;
  }
  return false;
}

function redact(value: string): string {
  if (value.length <= 10) {
    return "[redacted]";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
