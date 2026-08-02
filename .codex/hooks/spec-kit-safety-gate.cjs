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

  function parseValue() {
    skipWhitespace();
    const character = raw[index];
    if (character === "{") return parseObject();
    if (character === "[") return parseArray();
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
    const number = raw.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) {
      index += number[0].length;
      return;
    }
    malformed("expected a JSON value");
  }

  function parseObject() {
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
      parseValue();
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

  function parseArray() {
    index += 1;
    skipWhitespace();
    if (raw[index] === "]") {
      index += 1;
      return;
    }
    while (index < raw.length) {
      parseValue();
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

  parseValue();
  skipWhitespace();
  if (index !== raw.length) malformed("unexpected trailing content");
}

function parseJsonWithoutDuplicateKeys(raw, label) {
  assertNoDuplicateJsonKeys(raw, label);
  return JSON.parse(raw);
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
}

function validateConstitutionStatus(root) {
  const statusPath = path.join(root, ".specify", "memory", "constitution-status.json");
  requireRegularFile(statusPath, ".specify/memory/constitution-status.json", true);
  let status;
  try {
    status = parseJsonWithoutDuplicateKeys(
      readUtf8(statusPath, ".specify/memory/constitution-status.json"),
      ".specify/memory/constitution-status.json"
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
  requireRegularFile(featurePath, ".specify/feature.json", true);
  let feature;
  try {
    feature = parseJsonWithoutDuplicateKeys(
      readUtf8(featurePath, ".specify/feature.json"),
      ".specify/feature.json"
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

function tokenizeStaticShell(command) {
  const tokens = [];
  let token = "";
  let tokenStarted = false;
  let quote = null;

  function pushToken() {
    if (!tokenStarted) return;
    tokens.push({ value: token, operator: false });
    token = "";
    tokenStarted = false;
  }

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) {
        quote = null;
        tokenStarted = true;
        continue;
      }
      if (character === "\\" && quote === '"' && index + 1 < command.length) {
        token += command[index + 1];
        tokenStarted = true;
        index += 1;
        continue;
      }
      token += character;
      tokenStarted = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      tokenStarted = true;
      continue;
    }
    if (character === "\\" && index + 1 < command.length) {
      token += command[index + 1];
      tokenStarted = true;
      index += 1;
      continue;
    }
    if (/[\t ]/.test(character)) {
      pushToken();
      continue;
    }
    if (character === "\n" || character === ";" || character === "|" || character === "&") {
      pushToken();
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

function splitStaticShellSegments(command) {
  const tokens = tokenizeStaticShell(command);
  if (!tokens) return [];
  const segments = [];
  let segment = [];
  for (const token of tokens) {
    if (token.operator) {
      if (segment.length > 0) segments.push(segment);
      segment = [];
    } else {
      segment.push(token.value);
    }
  }
  if (segment.length > 0) segments.push(segment);
  return segments;
}

function stripExecutableSuffix(value) {
  return path
    .basename(value)
    .toLowerCase()
    .replace(/\.exe$/, "");
}

function resolveStaticExecutable(segment, depth = 0) {
  if (depth > 3) return [];
  let tokens = [...segment];
  while (tokens.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  if (tokens.length === 0) return [];

  let executable = stripExecutableSuffix(tokens[0]);
  if (executable === "command") {
    tokens = tokens.slice(1);
    while (tokens[0] && tokens[0].startsWith("-")) tokens.shift();
    return resolveStaticExecutable(tokens, depth + 1);
  }
  if (executable === "env") {
    tokens = tokens.slice(1);
    while (tokens[0] && (tokens[0].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]))) {
      tokens.shift();
    }
    return resolveStaticExecutable(tokens, depth + 1);
  }
  if (["sh", "bash", "zsh", "pwsh", "powershell"].includes(executable)) {
    const commandFlag = tokens.findIndex((token) => /^(?:-c|-command)$/i.test(token));
    if (commandFlag >= 0 && tokens[commandFlag + 1]) {
      return staticExecutableCommands(tokens[commandFlag + 1], depth + 1);
    }
  }
  return [tokens];
}

function staticExecutableCommands(command, depth = 0) {
  if (depth > 3) return [];
  return splitStaticShellSegments(command).flatMap((segment) =>
    resolveStaticExecutable(segment, depth)
  );
}

function validateShellCommand(data) {
  const command = shellCommand(data);
  if (!command) return;
  const mutationActions = new Set([
    "add",
    "remove",
    "update",
    "enable",
    "disable",
    "install",
    "uninstall",
  ]);
  for (const argv of staticExecutableCommands(command)) {
    if (stripExecutableSuffix(argv[0] || "") !== "specify") continue;
    const args = argv.slice(1).map((value) => value.toLowerCase());
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
  const assignment = command.match(/(?:\$env:\s*)?(SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR))\s*=/i);
  if (assignment) {
    throw new Error(`inline ${assignment[1].toUpperCase()} shell assignments are blocked`);
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
      const label = rawIsSpecKit || canonicalIsSpecKit ? "Spec Kit write target" : "write target";
      throw new Error(`${label} must stay inside the current repository lane: ${value}`);
    }
    const relative = path.relative(root, canonical).replace(/\\/g, "/");
    if (isPrivateBugTarget(value) || isPrivateBugTarget(relative)) {
      throw new Error(`writes into .specify/bugs are blocked: ${value} -> ${relative}`);
    }
  }
}

function parseInput() {
  const raw = fs.readFileSync(0, "utf8");
  const data = parseJsonWithoutDuplicateKeys(raw, "hook input");
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("hook input must be one JSON object");
  }
  return data;
}

try {
  const data = parseInput();
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
    if (SHELL_TOOL.test(String(data.tool_name || ""))) validateShellCommand(data);
    validateStructuredWrite(data, root);
  }
  process.stdout.write("{}\n");
} catch (error) {
  fail(error.message || String(error));
}
