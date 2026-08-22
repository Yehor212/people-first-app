#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const LOCK_NAMESPACE_VERSION = "zenflow-shared-build-v2";
const REPOSITORY_LOCK_HASH_DOMAIN = "zenflow-shared-dist-repository-v2\0";
const USER_NAMESPACE_HASH_DOMAIN = "zenflow-shared-dist-user-v2\0";
const LOCK_OWNER_FILE = "owner.json";
const MAX_OWNER_METADATA_BYTES = 4_096;
const NONCE_PATTERN = /^[a-f0-9]{64}$/;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SUPPORTED_TARGET_MODES = new Set([
  "web:production",
  "web:development",
  "android:production",
  "ios:production",
  "tauri:production",
]);
const SAFE_TARGETS = new Set(["web", "android", "ios", "tauri"]);
const SAFE_MODES = new Set(["production", "development"]);
const FEATURE_CAPABILITY_PLATFORMS = Object.freeze({
  web: "web-pages",
  android: "android",
  ios: "ios",
  tauri: "tauri",
});
const ACTIVE_LEASES = new WeakSet();

export class SharedDistBuildError extends Error {
  constructor(code, message, options) {
    super(`SHARED DIST BUILD: ${message}`, options);
    this.name = "SharedDistBuildError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new SharedDistBuildError(code, message, options);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasErrorCode(error, code) {
  return isPlainObject(error) && error.code === code;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSupportedTargetMode(target, mode) {
  if (
    typeof target !== "string" ||
    typeof mode !== "string" ||
    !SUPPORTED_TARGET_MODES.has(`${target}:${mode}`)
  ) {
    fail("USAGE", "unsupported target/mode combination");
  }
}

function assertProductionWebEnvironment(env) {
  if (env.CAPACITOR_BUILD === "true") {
    fail("CONTEXT", "production-web validation/build cannot run with CAPACITOR_BUILD=true");
  }
}

function resolveRoot(rootDir) {
  if (typeof rootDir !== "string" || rootDir.length === 0) {
    fail("ROOT", "repository root is required");
  }
  try {
    const root = realpathSync(path.resolve(rootDir));
    const stat = lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail("ROOT", "repository root must be a real directory");
    }
    return root;
  } catch (error) {
    if (error instanceof SharedDistBuildError) throw error;
    fail("ROOT", "repository root is unavailable");
  }
}

function assertPathInside(basePath, candidatePath, message) {
  const relative = path.relative(basePath, candidatePath);
  if (
    relative === "" ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    fail("LOCK_PATH", message);
  }
}

function resolveExternalLockBase(lockBaseDir) {
  let requestedBase;
  if (lockBaseDir === undefined) {
    try {
      requestedBase = realpathSync(tmpdir());
    } catch {
      fail("LOCK_BASE", "machine-local temporary directory is unavailable");
    }
  } else {
    if (typeof lockBaseDir !== "string" || lockBaseDir.length === 0) {
      fail("LOCK_BASE", "external lock base must be a non-empty directory path");
    }
    requestedBase = path.resolve(lockBaseDir);
  }

  let stat;
  try {
    stat = lstatSync(requestedBase);
  } catch {
    fail("LOCK_BASE", "external lock base is unavailable");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail("LOCK_BASE", "external lock base must be a real directory, not a symbolic link");
  }
  try {
    return realpathSync(requestedBase);
  } catch {
    fail("LOCK_BASE", "external lock base could not be canonicalized");
  }
}

function userLockNamespaceName() {
  const uid = typeof process.getuid === "function" ? String(process.getuid()) : "no-posix-uid";
  const userIdentityHash = sha256(
    `${USER_NAMESPACE_HASH_DOMAIN}${uid}\0${path.resolve(homedir())}`
  );
  return `${LOCK_NAMESPACE_VERSION}-${userIdentityHash.slice(0, 32)}`;
}

function repositoryLockName(canonicalRoot) {
  return `repo-${sha256(`${REPOSITORY_LOCK_HASH_DOMAIN}${canonicalRoot}`)}.lock`;
}

function assertPrivateNamespace(stat) {
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    fail("LOCK_NAMESPACE", "machine-local lock namespace is owned by another user");
  }
  if (process.platform !== "win32" && (stat.mode & 0o777) !== 0o700) {
    fail("LOCK_NAMESPACE", "machine-local lock namespace permissions must be 0700");
  }
}

