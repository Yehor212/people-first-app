#!/usr/bin/env node
/**
 * SPEC KIT SAFETY GATE
 *
 * Fail-closed local guard for ZenFlow's official Spec Kit v0.15.1 core lane.
 * Generated skills and extension/catalog content are untrusted input. This hook
 * validates bounded local state and supported command/write shapes; it is not a
 * complete shell parser, atomic policy engine, hosted-tool boundary, or proof
 * that external clients obey repository instructions.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { TextDecoder } = require("node:util");

const HOOK_NAME = "spec-kit-safety-gate";
const EXTENSIONS_POLICY = [
  "installed: []",
  "settings:",
  "  auto_execute_hooks: false",
  "hooks: {}",
  "",
].join("\n");
const CORE_SKILLS = [
  "speckit-analyze",
  "speckit-checklist",
  "speckit-clarify",
  "speckit-constitution",
  "speckit-converge",
  "speckit-implement",
  "speckit-plan",
  "speckit-specify",
  "speckit-tasks",
  "speckit-taskstoissues",
];
const CODEX_MANIFEST_PATH = ".specify/integrations/codex.manifest.json";
const SPEC_KIT_PRIORITY_CONTEXT = [
  "ZENFLOW SPEC KIT PRIORITY:",
  "- Read docs/ai/SPEC_KIT_AGENT_POLICY.md. Repository rules outrank conflicting managed skill text.",
  "- Before any constitution-consuming skill, run .specify/scripts/bash/check-zenflow-constitution-status.sh --json.",
  "- While the constitution is PROPOSED/unratified, label proposal-only items PROPOSED_CONSTITUTION_CONSIDERATION; they cannot be CRITICAL, block work, authorize implementation, or mutate tasks/remediation.",
  "- Ground sparse intent in current ZenFlow files, routes, state, and a concrete user failure mode. Industry/common defaults must not fill missing product decisions; ask only when blocking or mark them UNVERIFIED.",
  "- For first-party behavior changes, tests are mandatory and require test-first evidence/tasks even when managed skill text calls them optional.",
].join("\n");
const SHELL_TOOL = /^(?:Bash|Shell|PowerShell|pwsh|exec_command|unified_exec)$/i;
const STRUCTURED_WRITE_TOOL =
  /^(?:apply_patch|functions\.apply_patch|Edit|Write|WriteFile|CreateFile|DeleteFile|MultiEdit|StrReplaceFile|NotebookEdit)$/i;
const STRUCTURED_PATH_KEYS = new Set([
  "file",
  "file_path",
  "filepath",
  "path",
  "target",
  "target_path",
  "destination",
  "destination_path",
]);
const MAX_JSON_INPUT_BYTES = 1_048_576;
const MAX_JSON_NESTING_DEPTH = 64;
const MAX_MANAGED_SKILL_BYTES = 262_144;
const STDIN_CHUNK_BYTES = 64 * 1024;
const POWERSHELL_BARE_SYNTAX = Symbol("powershell-bare-syntax");
const decoder = new TextDecoder("utf-8", { fatal: true });

function fail(reason) {
  process.stderr.write(`HOOK ERROR [${HOOK_NAME}]: ${reason}\n`);
  process.exit(2);
}

function canonicalRepositoryRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error("unable to resolve repository root with git rev-parse");
  }
  const reported = path.resolve(result.stdout.trim());
  let canonical;
  let canonicalCwd;
  try {
    canonical = fs.realpathSync.native(reported);
    canonicalCwd = fs.realpathSync.native(process.cwd());
  } catch (error) {
    throw new Error(`repository root is unresolved or noncanonical: ${error.message || error}`);
  }
  if (reported !== canonical || !isInside(canonical, canonicalCwd)) {
    throw new Error("repository root is unresolved or noncanonical for the current lane");
  }
  return canonical;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function requireRegularFile(filePath, label, requireSingleLink = false) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    throw new Error(`${label} is missing`);
  }
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be symlinked`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if (requireSingleLink && stat.nlink !== 1) throw new Error(`${label} must not be hard-linked`);
  return stat;
}

function validateManagedDirectoryChain(root, relativePath, required = true) {
  const segments = relativePath.split("/").filter(Boolean);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (!required && error && error.code === "ENOENT") return;
      throw new Error(`managed path ${path.relative(root, current)} is missing or unreadable`);
    }
    const label = path.relative(root, current).replace(/\\/g, "/");
    if (stat.isSymbolicLink()) throw new Error(`managed path ${label} must not be symlinked`);
    if (!stat.isDirectory()) throw new Error(`managed path ${label} must be a directory`);
    let canonical;
    try {
      canonical = fs.realpathSync.native(current);
    } catch (error) {
      throw new Error(`managed path ${label} is noncanonical: ${error.message || error}`);
    }
    if (canonical !== current) throw new Error(`managed path ${label} is noncanonical`);
  }
}

function readUtf8(filePath, label) {
  let bytes;
  try {
    bytes = fs.readFileSync(filePath);
    return decoder.decode(bytes);
  } catch (error) {
    throw new Error(`${label} must be readable strict UTF-8: ${error.message || error}`);
  }
}

function assertManagedJsonStat(stat, label) {
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be symlinked`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if (stat.nlink !== 1n) throw new Error(`${label} must not be hard-linked`);
}

function sameManagedJsonSnapshot(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function readBoundedJsonFile(filePath, label) {
  let descriptor;
  try {
    const pathBefore = fs.lstatSync(filePath, { bigint: true });
    assertManagedJsonStat(pathBefore, label);
    const noFollow = typeof fs.constants.O_NOFOLLOW === "number" ? fs.constants.O_NOFOLLOW : 0;
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
    const before = fs.fstatSync(descriptor, { bigint: true });
    assertManagedJsonStat(before, label);
    if (!sameManagedJsonSnapshot(pathBefore, before)) {
      throw new Error(`${label} changed identity before its bounded read`);
    }
    if (before.size > BigInt(MAX_JSON_INPUT_BYTES)) {
      throw new Error(`${label} JSON input exceeds ${MAX_JSON_INPUT_BYTES} bytes`);
    }

    const rawByteLength = Number(before.size);
    const bytes = Buffer.alloc(rawByteLength);
    let offset = 0;
    while (offset < rawByteLength) {
      const bytesRead = fs.readSync(descriptor, bytes, offset, rawByteLength - offset, offset);
      if (bytesRead === 0) throw new Error(`${label} changed size during its bounded read`);
      offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    const extraBytes = fs.readSync(descriptor, extra, 0, 1, rawByteLength);
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(filePath, { bigint: true });
    assertManagedJsonStat(pathAfter, label);
    if (
      extraBytes !== 0 ||
      !sameManagedJsonSnapshot(before, after) ||
      !sameManagedJsonSnapshot(after, pathAfter)
    ) {
      throw new Error(`${label} changed during its bounded read`);
    }
    try {
      return { raw: decoder.decode(bytes), rawByteLength };
    } catch (error) {
      throw new Error(`${label} must be readable strict UTF-8: ${error.message || error}`);
    }
  } catch (error) {
    throw new Error(error.message || String(error));
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function assertNoDuplicateJsonKeys(raw, label) {
  let index = 0;

  function malformed(reason) {
    throw new Error(`${label} is malformed JSON at offset ${index}: ${reason}`);
  }

  function skipWhitespace() {
    while (index < raw.length && /[\t\n\r ]/.test(raw[index])) index += 1;
  }

  function parseString() {
    const start = index;
    if (raw[index] !== '"') malformed("expected a string");
    index += 1;
    while (index < raw.length) {
      const character = raw[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(raw.slice(start, index));
        } catch (error) {
          malformed(error.message || String(error));
        }
      }
      if (character === "\\") {
        index += 1;
        if (index >= raw.length) malformed("unterminated escape sequence");
        if (raw[index] === "u") {
          const codePoint = raw.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(codePoint)) malformed("invalid Unicode escape");
          index += 5;
          continue;
        }
        if (!/["\\/bfnrt]/.test(raw[index])) malformed("invalid escape sequence");
        index += 1;
        continue;
      }
      if (character.charCodeAt(0) < 0x20) malformed("unescaped control character");
      index += 1;
    }
    malformed("unterminated string");
  }

  function parseNumber() {
    const start = index;
    if (raw[index] === "-") index += 1;
    if (raw[index] === "0") {
      index += 1;
    } else {
      if (!/[1-9]/.test(raw[index] || "")) malformed("invalid number");
      while (/\d/.test(raw[index] || "")) index += 1;
    }
    if (raw[index] === ".") {
      index += 1;
      if (!/\d/.test(raw[index] || "")) malformed("invalid number fraction");
      while (/\d/.test(raw[index] || "")) index += 1;
    }
    if (raw[index] === "e" || raw[index] === "E") {
      index += 1;
      if (raw[index] === "+" || raw[index] === "-") index += 1;
      if (!/\d/.test(raw[index] || "")) malformed("invalid number exponent");
      while (/\d/.test(raw[index] || "")) index += 1;
    }
    if (index === start) malformed("expected a JSON value");
  }

  function parseValue(depth) {
    skipWhitespace();
    const character = raw[index];
    if (character === "{") return parseObject(depth + 1);
    if (character === "[") return parseArray(depth + 1);
    if (character === '"') {
      parseString();
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (raw.startsWith(literal, index)) {
        index += literal.length;
        return;
      }
    }
    parseNumber();
  }

  function parseObject(depth) {
    if (depth > MAX_JSON_NESTING_DEPTH) {
      throw new Error(`${label} JSON nesting depth exceeds ${MAX_JSON_NESTING_DEPTH}`);
    }
    index += 1;
    const keys = new Set();
    skipWhitespace();
    if (raw[index] === "}") {
      index += 1;
      return;
    }
    while (index < raw.length) {
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) throw new Error(`${label} contains duplicate JSON key: ${key}`);
      keys.add(key);
      skipWhitespace();
      if (raw[index] !== ":") malformed("expected ':' after object key");
      index += 1;
      parseValue(depth);
      skipWhitespace();
      if (raw[index] === "}") {
        index += 1;
        return;
      }
      if (raw[index] !== ",") malformed("expected ',' or '}' in object");
      index += 1;
    }
    malformed("unterminated object");
  }

  function parseArray(depth) {
    if (depth > MAX_JSON_NESTING_DEPTH) {
      throw new Error(`${label} JSON nesting depth exceeds ${MAX_JSON_NESTING_DEPTH}`);
    }
    index += 1;
    skipWhitespace();
    if (raw[index] === "]") {
      index += 1;
      return;
    }
    while (index < raw.length) {
      parseValue(depth);
      skipWhitespace();
      if (raw[index] === "]") {
        index += 1;
        return;
      }
      if (raw[index] !== ",") malformed("expected ',' or ']' in array");
      index += 1;
    }
    malformed("unterminated array");
  }

  parseValue(0);
  skipWhitespace();
  if (index !== raw.length) malformed("unexpected trailing content");
}

function parseJsonWithoutDuplicateKeys(raw, label, rawByteLength) {
  if (!Number.isSafeInteger(rawByteLength) || rawByteLength < 0) {
    throw new Error(`${label} JSON input has an invalid raw byte length`);
  }
  if (rawByteLength > MAX_JSON_INPUT_BYTES) {
    throw new Error(`${label} JSON input exceeds ${MAX_JSON_INPUT_BYTES} bytes`);
  }
  assertNoDuplicateJsonKeys(raw, label);
  return JSON.parse(raw);
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    process.stdin.on("data", (chunk) => {
      if (settled) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.length;
      if (total > MAX_JSON_INPUT_BYTES) {
        settled = true;
        process.stdin.pause();
        reject(new Error(`hook input JSON input exceeds ${MAX_JSON_INPUT_BYTES} bytes`));
        return;
      }
      for (let offset = 0; offset < bytes.length; offset += STDIN_CHUNK_BYTES) {
        chunks.push(Buffer.from(bytes.subarray(offset, offset + STDIN_CHUNK_BYTES)));
      }
    });
    process.stdin.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve({ raw: decoder.decode(Buffer.concat(chunks, total)), rawByteLength: total });
      } catch (error) {
        reject(new Error(`hook input must be readable strict UTF-8: ${error.message || error}`));
      }
    });
    process.stdin.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(new Error(`hook input could not be read: ${error.message || error}`));
    });
  });
}

function validateExtensionsPolicy(root) {
  const policyPath = path.join(root, ".specify", "extensions.yml");
  requireRegularFile(policyPath, ".specify/extensions.yml", true);
  const raw = readUtf8(policyPath, ".specify/extensions.yml");
  const normalized = raw.replace(/\r\n/g, "\n");
  if (normalized.includes("\r")) {
    throw new Error(".specify/extensions.yml contains a bare carriage return");
  }
  if (normalized !== EXTENSIONS_POLICY) {
    throw new Error(
      ".specify/extensions.yml must contain exactly zero installed extensions, auto_execute_hooks: false, and zero hooks"
    );
  }

  const extensionsDir = path.join(root, ".specify", "extensions");
  let entries = [];
  if (fs.existsSync(extensionsDir)) {
    const stat = fs.lstatSync(extensionsDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(".specify/extensions must be a non-symlinked directory");
    }
    entries = fs.readdirSync(extensionsDir, { withFileTypes: true });
  }
  const unexpected = entries.map((entry) => entry.name).filter((name) => name !== ".cache");
  if (unexpected.length > 0) {
    throw new Error(`unexpected installed-extension entry: ${unexpected.sort().join(", ")}`);
  }
  const cache = entries.find((entry) => entry.name === ".cache");
  if (cache && (cache.isSymbolicLink() || !cache.isDirectory())) {
    throw new Error(".specify/extensions/.cache must be a non-symlinked catalog directory");
  }
}

function validateCoreSkills(root) {
  const skillsRoot = path.join(root, ".agents", "skills");
  let entries;
  try {
    entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
  } catch (error) {
    throw new Error(`official core skill directory is missing: ${error.message || error}`);
  }
  const speckitEntries = entries.filter((entry) => entry.name.startsWith("speckit-"));
  const actual = speckitEntries.map((entry) => entry.name).sort();
  if (JSON.stringify(actual) !== JSON.stringify(CORE_SKILLS)) {
    throw new Error(`official core skill set must be exactly: ${CORE_SKILLS.join(", ")}`);
  }
  for (const entry of speckitEntries) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error(`official core skill ${entry.name} must be a non-symlinked directory`);
    }
  }

  const manifestPath = path.join(root, CODEX_MANIFEST_PATH);
  let manifest;
  try {
    const input = readBoundedJsonFile(manifestPath, CODEX_MANIFEST_PATH);
    manifest = parseJsonWithoutDuplicateKeys(input.raw, CODEX_MANIFEST_PATH, input.rawByteLength);
  } catch (error) {
    throw new Error(`official Codex integration manifest is invalid: ${error.message || error}`);
  }
  const expectedPaths = CORE_SKILLS.map((skill) => `.agents/skills/${skill}/SKILL.md`).sort();
  const files =
    manifest && typeof manifest === "object" && !Array.isArray(manifest) ? manifest.files : null;
  if (
    manifest?.integration !== "codex" ||
    manifest?.version !== "0.15.1" ||
    !files ||
    typeof files !== "object" ||
    Array.isArray(files)
  ) {
    throw new Error("official Codex integration manifest has an unexpected identity or shape");
  }
  const actualPaths = Object.keys(files).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error(
      "official Codex integration manifest must enumerate exactly the ten managed skills"
    );
  }
  for (const relativePath of expectedPaths) {
    const declared = files[relativePath];
    if (typeof declared !== "string" || !/^[a-f0-9]{64}$/.test(declared)) {
      throw new Error(`managed skill manifest hash is invalid: ${relativePath}`);
    }
    const skillPath = path.join(root, relativePath);
    const stat = requireRegularFile(skillPath, `managed skill ${relativePath}`, true);
    if (stat.size > MAX_MANAGED_SKILL_BYTES) {
      throw new Error(`managed skill exceeds ${MAX_MANAGED_SKILL_BYTES} bytes: ${relativePath}`);
    }
    const actual = createHash("sha256").update(fs.readFileSync(skillPath)).digest("hex");
    if (actual !== declared) {
      throw new Error(`managed skill hash mismatch: ${relativePath}`);
    }
  }
}

function validateConstitutionStatus(root) {
  const statusPath = path.join(root, ".specify", "memory", "constitution-status.json");
  let status;
  try {
    const input = readBoundedJsonFile(statusPath, ".specify/memory/constitution-status.json");
    status = parseJsonWithoutDuplicateKeys(
      input.raw,
      ".specify/memory/constitution-status.json",
      input.rawByteLength
    );
  } catch (error) {
    throw new Error(`constitution status is malformed: ${error.message || error}`);
  }
  const valid =
    status &&
    typeof status === "object" &&
    !Array.isArray(status) &&
    status.status === "PROPOSED" &&
    status.ratified === false &&
    status.activation === "PROPOSAL_CRITERIA_ONLY" &&
    status.binding === false &&
    status.blocking_authority === false &&
    status.critical_remediation_authority === false;
  if (!valid) {
    throw new Error(
      "constitution must remain a nonbinding proposal with no blocking or critical-remediation authority"
    );
  }
}

function canonicalDirectoryInside(root, rawValue, label) {
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    throw new Error(`${label} must be a non-empty path`);
  }
  if (rawValue.includes("\0")) throw new Error(`${label} contains a NUL byte`);
  const lexical = path.isAbsolute(rawValue) ? path.resolve(rawValue) : path.resolve(root, rawValue);
  let canonical;
  let stat;
  try {
    canonical = fs.realpathSync.native(lexical);
    stat = fs.statSync(canonical);
  } catch (error) {
    throw new Error(`${label} cannot be resolved canonically: ${error.message || error}`);
  }
  if (!stat.isDirectory() || !isInside(root, canonical)) {
    throw new Error(`${label} must resolve inside the current repository lane`);
  }
  return canonical;
}

function validateDirectoryState(root) {
  for (const name of ["SPECIFY_FEATURE_DIRECTORY", "SPECIFY_INIT_DIR"]) {
    if (Object.prototype.hasOwnProperty.call(process.env, name)) {
      canonicalDirectoryInside(root, process.env[name], name);
    }
  }

  const featurePath = path.join(root, ".specify", "feature.json");
  try {
    fs.lstatSync(featurePath);
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw new Error(`.specify/feature.json is unreadable: ${error.message || error}`);
  }
  let feature;
  try {
    const input = readBoundedJsonFile(featurePath, ".specify/feature.json");
    feature = parseJsonWithoutDuplicateKeys(
      input.raw,
      ".specify/feature.json",
      input.rawByteLength
    );
  } catch (error) {
    throw new Error(`.specify/feature.json is malformed: ${error.message || error}`);
  }
  if (!feature || typeof feature !== "object" || Array.isArray(feature)) {
    throw new Error(".specify/feature.json must contain an object");
  }
  try {
    canonicalDirectoryInside(
      root,
      feature.feature_directory,
      ".specify/feature.json feature_directory"
    );
  } catch (error) {
    throw new Error(error.message || String(error));
  }
}

function validateTrustState(root) {
  validateManagedDirectoryChain(root, ".specify/memory");
  validateManagedDirectoryChain(root, ".specify/integrations");
  validateManagedDirectoryChain(root, ".specify/extensions", false);
  validateManagedDirectoryChain(root, ".specify/extensions/.cache", false);
  validateManagedDirectoryChain(root, ".agents/skills");
  validateExtensionsPolicy(root);
  validateCoreSkills(root);
  validateConstitutionStatus(root);
  validateDirectoryState(root);
}

function shellCommand(data) {
  const input = data && data.tool_input;
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return "";
  if (typeof input.command === "string") return input.command;
  if (typeof input.cmd === "string") return input.cmd;
  return "";
}

function requestedShellWorkingDirectory(data, root) {
  const input = data && data.tool_input;
  const candidates = [];
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const key of ["workdir", "cwd", "working_directory"]) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        candidates.push([`tool_input.${key}`, input[key]]);
      }
    }
  }
  for (const key of ["workdir", "cwd", "working_directory"]) {
    if (data && Object.prototype.hasOwnProperty.call(data, key)) {
      candidates.push([key, data[key]]);
    }
  }
  if (candidates.length === 0) return ".";
  const canonicalCandidates = [];
  for (const [label, rawValue] of candidates) {
    if (typeof rawValue === "string" && rawValue.trim() === "") continue;
    if (typeof rawValue !== "string" || rawValue.includes("\0")) {
      throw new Error(`${label} must be a concrete directory path`);
    }
    const lexical = path.isAbsolute(rawValue)
      ? path.resolve(rawValue)
      : path.resolve(root, rawValue);
    let canonical;
    let stat;
    try {
      canonical = fs.realpathSync.native(lexical);
      stat = fs.statSync(canonical);
    } catch (error) {
      throw new Error(`${label} cannot be resolved canonically: ${error.message || error}`);
    }
    if (!stat.isDirectory()) throw new Error(`${label} must resolve to a directory`);
    canonicalCandidates.push(canonical);
  }
  if (canonicalCandidates.length === 0) return ".";
  if (new Set(canonicalCandidates).size !== 1) {
    throw new Error("conflicting shell working directory evidence");
  }
  return path.relative(root, canonicalCandidates[0]).replace(/\\/g, "/") || ".";
}

function tokenizeStaticShell(command, dialect) {
  const tokens = [];
  let token = "";
  let tokenStarted = false;
  let tokenLeadingQuoted = false;
  let tokenLeadingEscaped = false;
  let quote = null;

  function pushToken() {
    if (!tokenStarted) return;
    tokens.push({
      value: token,
      operator: false,
      leadingQuoted: tokenLeadingQuoted,
      leadingEscaped: tokenLeadingEscaped,
    });
    token = "";
    tokenStarted = false;
    tokenLeadingQuoted = false;
    tokenLeadingEscaped = false;
  }

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) {
        quote = null;
        tokenStarted = true;
        continue;
      }
      if (dialect === "powershell" && character === "`" && quote === '"') {
        if (index + 1 >= command.length) return null;
        token += command[index + 1];
        tokenStarted = true;
        index += 1;
        continue;
      }
      if (dialect === "posix" && character === "\\" && quote === '"') {
        const escaped = command[index + 1];
        if (escaped && /["\\$`\n]/.test(escaped)) {
          token += escaped;
          tokenStarted = true;
          index += 1;
          continue;
        }
      }
      token += character;
      tokenStarted = true;
      continue;
    }
    if (character === "'" || character === '"') {
      if (!tokenStarted) tokenLeadingQuoted = true;
      quote = character;
      tokenStarted = true;
      continue;
    }
    if (dialect === "powershell" && character === "`") {
      if (index + 1 >= command.length) return null;
      if (!tokenStarted) tokenLeadingEscaped = true;
      token += command[index + 1];
      tokenStarted = true;
      index += 1;
      continue;
    }
    if (dialect === "posix" && character === "\\" && index + 1 < command.length) {
      token += command[index + 1];
      tokenStarted = true;
      index += 1;
      continue;
    }
    if (/[\t ]/.test(character)) {
      pushToken();
      continue;
    }
    if (character === ">") {
      pushToken();
      let redirection = ">";
      if (command[index + 1] === ">") {
        redirection = ">>";
        index += 1;
      } else if (command[index + 1] === "|") {
        redirection = ">|";
        index += 1;
      }
      tokens.push({
        value: redirection,
        operator: false,
        leadingQuoted: false,
        leadingEscaped: false,
      });
      continue;
    }
    if (character === "\n" || character === ";" || character === "|" || character === "&") {
      pushToken();
      if (dialect === "powershell" && character === "&" && command[index + 1] !== "&") {
        tokens.push({
          value: "&",
          operator: false,
          leadingQuoted: false,
          leadingEscaped: false,
        });
        continue;
      }
      let operator = character;
      if ((character === "|" || character === "&") && command[index + 1] === character) {
        operator += character;
        index += 1;
      }
      tokens.push({ value: operator, operator: true });
      continue;
    }
    token += character;
    tokenStarted = true;
  }
  if (quote) return null;
  pushToken();
  return tokens;
}

function splitStaticShellTokenSegments(command, dialect) {
  const tokens = tokenizeStaticShell(command, dialect);
  if (!tokens) return [];
  const segments = [];
  let segment = [];
  for (const token of tokens) {
    if (
      dialect === "powershell" &&
      segment.length > 0 &&
      token.value === "&" &&
      barePowerShellSyntaxToken(token)
    ) {
      segments.push(segment);
      segment = [];
      continue;
    }
    if (token.operator) {
      if (segment.length > 0) segments.push(segment);
      segment = [];
    } else {
      segment.push(token);
    }
  }
  if (segment.length > 0) segments.push(segment);
  return segments;
}

function splitStaticShellSegments(command, dialect) {
  return splitStaticShellTokenSegments(command, dialect).map((segment) =>
    segment.map((token) => token.value)
  );
}

function stripExecutableSuffix(value) {
  return path.posix
    .basename(String(value || "").replace(/\\/g, "/"))
    .toLowerCase()
    .replace(/\.exe$/, "");
}

function barePowerShellSyntaxToken(token) {
  return Boolean(token && !token.leadingQuoted && !token.leadingEscaped);
}

function eligiblePowerShellExecutableTokens(segment) {
  if (segment[0]?.value === "&" && barePowerShellSyntaxToken(segment[0])) {
    return segment.slice(1);
  }
  return barePowerShellSyntaxToken(segment[0]) ? segment : [];
}

function annotatePowerShellSyntax(tokens, flags) {
  Object.defineProperty(tokens, POWERSHELL_BARE_SYNTAX, {
    value: flags,
    enumerable: false,
  });
  return tokens;
}

function powerShellSyntaxSlice(tokens, start) {
  const sliced = tokens.slice(start);
  const flags = tokens[POWERSHELL_BARE_SYNTAX];
  return flags ? annotatePowerShellSyntax(sliced, flags.slice(start)) : sliced;
}

function resolveStaticExecutable(segment, dialect, depth = 0) {
  if (depth > 3) return [];
  let tokens;
  if (dialect === "powershell") {
    if (typeof segment[0] === "string") {
      const inheritedFlags = segment[POWERSHELL_BARE_SYNTAX];
      tokens = annotatePowerShellSyntax(
        [...segment],
        inheritedFlags ? [...inheritedFlags] : segment.map(() => true)
      );
    } else {
      const eligible = eligiblePowerShellExecutableTokens(segment);
      tokens = annotatePowerShellSyntax(
        eligible.map((token) => token.value),
        eligible.map(barePowerShellSyntaxToken)
      );
    }
  } else {
    tokens = [...segment];
  }
  if (dialect === "posix") {
    while (tokens.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  }
  if (tokens.length === 0) return [];

  let executable = stripExecutableSuffix(tokens[0]);
  if (executable === "command") {
    tokens = powerShellSyntaxSlice(tokens, 1);
    while (tokens[0] && tokens[0].startsWith("-")) tokens = powerShellSyntaxSlice(tokens, 1);
    return resolveStaticExecutable(tokens, dialect, depth + 1);
  }
  if (executable === "env") {
    tokens = powerShellSyntaxSlice(tokens, 1);
    while (tokens[0] && (tokens[0].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]))) {
      tokens = powerShellSyntaxSlice(tokens, 1);
    }
    return resolveStaticExecutable(tokens, dialect, depth + 1);
  }
  if (["sh", "bash", "zsh", "pwsh", "powershell"].includes(executable)) {
    const childDialect = ["pwsh", "powershell"].includes(executable) ? "powershell" : "posix";
    const commandFlag = tokens.findIndex((token) =>
      childDialect === "posix"
        ? /^-[A-Za-z]*c[A-Za-z]*$/.test(token)
        : /^(?:-c|-command)$/i.test(token)
    );
    if (commandFlag >= 0 && tokens[commandFlag + 1]) {
      return staticExecutableCommands(tokens[commandFlag + 1], childDialect, depth + 1);
    }
  }
  return [tokens];
}

function staticExecutableCommands(command, dialect, depth = 0) {
  if (depth > 3) return [];
  const segments =
    dialect === "powershell"
      ? splitStaticShellTokenSegments(command, dialect)
      : splitStaticShellSegments(command, dialect);
  return segments.flatMap((segment) => resolveStaticExecutable(segment, dialect, depth));
}

function restrictedPowerShellProviderName(providerPath) {
  const match = /^env:(?:\\)?(SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR))$/i.exec(providerPath || "");
  return match ? match[1].toUpperCase() : "";
}

function powerShellProviderPath(tokens) {
  const noValueSwitch = /^(?:force|whatif|confirm|passthru|verbose|debug)$/i;
  const valueOption =
    /^(?:value|filter|include|exclude|credential|erroraction|errorvariable|informationaction|informationvariable|outbuffer|outvariable|pipelinevariable|progressaction|warningaction|warningvariable)$/i;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const parameterEligible = barePowerShellSyntaxToken(token);
    if (parameterEligible && token.value === "--") {
      return tokens[index + 1]?.value || "";
    }
    if (parameterEligible && /^-(?:path|literalpath)$/i.test(token.value)) {
      return tokens[index + 1]?.value || "";
    }

    const attachedSwitch = parameterEligible
      ? /^-([^:]+):\$(?:true|false)$/i.exec(token.value)
      : null;
    if (attachedSwitch && noValueSwitch.test(attachedSwitch[1])) continue;
    const option = parameterEligible ? /^-([^:]+)$/.exec(token.value) : null;
    if (option && noValueSwitch.test(option[1])) continue;

    if (option && valueOption.test(option[1])) {
      if (!tokens[index + 1]) return "";
      index += 1;
      continue;
    }

    if (parameterEligible && token.value.startsWith("-")) return "";
    return token.value;
  }
  return "";
}

function restrictedAssignmentName(segment, dialect) {
  const restricted = /^(?:SPECIFY_FEATURE_DIRECTORY|SPECIFY_INIT_DIR)$/i;
  if (dialect === "powershell") {
    const directAssignmentToken = barePowerShellSyntaxToken(segment[0]) ? segment[0] : null;
    const match = /^\$env:(SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR))(?:=.*)?$/i.exec(
      directAssignmentToken?.value || ""
    );
    if (match && (directAssignmentToken.value.includes("=") || segment[1]?.value === "=")) {
      return match[1].toUpperCase();
    }
    const tokens = eligiblePowerShellExecutableTokens(segment);
    const executable = stripExecutableSuffix(tokens[0]?.value || "");
    if (!["set-item", "set-content"].includes(executable)) return "";
    return restrictedPowerShellProviderName(powerShellProviderPath(tokens));
  }

  let index = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(segment[index] || "")) {
    const name = segment[index].slice(0, segment[index].indexOf("="));
    if (restricted.test(name)) return name.toUpperCase();
    index += 1;
  }
  const executable = stripExecutableSuffix(segment[index] || "");
  if (executable === "env") {
    index += 1;
    while ((segment[index] || "").startsWith("-")) {
      if (["-u", "--unset"].includes(segment[index])) index += 1;
      index += 1;
    }
  } else if (executable === "export") {
    index += 1;
    while (segment[index] && /^-(?:[np]+|-)$/.test(segment[index])) index += 1;
  } else {
    return "";
  }
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(segment[index] || "")) {
    const name = segment[index].slice(0, segment[index].indexOf("="));
    if (restricted.test(name)) return name.toUpperCase();
    index += 1;
  }
  return "";
}

function normalizedStaticPath(value, workingDirectory = ".") {
  const unquoted = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^['"]|['"]$/g, "");
  const normalized = path.posix.normalize(unquoted);
  const withoutTrailingSlash =
    normalized.length > 1 && normalized.endsWith("/") ? normalized.replace(/\/+$/, "") : normalized;
  if (
    workingDirectory &&
    workingDirectory !== "." &&
    !path.posix.isAbsolute(withoutTrailingSlash) &&
    !/^[A-Za-z]:\//.test(withoutTrailingSlash)
  ) {
    return path.posix.normalize(path.posix.join(workingDirectory, withoutTrailingSlash));
  }
  return withoutTrailingSlash;
}

function protectedTrustAnchorReference(value, workingDirectory = ".") {
  const normalized = normalizedStaticPath(value, workingDirectory);
  return (
    /(?:^|\/)\.specify\/extensions\.yml$/.test(normalized) ||
    /(?:^|\/)\.specify\/integrations\/codex\.manifest\.json$/.test(normalized) ||
    /(?:^|\/)\.specify\/memory\/constitution-status\.json$/.test(normalized) ||
    /(?:^|\/)\.agents\/skills\/speckit-[^/]+(?:\/|$)/.test(normalized)
  );
}

function protectedTrustContainerReference(value, workingDirectory = ".") {
  const normalized = normalizedStaticPath(value, workingDirectory);
  return (
    /(?:^|\/)\.specify(?:\/(?:integrations|memory))?$/.test(normalized) ||
    /(?:^|\/)\.agents(?:\/skills)?$/.test(normalized)
  );
}

function protectedTrustStateReference(value, workingDirectory = ".") {
  return (
    protectedTrustAnchorReference(value, workingDirectory) ||
    protectedTrustContainerReference(value, workingDirectory)
  );
}

function staticDirectoryAfter(argv, workingDirectory, dialect) {
  const executable = stripExecutableSuffix(argv[0] || "");
  const directoryCommands =
    dialect === "powershell"
      ? new Set(["cd", "chdir", "set-location", "sl"])
      : new Set(["cd", "chdir"]);
  if (!directoryCommands.has(executable)) return workingDirectory;
  const args = argv.slice(1);
  let target = "";
  for (let index = 0; index < args.length; index += 1) {
    const value = String(args[index] || "");
    if (value === "--") {
      target = String(args[index + 1] || "");
      break;
    }
    if (/^-(?:path|literalpath)$/i.test(value)) {
      target = String(args[index + 1] || "");
      break;
    }
    if (!value.startsWith("-")) {
      target = value;
      break;
    }
  }
  if (!target || /[$`*?{}\[\]]/.test(target)) return "";
  return normalizedStaticPath(target, workingDirectory || ".");
}

function protectedCopyDestination(executable, args, workingDirectory) {
  const copyExecutables = new Set(["cp", "cpi", "copy", "copy-item", "install"]);
  if (!copyExecutables.has(executable)) return false;
  for (let index = 0; index < args.length; index += 1) {
    const value = String(args[index] || "");
    const attached = /^(?:--target-directory|--destination)=([^=].*)$/i.exec(value);
    if (attached && protectedTrustStateReference(attached[1], workingDirectory)) return true;
    if (/^(?:-t|--target-directory|-destination)$/i.test(value)) {
      if (protectedTrustStateReference(args[index + 1], workingDirectory)) return true;
    }
  }
  const operands = args.filter((value) => value === "-" || !String(value).startsWith("-"));
  const destination = operands.at(-1);
  if (protectedTrustStateReference(destination, workingDirectory)) return true;
  const linkMode =
    executable === "cp" &&
    args.some((value) => value === "--link" || /^-[^-]*l/.test(String(value)));
  return linkMode && args.some((value) => protectedTrustStateReference(value, workingDirectory));
}

function staticTrustAnchorMutation(argv, dialect, workingDirectory = ".") {
  const executable = stripExecutableSuffix(argv[0] || "");
  const args = argv.slice(1);
  const protectedArgument = args.some((value) =>
    protectedTrustStateReference(value, workingDirectory)
  );
  const redirectionTarget = argv.some(
    (value, index) =>
      /^(?:\d*)?(?:>|>>|>\|)$/.test(value) &&
      protectedTrustStateReference(argv[index + 1], workingDirectory)
  );
  if (redirectionTarget) return true;

  const directMutators = new Set([
    "rm",
    "del",
    "erase",
    "ri",
    "unlink",
    "mv",
    "mi",
    "move",
    "ln",
    "touch",
    "truncate",
    "tee",
    "chmod",
    "chown",
    "set-content",
    "sc",
    "add-content",
    "ac",
    "clear-content",
    "clc",
    "clear-item",
    "cli",
    "out-file",
    "remove-item",
    "move-item",
    "rename-item",
    "rni",
    "ren",
    "new-item",
    "ni",
  ]);
  const powerShellSyntax = argv[POWERSHELL_BARE_SYNTAX] || [];
  const powerShellValueParameter =
    /^-(?:credential|destination|encoding|erroraction|exclude|filter|include|itemtype|literalpath|name|newname|path|stream|value)$/i;
  const powerShellWhatIf =
    dialect === "powershell" &&
    args.some(
      (value, index) =>
        powerShellSyntax[index + 1] === true &&
        /^-whatif(?::\$true)?$/i.test(value) &&
        !(
          index > 0 &&
          powerShellSyntax[index] === true &&
          powerShellValueParameter.test(args[index - 1])
        )
    );
  const powerShellMutators = new Set([
    "rm",
    "del",
    "erase",
    "ri",
    "remove-item",
    "set-content",
    "add-content",
    "clear-content",
    "clear-item",
    "cli",
    "out-file",
    "move-item",
    "mi",
    "mv",
    "move",
    "copy-item",
    "cpi",
    "cp",
    "copy",
    "rename-item",
    "rni",
    "ren",
    "new-item",
    "ni",
  ]);
  if (protectedCopyDestination(executable, args, workingDirectory)) {
    return !(powerShellWhatIf && powerShellMutators.has(executable));
  }
  if (
    executable === "ln" &&
    args.some((value) => protectedTrustContainerReference(value, workingDirectory))
  ) {
    return true;
  }
  if (directMutators.has(executable) && protectedArgument) {
    return !(powerShellWhatIf && powerShellMutators.has(executable));
  }
  if (["sed", "perl"].includes(executable) && args.some((value) => /^-.*i/.test(value))) {
    return protectedArgument;
  }
  if (executable === "find" && args.includes("-delete")) return protectedArgument;
  if (executable === "dd") {
    return args.some(
      (value) =>
        /^of=/.test(value) && protectedTrustStateReference(value.slice(3), workingDirectory)
    );
  }
  if (executable === "git" && ["checkout", "restore", "clean"].includes(args[0]?.toLowerCase())) {
    if (
      args[0]?.toLowerCase() === "clean" &&
      args.slice(1).some((value) => value === "--dry-run" || /^-[^-]*n/.test(String(value)))
    ) {
      return false;
    }
    return protectedArgument;
  }
  return false;
}

function staticSpecifyArguments(argv) {
  const executable = stripExecutableSuffix(argv[0] || "");
  if (executable === "specify") return argv.slice(1);
  const uvValueOptions = new Set([
    "--build-constraint",
    "--color",
    "--config-file",
    "--constraint",
    "--default-index",
    "--directory",
    "--exclude-newer",
    "--extra-index-url",
    "--find-links",
    "--fork-strategy",
    "--from",
    "--index",
    "--index-url",
    "--keyring-provider",
    "--link-mode",
    "--override",
    "--prerelease",
    "--project",
    "--python",
    "--python-platform",
    "--refresh-package",
    "--resolution",
    "--with",
    "--with-editable",
    "--with-requirements",
  ]);
  function wrappedArguments(start) {
    let index = start;
    while (index < argv.length) {
      const value = String(argv[index] || "");
      const lower = value.toLowerCase();
      if (value === "--") {
        index += 1;
        break;
      }
      if (!value.startsWith("-")) break;
      if (lower.includes("=")) {
        index += 1;
        continue;
      }
      index += uvValueOptions.has(lower) ? 2 : 1;
    }
    return stripExecutableSuffix(argv[index] || "") === "specify" ? argv.slice(index + 1) : null;
  }
  if (executable === "uvx") return wrappedArguments(1);
  if (
    executable === "uv" &&
    String(argv[1] || "").toLowerCase() === "tool" &&
    String(argv[2] || "").toLowerCase() === "run"
  ) {
    return wrappedArguments(3);
  }
  if (executable === "uv" && String(argv[1] || "").toLowerCase() === "run") {
    return wrappedArguments(2);
  }
  return null;
}

function validateShellCommand(data, root) {
  const command = shellCommand(data);
  if (!command) return;
  const dialect = /^(?:PowerShell|pwsh)$/i.test(String(data.tool_name || ""))
    ? "powershell"
    : "posix";
  const segments =
    dialect === "powershell"
      ? splitStaticShellTokenSegments(command, dialect)
      : splitStaticShellSegments(command, dialect);
  for (const segment of segments) {
    const assignmentName = restrictedAssignmentName(segment, dialect);
    if (assignmentName) {
      throw new Error(`inline ${assignmentName} shell assignments are blocked`);
    }
  }
  const mutationActions = new Set([
    "add",
    "remove",
    "update",
    "enable",
    "disable",
    "install",
    "uninstall",
  ]);
  let staticWorkingDirectory = requestedShellWorkingDirectory(data, root);
  for (const argv of staticExecutableCommands(command, dialect)) {
    if (staticTrustAnchorMutation(argv, dialect, staticWorkingDirectory)) {
      throw new Error(
        "statically recognizable mutation of a protected Spec Kit trust anchor is blocked"
      );
    }
    staticWorkingDirectory = staticDirectoryAfter(argv, staticWorkingDirectory, dialect);
    const staticArgs = staticSpecifyArguments(argv);
    if (!staticArgs) continue;
    const args = staticArgs.map((value) => value.toLowerCase());
    const integrationMutations = new Set([
      "add",
      "install",
      "remove",
      "switch",
      "uninstall",
      "update",
      "upgrade",
    ]);
    if (
      args[0] === "init" ||
      args[0] === "upgrade" ||
      (args[0] === "integration" && integrationMutations.has(args[1])) ||
      (integrationMutations.has(args[0]) && args[1] === "integration")
    ) {
      throw new Error(
        "Spec Kit managed integration mutation is blocked; use an explicitly reviewed maintenance change"
      );
    }
    if (args[0] === "workflow" && args[1] === "run") {
      throw new Error(
        "specify workflow run is blocked; invoke the reviewed core skills explicitly"
      );
    }
    if (
      ((args[0] === "extension" || args[0] === "extensions") && mutationActions.has(args[1])) ||
      (mutationActions.has(args[0]) && (args[1] === "extension" || args[1] === "extensions"))
    ) {
      throw new Error(
        "Spec Kit extension mutation is blocked; only read-only extension inventory is allowed"
      );
    }
  }
}

function collectStructuredPaths(value, output = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectStructuredPaths(item, output);
    return output;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (STRUCTURED_PATH_KEYS.has(key.toLowerCase()) && typeof nested === "string") {
      output.push(nested);
    } else if (nested && typeof nested === "object") {
      collectStructuredPaths(nested, output);
    }
  }
  return output;
}

function collectPatchPaths(data) {
  const input = data && data.tool_input;
  const values = [];
  if (typeof input === "string") values.push(input);
  if (input && typeof input === "object") {
    for (const key of ["command", "patch", "input"]) {
      if (typeof input[key] === "string") values.push(input[key]);
    }
  }
  const targets = [];
  for (const value of values) {
    for (const match of value.matchAll(
      /^\*\*\* (?:(?:Add|Update|Delete) File|Move to):\s*(.+?)\s*$/gm
    )) {
      targets.push(match[1]);
    }
  }
  return targets;
}

function normalizeTarget(value) {
  const trimmed = String(value || "").trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isSpecKitArtifact(rawTarget) {
  const normalized = rawTarget.replace(/\\/g, "/");
  return (
    /(?:^|\/)\.specify(?:\/|$)/.test(normalized) ||
    /(?:^|\/)\.agents\/skills\/speckit-[^/]+(?:\/|$)/.test(normalized) ||
    /(?:^|\/)specs(?:\/|$)/.test(normalized) ||
    /(?:^|\/)(?:spec|plan|tasks|research|data-model)\.md$/.test(normalized) ||
    /(?:^|\/)checklists?\//.test(normalized) ||
    /(?:^|\/)contracts?\//.test(normalized)
  );
}

function isPrivateBugTarget(rawTarget) {
  return /(?:^|\/)\.specify\/bugs(?:\/|$)/.test(rawTarget.replace(/\\/g, "/"));
}

function isProtectedTrustAnchor(rawTarget) {
  return protectedTrustStateReference(String(rawTarget || "").replace(/\\/g, "/"));
}

function canonicalWriteTarget(root, rawTarget) {
  if (!rawTarget || rawTarget.includes("\0")) throw new Error("write target is empty or malformed");
  const lexical = path.isAbsolute(rawTarget)
    ? path.resolve(rawTarget)
    : path.resolve(root, rawTarget);
  let cursor = lexical;
  const suffix = [];
  while (true) {
    try {
      fs.lstatSync(cursor);
      break;
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor)
        throw new Error(`write target has no resolvable ancestor: ${rawTarget}`);
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
  const canonicalParent = fs.realpathSync.native(cursor);
  return path.resolve(canonicalParent, ...suffix);
}

function validateStructuredWrite(data, root) {
  const toolName = String(data.tool_name || "");
  if (!STRUCTURED_WRITE_TOOL.test(toolName)) return;
  const targets = [
    ...collectStructuredPaths(data.tool_input),
    ...(toolName.toLowerCase().includes("apply_patch") ? collectPatchPaths(data) : []),
  ];
  for (const value of new Set(targets.map(normalizeTarget).filter(Boolean))) {
    let canonical;
    try {
      canonical = canonicalWriteTarget(root, value);
    } catch (error) {
      throw new Error(`write target is unresolved: ${error.message || error}`);
    }
    const rawIsSpecKit = isSpecKitArtifact(value);
    const canonicalIsSpecKit = isSpecKitArtifact(canonical.replace(/\\/g, "/"));
    if (!isInside(root, canonical)) {
      if (
        rawIsSpecKit ||
        canonicalIsSpecKit ||
        isPrivateBugTarget(value) ||
        isPrivateBugTarget(canonical)
      ) {
        throw new Error(
          `Spec Kit write target must stay inside the current repository lane: ${value}`
        );
      }
      continue;
    }
    const relative = path.relative(root, canonical).replace(/\\/g, "/");
    if (isProtectedTrustAnchor(value) || isProtectedTrustAnchor(relative)) {
      throw new Error(
        `writes to a protected Spec Kit trust anchor are blocked: ${value} -> ${relative}`
      );
    }
    if (isPrivateBugTarget(value) || isPrivateBugTarget(relative)) {
      throw new Error(`writes into .specify/bugs are blocked: ${value} -> ${relative}`);
    }
  }
}

async function parseInput() {
  const input = await readStdin();
  const data = parseJsonWithoutDuplicateKeys(input.raw, "hook input", input.rawByteLength);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("hook input must be one JSON object");
  }
  return data;
}

async function main() {
  const data = await parseInput();
  const root = canonicalRepositoryRoot();
  const eventName = String(data.hook_event_name || data.event || "");
  try {
    validateTrustState(root);
  } catch (error) {
    if (eventName === "PostToolUse") {
      throw new Error(
        `PostToolUse cannot undo the completed side effect; trust drift detected: ${error.message || error}`
      );
    }
    throw error;
  }
  if (eventName === "PreToolUse") {
    if (SHELL_TOOL.test(String(data.tool_name || ""))) validateShellCommand(data, root);
    validateStructuredWrite(data, root);
  }
  if (eventName === "UserPromptSubmit") {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: SPEC_KIT_PRIORITY_CONTEXT,
        },
      })}\n`
    );
    return;
  }
  process.stdout.write("{}\n");
}

main().catch((error) => fail(error.message || String(error)));
