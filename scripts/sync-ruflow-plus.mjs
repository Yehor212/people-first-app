import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const templateRoot = path.join(rootDir, "tools", "ruflow-plus", "templates");
const mode = process.argv.includes("--write") ? "write" : "check";

const desiredEnv = {
  RUFLOW_PLUS_DEFAULT_MODE: "hierarchical",
  RUFLOW_PLUS_MAX_WORKERS_MEDIUM: "3",
  RUFLOW_PLUS_MAX_WORKERS_LARGE: "5",
  RUFLOW_PLUS_REQUIRE_WRITTEN_PLAN: "1",
  RUFLOW_PLUS_REQUIRE_VERIFICATION: "1",
  RUFLOW_PLUS_REQUIRE_LEARNING_WRITEBACK: "1",
  RUFLOW_PLUS_PREFLIGHT_TEMPLATE: "docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md",
  RUFLOW_PLUS_MIN_PREFLIGHT_DEPTH: "L2",
  RUFLOW_PLUS_REQUIRE_PLATFORM_MATRIX: "1",
  RUFLOW_PLUS_REQUIRE_ANTI_PATTERN_SCAN: "1",
  RUFLOW_PLUS_REQUIRE_GO_STOP_ASK: "1",
  RUFLOW_PLUS_VERIFY_TIME_SENSITIVE_EXTERNALS: "1",
  RUFLOW_PLUS_ROLE_DIR: ".Codex/agents",
  RUFLOW_PLUS_LEARNING_RECORD: "docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md",
  ZENFLOW_CONTEXT_AUTO: "1",
  ZENFLOW_CONTEXT_AUTO_MAX_CHARS: "8500",
  ZENFLOW_CONTEXT_CURRENT: ".Codex/auto-context/current.md",
  ZENFLOW_CONTEXT_MCP_SERVER: "zenflow-context",
};

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(fullPath);
      }
      return [fullPath];
    }),
  );
  return files.flat();
}

async function ensureDirFor(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

function finalize(text) {
  return `${normalize(text).trimEnd()}\n`;
}

function quote(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function upsertSectionKey(content, sectionName, key, value) {
  const normalized = normalize(content);
  const sectionHeader = `[${sectionName}]`;
  const lines = normalized === "" ? [] : normalized.split("\n");

  let sectionStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === sectionHeader) {
      sectionStart = i;
      break;
    }
  }

  if (sectionStart === -1) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push(sectionHeader, `${key} = ${value}`);
    return finalize(lines.join("\n"));
  }

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i += 1) {
    if (/^\s*\[.*\]\s*$/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  const keyRegex = new RegExp(`^\\s*${key}\\s*=`);
  for (let i = sectionStart + 1; i < sectionEnd; i += 1) {
    if (keyRegex.test(lines[i])) {
      lines[i] = `${key} = ${value}`;
      return `${lines.join("\n")}\n`;
    }
  }

  let insertAt = sectionEnd;
  while (insertAt > sectionStart + 1 && lines[insertAt - 1].trim() === "") {
    insertAt -= 1;
  }
  lines.splice(insertAt, 0, `${key} = ${value}`);
  return finalize(lines.join("\n"));
}

function ensureConfigContent(content) {
  let next = content;
  next = upsertSectionKey(next, "shell_environment_policy", "inherit", quote("core"));

  for (const [key, value] of Object.entries(desiredEnv)) {
    next = upsertSectionKey(next, "shell_environment_policy.set", key, quote(value));
  }

  return finalize(next);
}

async function syncTemplateFiles() {
  const templateFiles = await listFiles(templateRoot);
  const mismatches = [];

  for (const sourcePath of templateFiles) {
    const relativePath = path.relative(templateRoot, sourcePath);
    const targetPath = path.join(rootDir, relativePath);
    const source = normalize(await readFile(sourcePath, "utf8"));
    let target = "";

    try {
      target = normalize(await readFile(targetPath, "utf8"));
    } catch {
      target = "";
    }

    if (target !== source) {
      mismatches.push(relativePath);
      if (mode === "write") {
        await ensureDirFor(targetPath);
        await writeFile(targetPath, source, "utf8");
      }
    }
  }

  return mismatches;
}

async function syncConfig() {
  const configPath = path.join(rootDir, ".Codex", "config.toml");
  let current = "";
  try {
    current = await readFile(configPath, "utf8");
  } catch {
    current = "";
  }

  const next = ensureConfigContent(current);
  const changed = finalize(current) !== next;

  if (changed && mode === "write") {
    await ensureDirFor(configPath);
    await writeFile(configPath, next, "utf8");
  }

  return changed;
}

async function main() {
  try {
    const templateStats = await stat(templateRoot);
    if (!templateStats.isDirectory()) {
      throw new Error(`Template root missing: ${templateRoot}`);
    }
  } catch (error) {
    console.error(`[ruflow-plus] ${error.message}`);
    process.exit(1);
  }

  const mismatches = await syncTemplateFiles();
  const configChanged = await syncConfig();

  if (mode === "write") {
    console.log(
      `[ruflow-plus] synced ${mismatches.length} template file(s); config ${configChanged ? "updated" : "already current"}.`,
    );
    return;
  }

  if (mismatches.length === 0 && !configChanged) {
    console.log("[ruflow-plus] check passed; local files and config are in sync.");
    return;
  }

  if (mismatches.length > 0) {
    console.error("[ruflow-plus] template mismatches:");
    for (const relativePath of mismatches) {
      console.error(`- ${relativePath}`);
    }
  }
  if (configChanged) {
    console.error("[ruflow-plus] .Codex/config.toml is missing one or more Ruflow+ defaults.");
  }
  process.exit(1);
}

await main();