function resolveMachineLocalLockNamespace(lockBaseDir, { create }) {
  const externalBase = resolveExternalLockBase(lockBaseDir);
  const requestedNamespace = path.join(externalBase, userLockNamespaceName());
  let stat;
  try {
    stat = lstatSync(requestedNamespace);
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      fail("LOCK_NAMESPACE", "could not inspect the machine-local lock namespace");
    }
    if (!create) return requestedNamespace;
    try {
      mkdirSync(requestedNamespace, { mode: 0o700 });
    } catch (mkdirError) {
      if (!hasErrorCode(mkdirError, "EEXIST")) {
        fail("LOCK_NAMESPACE", "could not create the machine-local lock namespace");
      }
    }
    try {
      stat = lstatSync(requestedNamespace);
    } catch {
      fail("LOCK_NAMESPACE", "could not verify the machine-local lock namespace");
    }
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail("LOCK_NAMESPACE", "machine-local lock namespace must not be a symbolic link");
  }
  assertPrivateNamespace(stat);

  let canonicalNamespace;
  try {
    canonicalNamespace = realpathSync(requestedNamespace);
  } catch {
    fail("LOCK_NAMESPACE", "machine-local lock namespace could not be canonicalized");
  }
  assertPathInside(
    externalBase,
    canonicalNamespace,
    "machine-local lock namespace escaped the external lock base"
  );
  if (canonicalNamespace !== requestedNamespace) {
    fail("LOCK_NAMESPACE", "machine-local lock namespace must not traverse a symbolic link");
  }
  return canonicalNamespace;
}

export function sharedDistBuildLockPath(rootDir, options = {}) {
  if (!isPlainObject(options)) fail("LOCK_BASE", "lock path options must be an object");
  const canonicalRoot = resolveRoot(rootDir);
  const namespace = resolveMachineLocalLockNamespace(options.lockBaseDir, { create: false });
  return path.join(namespace, repositoryLockName(canonicalRoot));
}

function prepareLockPath(rootDir, lockBaseDir) {
  const namespace = resolveMachineLocalLockNamespace(lockBaseDir, { create: true });
  return path.join(namespace, repositoryLockName(rootDir));
}

