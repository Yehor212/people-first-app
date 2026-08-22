import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";

export const LOCAL_OBSERVATION_SCHEMA_VERSION = 1;
export const LOCAL_OBSERVATION_EVIDENCE_CLASS = "LOCAL_PROCESS_OBSERVED";
export const LOCAL_OBSERVATION_HOOK_PATH = ".codex/hooks/skill-router-gate.cjs";
export const LOCAL_OBSERVATION_OUTPUT_PREFIX = "output/agent-orchestra/";
export const LOCAL_OBSERVATION_HOOK_TIMEOUT_MS = 5000;

const LIMITATIONS = Object.freeze([
  "Local child-process execution does not prove installed Codex profile loading.",
  "Local child-process execution does not prove effective permissions or lifecycle delivery.",
  "Token cost, qualified review, owner-controlled holdout, and host-platform parity remain UNVERIFIED.",
]);
const EXIT_CLASSES = new Set(["ALLOW", "BLOCK", "ERROR"]);
const PRIMARY_DECISIONS = new Set(["ALLOW", "BLOCK", "NONE"]);

export function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function createLocalObservationReceipt({
  now = new Date(),
  hookRelativePath,
  hookSource,
  hookEventName,
  exitClass,
  primaryDecision,
} = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError("observation time must be a valid Date");
  }
  if (hookRelativePath !== LOCAL_OBSERVATION_HOOK_PATH) {
    throw new TypeError("observation hook path must be the canonical skill-router hook");
  }
  if (typeof hookSource !== "string" || hookSource.length === 0) {
    throw new TypeError("observation hook source must be non-empty text");
  }
  if (hookEventName !== "PreToolUse") {
    throw new TypeError("local observation supports only the controlled PreToolUse event");
  }
  if (!EXIT_CLASSES.has(exitClass)) throw new TypeError("observation exit class is invalid");
  if (!PRIMARY_DECISIONS.has(primaryDecision)) throw new TypeError("observation primary decision is invalid");
  if ((exitClass === "ALLOW" && primaryDecision !== "ALLOW") ||
      (exitClass === "BLOCK" && primaryDecision !== "BLOCK") ||
      (exitClass === "ERROR" && primaryDecision !== "NONE")) {
    throw new TypeError("observation exit class and primary decision conflict");
  }

  const receipt = {
    schema_version: LOCAL_OBSERVATION_SCHEMA_VERSION,
    evidence_class: LOCAL_OBSERVATION_EVIDENCE_CLASS,
    observed_at: now.toISOString(),
    repository: {
      hook_relative_path: hookRelativePath,
      hook_sha256: sha256Text(hookSource),
    },
    observation: {
      hook_event_name: hookEventName,
      exit_class: exitClass,
      primary_decision: primaryDecision,
    },
    host_runtime: {
      custom_profile_loading: "UNVERIFIED",
      effective_permissions: "UNVERIFIED",
      lifecycle_delivery: "UNVERIFIED",
    },
    limitations: [...LIMITATIONS],
  };
  const validation = validateLocalObservationReceipt(receipt);
  if (validation.errors.length > 0) throw new Error(validation.errors.join("; "));
  return receipt;
}

export function validateLocalObservationReceipt(receipt) {
  const errors = [];
  if (!isPlainObject(receipt)) return { errors: ["receipt must be an object"] };
  rejectUnknownKeys(
    receipt,
    new Set([
      "schema_version",
      "evidence_class",
      "observed_at",
      "repository",
      "observation",
      "host_runtime",
      "limitations",
    ]),
    "receipt",
    errors,
  );
  if (receipt.schema_version !== LOCAL_OBSERVATION_SCHEMA_VERSION) {
    errors.push(`receipt.schema_version must be ${LOCAL_OBSERVATION_SCHEMA_VERSION}`);
  }
  if (receipt.evidence_class !== LOCAL_OBSERVATION_EVIDENCE_CLASS) {
    errors.push(`receipt.evidence_class must be ${LOCAL_OBSERVATION_EVIDENCE_CLASS}`);
  }
  if (!isExactIsoTimestamp(receipt.observed_at)) errors.push("receipt.observed_at must be an exact ISO timestamp");
  validateRepository(receipt.repository, errors);
  validateObservation(receipt.observation, errors);
  validateHostRuntime(receipt.host_runtime, errors);
  if (!sameStringArray(receipt.limitations, LIMITATIONS)) {
    errors.push("receipt.limitations must be the fixed local-observation limitation set");
  }
  return { errors };
}