function parseSafeOwnerMetadata(lockPath) {
  try {
    const lockStat = lstatSync(lockPath);
    if (!lockStat.isDirectory() || lockStat.isSymbolicLink()) return null;
    const ownerPath = path.join(lockPath, LOCK_OWNER_FILE);
    const ownerStat = lstatSync(ownerPath);
    if (
      !ownerStat.isFile() ||
      ownerStat.isSymbolicLink() ||
      ownerStat.size <= 0 ||
      ownerStat.size > MAX_OWNER_METADATA_BYTES
    ) {
      return null;
    }
    const parsed = JSON.parse(readFileSync(ownerPath, "utf8"));
    if (
      !isPlainObject(parsed) ||
      parsed.schemaVersion !== 1 ||
      !Number.isSafeInteger(parsed.pid) ||
      parsed.pid <= 0 ||
      !SAFE_TARGETS.has(parsed.target) ||
      !SAFE_MODES.has(parsed.mode) ||
      !ISO_INSTANT_PATTERN.test(parsed.startedAt) ||
      Number.isNaN(Date.parse(parsed.startedAt)) ||
      !NONCE_PATTERN.test(parsed.nonce)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function foreignLockMessage(lockPath) {
  const owner = parseSafeOwnerMetadata(lockPath);
  if (!owner)
    return "shared dist is already locked; owner metadata unavailable; manual review required";
  return (
    `shared dist is already locked by pid ${owner.pid} for ${owner.target}/${owner.mode}` +
    ` since ${owner.startedAt}; no automatic stale-lock reclaim is allowed`
  );
}

export function acquireSharedDistBuildLock({ rootDir, lockBaseDir, target, mode }) {
  assertSupportedTargetMode(target, mode);
  const canonicalRoot = resolveRoot(rootDir);
  let lockPath;
  try {
    lockPath = prepareLockPath(canonicalRoot, lockBaseDir);
  } catch (error) {
    if (error instanceof SharedDistBuildError) throw error;
    fail("LOCK_PATH", "could not prepare the shared build lock location");
  }

  try {
    mkdirSync(lockPath, { mode: 0o700 });
  } catch (error) {
    if (hasErrorCode(error, "EEXIST")) {
      fail("LOCKED", foreignLockMessage(lockPath));
    }
    fail("LOCK_ACQUIRE", "could not acquire the shared dist build lock");
  }

  const nonce = randomBytes(32).toString("hex");
  const ownerPath = path.join(lockPath, LOCK_OWNER_FILE);
  const metadata = {
    schemaVersion: 1,
    pid: process.pid,
    target,
    mode,
    startedAt: new Date().toISOString(),
    nonce,
  };
  try {
    writeFileSync(ownerPath, `${JSON.stringify(metadata)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    try {
      rmdirSync(lockPath);
    } catch {
      // The newly acquired directory is intentionally left fail-closed if it is no longer empty.
    }
    fail("LOCK_INIT", "could not initialize lock ownership; manual review may be required");
  }

  const lease = Object.freeze({
    rootDir: canonicalRoot,
    lockPath,
    ownerPath,
    pid: process.pid,
    target,
    mode,
    nonce,
  });
  ACTIVE_LEASES.add(lease);
  return lease;
}

export function assertSharedDistBuildUnlocked(rootDir, { lockBaseDir } = {}) {
  const canonicalRoot = resolveRoot(rootDir);
  const lockPath = sharedDistBuildLockPath(canonicalRoot, { lockBaseDir });
  try {
    lstatSync(lockPath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return;
    fail("LOCK_PATH", "could not inspect shared dist build lock state");
  }
  fail("LOCKED", foreignLockMessage(lockPath));
}

function ownsLease(lease) {
  if (
    !isPlainObject(lease) ||
    !ACTIVE_LEASES.has(lease) ||
    !NONCE_PATTERN.test(lease.nonce) ||
    lease.ownerPath !== path.join(lease.lockPath, LOCK_OWNER_FILE)
  ) {
    return false;
  }
  const owner = parseSafeOwnerMetadata(lease.lockPath);
  return Boolean(
    owner &&
    owner.pid === lease.pid &&
    owner.target === lease.target &&
    owner.mode === lease.mode &&
    owner.nonce === lease.nonce
  );
}

export function releaseSharedDistBuildLock(lease) {
  if (!ownsLease(lease)) {
    fail(
      "LOCK_OWNERSHIP",
      "lock release requires the exact module-issued lease and owner path; lock was left in place"
    );
  }

  let entries;
  try {
    entries = readdirSync(lease.lockPath);
  } catch {
    fail("LOCK_RELEASE", "could not inspect the owned lock; lock was left in place");
  }
  if (entries.length !== 1 || entries[0] !== LOCK_OWNER_FILE) {
    fail("LOCK_RELEASE", "owned lock contains unexpected entries; lock was left in place");
  }

  try {
    unlinkSync(path.join(lease.lockPath, LOCK_OWNER_FILE));
    rmdirSync(lease.lockPath);
  } catch {
    fail("LOCK_RELEASE", "could not fully release the owned lock; manual review required");
  }
  ACTIVE_LEASES.delete(lease);
}

export function withSharedDistBuildLock(options, operation) {
  if (typeof operation !== "function")
    fail("OPERATION", "a synchronous build operation is required");
  const lease = acquireSharedDistBuildLock(options);
  let result;
  let operationError;
  try {
    result = operation();
    if (result && typeof result.then === "function") {
      fail(
        "OPERATION",
        "asynchronous operations are not allowed inside the synchronous build lock"
      );
    }
  } catch (error) {
    operationError = error;
  }

  let releaseError;
  try {
    releaseSharedDistBuildLock(lease);
  } catch (error) {
    releaseError = error;
  }

  if (operationError && releaseError) {
    fail("LOCK_RELEASE", "build failed and its lock could not be safely released", {
      cause: new AggregateError([operationError, releaseError]),
    });
  }
  if (releaseError) throw releaseError;
  if (operationError) throw operationError;
  return result;
}

export function parseSharedDistBuildArgs(argv) {
  if (!Array.isArray(argv)) fail("USAGE", "arguments must be an array");
  if (argv.length === 1 && argv[0] === "--validate-production-web") {
    return { kind: "validate-production-web" };
  }
  if (argv.includes("--validate-production-web")) {
    fail("USAGE", "--validate-production-web does not accept additional arguments");
  }

  let target;
  let mode;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option !== "--target" && option !== "--mode") {
      fail("USAGE", "unknown or extra option");
    }
    const value = argv[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      fail("USAGE", "option value is missing");
    }
    if (option === "--target") {
      if (target !== undefined) fail("USAGE", "duplicate --target option");
      target = value;
    } else {
      if (mode !== undefined) fail("USAGE", "duplicate --mode option");
      mode = value;
    }
    index += 1;
  }
  assertSupportedTargetMode(target, mode);
  return { kind: "build", target, mode };
}

function command(label, executable, args, env) {
  const result = {
    label,
    executable,
    args: Object.freeze([...args]),
  };
  if (env !== undefined) result.env = Object.freeze({ ...env });
  return Object.freeze(result);
}

function nodeCommand(nodeExecutable, label, args, env) {
  return command(label, nodeExecutable, args, env);
}

function tokenCommand(rootDir, nodeExecutable, env) {
  return nodeCommand(
    nodeExecutable,
    "design tokens",
    [
      path.join(rootDir, "node_modules", "style-dictionary", "bin", "style-dictionary.js"),
      "build",
      "--config",
      path.join(rootDir, "src", "design-tokens", "sd.config.mjs"),
    ],
    env
  );
}

function viteCommand(rootDir, nodeExecutable, label, mode, env) {
  return nodeCommand(
    nodeExecutable,
    label,
    [
      path.join(rootDir, "node_modules", "vite", "bin", "vite.js"),
      "build",
      "--configLoader",
      "runner",
      "--mode",
      mode,
    ],
    env
  );
}

function manifestCommand(rootDir, nodeExecutable, label, lifecycleOption) {
  return nodeCommand(nodeExecutable, label, [
    path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(rootDir, "scripts", "check-ratchet.ts"),
    lifecycleOption,
    "--target",
    "web",
    "--mode",
    "production",
  ]);
}

function pruneCommand(rootDir, nodeExecutable, verify = false) {
  return nodeCommand(
    nodeExecutable,
    verify ? "dist duplicate-artifact verify" : "dist duplicate-artifact prune",
    [
      path.join(rootDir, "scripts", "prune-duplicate-artifacts.cjs"),
      "dist",
      ...(verify ? ["--verify"] : []),
    ]
  );
}

function featureCapabilityEnvironment(target, additional = {}) {
  return {
    ...additional,
    ZENFLOW_FEATURE_CAPABILITY_PLATFORM: FEATURE_CAPABILITY_PLATFORMS[target],
  };
}

function featureCapabilityReceiptCommand(rootDir, nodeExecutable, target) {
  return nodeCommand(nodeExecutable, "feature capability receipt", [
    path.join(rootDir, "scripts", "feature-capability-build.cjs"),
    "--write-receipt",
    "--platform",
    FEATURE_CAPABILITY_PLATFORMS[target],
  ]);
}

function featureCapabilityReceiptCheckCommand(rootDir, nodeExecutable, target) {
  return nodeCommand(nodeExecutable, "feature capability receipt verify", [
    path.join(rootDir, "scripts", "check-feature-capability-receipt.cjs"),
    "--platform",
    FEATURE_CAPABILITY_PLATFORMS[target],
  ]);
}

export function createSharedDistBuildPlan({
  rootDir,
  target,
  mode,
  nodeExecutable = process.execPath,
}) {
  assertSupportedTargetMode(target, mode);
  const canonicalRoot = resolveRoot(rootDir);
  if (typeof nodeExecutable !== "string" || nodeExecutable.length === 0) {
    fail("EXECUTABLE", "Node executable is required");
  }

  if (target === "web" && mode === "production") {
    const webEnvironment = featureCapabilityEnvironment("web");
    return Object.freeze([
      tokenCommand(canonicalRoot, nodeExecutable, webEnvironment),
      manifestCommand(
        canonicalRoot,
        nodeExecutable,
        "production-web manifest begin",
        "--bundle-manifest-begin"
      ),
      viteCommand(
        canonicalRoot,
        nodeExecutable,
        "Vite production web build",
        "production",
        webEnvironment,
      ),
      pruneCommand(canonicalRoot, nodeExecutable),
      featureCapabilityReceiptCommand(canonicalRoot, nodeExecutable, "web"),
      featureCapabilityReceiptCheckCommand(canonicalRoot, nodeExecutable, "web"),
      manifestCommand(
        canonicalRoot,
        nodeExecutable,
        "production-web manifest complete",
        "--bundle-manifest-complete"
      ),
    ]);
  }

  if (target === "web") {
    const webEnvironment = featureCapabilityEnvironment("web");
    return Object.freeze([
      tokenCommand(canonicalRoot, nodeExecutable, webEnvironment),
      viteCommand(
        canonicalRoot,
        nodeExecutable,
        "Vite development web build",
        "development",
        webEnvironment,
      ),
    ]);
  }

  if (target === "tauri") {
    const tauriEnvironment = featureCapabilityEnvironment("tauri", {
      VITE_APP_BASE: "./",
      VITE_DISABLE_PWA: "true",
      VITE_DESKTOP_RUNTIME: "true",
    });
    return Object.freeze([
      tokenCommand(canonicalRoot, nodeExecutable, tauriEnvironment),
      viteCommand(
        canonicalRoot,
        nodeExecutable,
        "Vite production tauri build",
        "production",
        tauriEnvironment,
      ),
      pruneCommand(canonicalRoot, nodeExecutable),
      pruneCommand(canonicalRoot, nodeExecutable, true),
      featureCapabilityReceiptCommand(canonicalRoot, nodeExecutable, "tauri"),
      featureCapabilityReceiptCheckCommand(canonicalRoot, nodeExecutable, "tauri"),
    ]);
  }

  const capacitorEnv = featureCapabilityEnvironment(target, { CAPACITOR_BUILD: "true" });
  return Object.freeze([
    tokenCommand(canonicalRoot, nodeExecutable, capacitorEnv),
    viteCommand(
      canonicalRoot,
      nodeExecutable,
      `Vite production ${target} build`,
      "production",
      capacitorEnv
    ),
    nodeCommand(
      nodeExecutable,
      "Capacitor asset prune",
      [path.join(canonicalRoot, "scripts", "capacitor-prune-assets.cjs")],
      capacitorEnv
    ),
    pruneCommand(canonicalRoot, nodeExecutable),
    pruneCommand(canonicalRoot, nodeExecutable, true),
    featureCapabilityReceiptCommand(canonicalRoot, nodeExecutable, target),
    featureCapabilityReceiptCheckCommand(canonicalRoot, nodeExecutable, target),
  ]);
}

export function createProductionWebValidationPlan({ rootDir, nodeExecutable = process.execPath }) {
  const canonicalRoot = resolveRoot(rootDir);
  return Object.freeze([
    nodeCommand(nodeExecutable, "production-web manifest validate", [
      path.join(canonicalRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(canonicalRoot, "scripts", "validate-production-web-build.ts"),
    ]),
    pruneCommand(canonicalRoot, nodeExecutable, true),
  ]);
}

export function executeSharedDistBuildCommand(commandSpec, { rootDir, env }) {
  const result = spawnSync(commandSpec.executable, commandSpec.args, {
    cwd: rootDir,
    env: { ...env, ...(commandSpec.env ?? {}) },
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    fail("COMMAND_START", `could not start step: ${commandSpec.label}`);
  }
  if (result.signal) {
    fail("COMMAND_SIGNAL", `step terminated by a signal: ${commandSpec.label}`);
  }
  if (result.status !== 0) {
    fail(
      "COMMAND_FAILED",
      `step failed: ${commandSpec.label} (exit ${result.status ?? "unknown"})`
    );
  }
}

function runPlan(plan, { rootDir, env, runCommand, assertSafe }) {
  assertSafe?.();
  for (const commandSpec of plan) {
    assertSafe?.();
    const result = runCommand(commandSpec, { rootDir, env });
    if (result && typeof result.then === "function") {
      fail("RUNNER", "asynchronous command runners are not supported");
    }
    assertSafe?.();
  }
}

export function runSharedDistBuild({
  rootDir,
  lockBaseDir,
  target,
  mode,
  env = process.env,
  nodeExecutable = process.execPath,
  runCommand = executeSharedDistBuildCommand,
}) {
  assertSupportedTargetMode(target, mode);
  if (!isPlainObject(env)) fail("CONTEXT", "build environment must be an object");
  if (target === "web") assertProductionWebEnvironment(env);
  const canonicalRoot = resolveRoot(rootDir);
  const plan = createSharedDistBuildPlan({
    rootDir: canonicalRoot,
    target,
    mode,
    nodeExecutable,
  });
  return withSharedDistBuildLock({ rootDir: canonicalRoot, lockBaseDir, target, mode }, () => {
    runPlan(plan, { rootDir: canonicalRoot, env, runCommand });
  });
}

export function validateProductionWebBuild({
  rootDir,
  lockBaseDir,
  env = process.env,
  nodeExecutable = process.execPath,
  runCommand = executeSharedDistBuildCommand,
}) {
  if (!isPlainObject(env)) fail("CONTEXT", "build environment must be an object");
  assertProductionWebEnvironment(env);
  const canonicalRoot = resolveRoot(rootDir);
  const plan = createProductionWebValidationPlan({ rootDir: canonicalRoot, nodeExecutable });
  return withSharedDistBuildLock(
    { rootDir: canonicalRoot, lockBaseDir, target: "web", mode: "production" },
    () => {
      runPlan(plan, {
        rootDir: canonicalRoot,
        env,
        runCommand,
      });
    }
  );
}

export function runSharedDistBuildCli({
  argv,
  rootDir = REPO_ROOT,
  lockBaseDir,
  env = process.env,
  nodeExecutable = process.execPath,
  runCommand = executeSharedDistBuildCommand,
}) {
  const invocation = parseSharedDistBuildArgs(argv);
  if (invocation.kind === "validate-production-web") {
    validateProductionWebBuild({ rootDir, lockBaseDir, env, nodeExecutable, runCommand });
    return invocation;
  }
  runSharedDistBuild({
    rootDir,
    lockBaseDir,
    target: invocation.target,
    mode: invocation.mode,
    env,
    nodeExecutable,
    runCommand,
  });
  return invocation;
}

function formatCliError(error) {
  if (error instanceof SharedDistBuildError) return error.message.slice(0, 1_024);
  return "SHARED DIST BUILD: unexpected failure (details withheld)";
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const result = runSharedDistBuildCli({ argv: process.argv.slice(2) });
    if (result.kind === "validate-production-web") {
      console.log("SHARED DIST BUILD: production-web artifact validation completed");
    } else {
      console.log(`SHARED DIST BUILD: completed ${result.target}/${result.mode}`);
    }
  } catch (error) {
    console.error(formatCliError(error));
    process.exitCode = 1;
  }
}