export async function observeLocalSkillRoutingHook({
  rootDir,
  now = new Date(),
  spawn = spawnSync,
} = {}) {
  const root = await resolveRealRoot(rootDir);
  const hookPath = await readCanonicalHookSource(root);
  const result = spawn(process.execPath, [hookPath.path], {
    cwd: root,
    encoding: "utf8",
    timeout: LOCAL_OBSERVATION_HOOK_TIMEOUT_MS,
    maxBuffer: 64 * 1024,
    windowsHide: true,
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "git status --short" },
    }),
  });
  const outcome = classifyHookResult(result);
  return createLocalObservationReceipt({
    now,
    hookRelativePath: LOCAL_OBSERVATION_HOOK_PATH,
    hookSource: hookPath.source,
    hookEventName: "PreToolUse",
    exitClass: outcome.exitClass,
    primaryDecision: outcome.primaryDecision,
  });
}

export async function writeCreateOnlyObservationReceipt({ rootDir, relativePath, content } = {}) {
  if (typeof content !== "string") throw new TypeError("receipt content must be text");
  if (!isSafeObservationOutputPath(relativePath)) {
    throw new Error("receipt output must stay under output/agent-orchestra/ with a bounded .json filename");
  }
  const root = await resolveRealRoot(rootDir);
  const target = path.resolve(root, relativePath);
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("receipt output must stay under output/agent-orchestra/");
  }
  const parent = await createRealReceiptParent(root);
  const canonicalRoot = await realpath(root);
  const canonicalParent = await realpath(parent);
  if (canonicalParent !== canonicalRoot && !canonicalParent.startsWith(`${canonicalRoot}${path.sep}`)) {
    throw new Error("receipt output parent escapes the repository through a symlink");
  }

  const flags =
    fsConstants.O_WRONLY |
    fsConstants.O_CREAT |
    fsConstants.O_EXCL |
    (fsConstants.O_NOFOLLOW ?? 0);
  let handle;
  try {
    handle = await open(target, flags, 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`receipt output already exists: ${relativePath}`);
    throw new Error("receipt output could not be created safely");
  }
  try {
    await handle.writeFile(content, "utf8");
    await handle.chmod(0o600);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function validateRepository(repository, errors) {
  if (!isPlainObject(repository)) {
    errors.push("receipt.repository must be an object");
    return;
  }
  rejectUnknownKeys(repository, new Set(["hook_relative_path", "hook_sha256"]), "receipt.repository", errors);
  if (repository.hook_relative_path !== LOCAL_OBSERVATION_HOOK_PATH) {
    errors.push("receipt.repository.hook_relative_path must be the canonical skill-router hook");
  }
  if (!isSha256(repository.hook_sha256)) errors.push("receipt.repository.hook_sha256 must be a SHA-256 digest");
}

function validateObservation(observation, errors) {
  if (!isPlainObject(observation)) {
    errors.push("receipt.observation must be an object");
    return;
  }
  rejectUnknownKeys(observation, new Set(["hook_event_name", "exit_class", "primary_decision"]), "receipt.observation", errors);
  if (observation.hook_event_name !== "PreToolUse") {
    errors.push("receipt.observation.hook_event_name must be PreToolUse");
  }
  if (!EXIT_CLASSES.has(observation.exit_class)) errors.push("receipt.observation.exit_class is invalid");
  if (!PRIMARY_DECISIONS.has(observation.primary_decision)) errors.push("receipt.observation.primary_decision is invalid");
  if ((observation.exit_class === "ALLOW" && observation.primary_decision !== "ALLOW") ||
      (observation.exit_class === "BLOCK" && observation.primary_decision !== "BLOCK") ||
      (observation.exit_class === "ERROR" && observation.primary_decision !== "NONE")) {
    errors.push("receipt.observation.exit_class and primary_decision conflict");
  }
}

function validateHostRuntime(hostRuntime, errors) {
  if (!isPlainObject(hostRuntime)) {
    errors.push("receipt.host_runtime must be an object");
    return;
  }
  rejectUnknownKeys(
    hostRuntime,
    new Set(["custom_profile_loading", "effective_permissions", "lifecycle_delivery"]),
    "receipt.host_runtime",
    errors,
  );
  for (const key of ["custom_profile_loading", "effective_permissions", "lifecycle_delivery"]) {
    if (hostRuntime[key] !== "UNVERIFIED") {
      errors.push(`receipt.host_runtime.${key} must stay UNVERIFIED in a local receipt`);
    }
  }
}

async function resolveRealRoot(rootDir) {
  if (typeof rootDir !== "string" || rootDir.trim() === "") {
    throw new TypeError("observation root must be a non-empty path");
  }
  const root = path.resolve(rootDir);
  let stats;
  try {
    stats = await lstat(root);
  } catch {
    throw new Error("observation root must be an existing real directory");
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error("observation root must be an existing real directory");
  }
  return root;
}

async function readCanonicalHookSource(root) {
  const hookPath = path.join(root, LOCAL_OBSERVATION_HOOK_PATH);
  let stats;
  try {
    stats = await lstat(hookPath);
  } catch {
    throw new Error("canonical skill-router hook is unavailable");
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error("canonical skill-router hook must be a regular file");
  }
  return { path: hookPath, source: await readFile(hookPath, "utf8") };
}

async function createRealReceiptParent(root) {
  let current = root;
  for (const segment of ["output", "agent-orchestra"]) {
    current = path.join(current, segment);
    let stats;
    try {
      stats = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT") throw new Error("receipt output parent could not be inspected safely");
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (mkdirError) {
        if (mkdirError?.code !== "EEXIST") throw new Error("receipt output parent could not be created safely");
      }
      try {
        stats = await lstat(current);
      } catch {
        throw new Error("receipt output parent could not be inspected safely");
      }
    }
    if (stats.isSymbolicLink()) throw new Error("receipt output parent is a symlink");
    if (!stats.isDirectory()) throw new Error("receipt output parent is not a directory");
  }
  return current;
}

function classifyHookResult(result) {
  if (result?.error) return { exitClass: "ERROR", primaryDecision: "NONE" };
  if (result?.status === 0) {
    const output = String(result.stdout || "").trim();
    if (!output) return { exitClass: "ALLOW", primaryDecision: "ALLOW" };
    try {
      const parsed = JSON.parse(output);
      const decision = parsed?.hookSpecificOutput?.permissionDecision ?? parsed?.decision;
      if (decision === "deny" || decision === "block") {
        return { exitClass: "BLOCK", primaryDecision: "BLOCK" };
      }
      return { exitClass: "ALLOW", primaryDecision: "ALLOW" };
    } catch {
      return { exitClass: "ERROR", primaryDecision: "NONE" };
    }
  }
  if (result?.status === 2) return { exitClass: "BLOCK", primaryDecision: "BLOCK" };
  return { exitClass: "ERROR", primaryDecision: "NONE" };
}

function isSafeObservationOutputPath(value) {
  return typeof value === "string" && /^output\/agent-orchestra\/[a-z0-9][a-z0-9._-]{0,119}\.json$/.test(value);
}

function rejectUnknownKeys(value, allowed, label, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} contains unknown key ${key}`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isExactIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function sameStringArray(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}
