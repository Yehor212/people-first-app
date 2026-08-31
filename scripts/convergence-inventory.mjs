#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const {
  aliasLocator,
  classifyRefRelation,
  parseWorktreePorcelain,
  summarizeInventory,
} = require("./convergence-inventory-core.cjs");
const { isCanonicalRemoteUrl } = require("./agent-workspace-core.cjs");

const SCHEMA = "zenflow-convergence-inventory/v1";
const SHA_PATTERN = /^[0-9a-f]{40,64}$/;
const GH_FIELDS =
  "number,title,headRefName,headRefOid,baseRefName,isDraft,mergeable,updatedAt,author,url";

export function parseArguments(argv) {
  const parsed = {};
  const additionalRoots = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${token} requires a value`);
    if (token === "--additional-root") additionalRoots.push(value);
    else parsed[token.slice(2)] = value;
    index += 1;
  }
  const options = {
    legacyRoot: parsed["legacy-root"],
    canonicalRoot: parsed["canonical-root"],
    outputDir: parsed["output-dir"],
    additionalRoots,
    expectedMainSha: parsed["expected-main-sha"],
  };
  for (const [name, value] of [
    ["legacy-root", options.legacyRoot],
    ["canonical-root", options.canonicalRoot],
    ["output-dir", options.outputDir],
  ]) {
    if (!value) throw new Error(`${name} is required`);
    if (!path.isAbsolute(value)) throw new Error(`${name} must be absolute`);
  }
  for (const value of options.additionalRoots) {
    if (!path.isAbsolute(value)) throw new Error("additional-root must be absolute");
  }
  if (!SHA_PATTERN.test(options.expectedMainSha || "")) {
    throw new Error("expected-main-sha must be a 40-64 character hexadecimal object id");
  }
  return options;
}

export function validateOutputLocation(outputDir, repositoryRoots) {
  if (!path.isAbsolute(outputDir)) throw new Error("output-dir must be absolute");
  const output = path.resolve(outputDir);
  for (const root of repositoryRoots) {
    const repository = path.resolve(root);
    if (isInsideOrEqual(repository, output)) {
      throw new Error("private output must remain outside every repository");
    }
  }
  return output;
}

export async function resolveAndValidateOutputLocation(outputDir, repositoryRoots) {
  const output = await canonicalProspectivePath(outputDir);
  const roots = [];
  for (const root of repositoryRoots) roots.push(await canonicalProspectivePath(root));
  return validateOutputLocation(output, roots);
}

export function sanitizeStatusEntry(code, statusPath) {
  const normalized = String(statusPath || "").replace(/\\/g, "/");
  if (secretLikePath(normalized)) {
    return {
      code,
      pathCategory: "SECRET_LIKE",
      pathHash: sha256(normalized).slice(0, 16),
    };
  }
  return { code, path: normalized };
}

export async function collectInventory(options, dependencies = {}) {
  const run = dependencies.run || runCommand;
  const now = dependencies.now || (() => new Date().toISOString());
  const repositoryRoots = [
    options.legacyRoot,
    options.canonicalRoot,
    ...(options.additionalRoots || []),
  ].map((item) => path.resolve(item));
  await resolveAndValidateOutputLocation(options.outputDir, repositoryRoots);

  for (const root of repositoryRoots) {
    const remote = await required(run, {
      command: "git",
      args: ["remote", "get-url", "origin"],
      cwd: root,
    });
    if (!isCanonicalRemoteUrl(remote.trim())) {
      throw new Error("repository remote identity is not canonical");
    }
    const pushRemotes = await required(run, {
      command: "git",
      args: ["remote", "get-url", "--push", "--all", "origin"],
      cwd: root,
    });
    if (lines(pushRemotes).some((pushRemote) => !isCanonicalRemoteUrl(pushRemote))) {
      throw new Error("repository push remote identity is not canonical");
    }
  }

  const canonicalHead = (
    await required(run, {
      command: "git",
      args: ["rev-parse", "HEAD"],
      cwd: options.canonicalRoot,
    })
  ).trim();
  const canonicalMain = (
    await required(run, {
      command: "git",
      args: ["rev-parse", "refs/remotes/origin/main"],
      cwd: options.canonicalRoot,
    })
  ).trim();
  if (canonicalHead !== options.expectedMainSha || canonicalMain !== options.expectedMainSha) {
    throw new Error("canonical HEAD and origin/main must equal the expected main SHA");
  }

  const aliases = locatorAliases(options);
  const registriesByCommonDir = new Map();
  for (const root of repositoryRoots) {
    const commonDirText = await required(run, {
      command: "git",
      args: ["rev-parse", "--git-common-dir"],
      cwd: root,
    });
    const commonDir = path.resolve(root, commonDirText.trim());
    if (registriesByCommonDir.has(commonDir)) continue;
    const head = (
      await required(run, {
        command: "git",
        args: ["rev-parse", "HEAD"],
        cwd: root,
      })
    ).trim();
    const worktreeText = await required(run, {
      command: "git",
      args: ["worktree", "list", "--porcelain"],
      cwd: root,
    });
    registriesByCommonDir.set(commonDir, {
      id: `registry_${sha256(commonDir).slice(0, 16)}`,
      sourceRoot: root,
      commonDir,
      head,
      worktreeRecords: parseWorktreePorcelain(worktreeText),
    });
  }
  const registries = [...registriesByCommonDir.values()];
  await resolveAndValidateOutputLocation(options.outputDir, [
    ...repositoryRoots,
    ...registries.flatMap((registry) => registry.worktreeRecords.map((record) => record.path)),
  ]);
  const lsofResult = await optional(run, {
    command: "lsof",
    args: ["-nP", "-a", "-d", "cwd", "-Fpcn"],
  });
  const cwdProcesses =
    lsofResult.status === 0
      ? parseLsofLocations(lsofResult.stdout).map((process) => ({ ...process, evidence: "cwd" }))
      : [];
  const handleResult = await optional(run, {
    command: "lsof",
    args: ["-nP", "-Fpcn"],
    timeout: 30_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const openHandles =
    handleResult.status === 0
      ? parseLsofLocations(handleResult.stdout).map((process) => ({
          ...process,
          evidence: "handle",
        }))
      : [];
  const warnings = [];
  if (lsofResult.status !== 0) warnings.push("PROCESS_CWD_PROBE_UNVERIFIED");
  if (handleResult.status !== 0) warnings.push("OPEN_HANDLE_PROBE_UNVERIFIED");

  const worktrees = [];
  const seenWorktrees = new Set();
  for (const registry of registries) {
    for (const record of registry.worktreeRecords) {
      if (seenWorktrees.has(record.path)) continue;
      seenWorktrees.add(record.path);
      const first = await observeWorktree(run, record.path);
      const activeProcesses = cwdProcesses.filter((process) =>
        isInsideOrEqual(record.path, process.location)
      );
      const handleProcesses = openHandles.filter((process) =>
        isInsideOrEqual(record.path, process.location)
      );
      const writerProcesses = dedupeProcesses([...activeProcesses, ...handleProcesses]);
      const second = await observeWorktree(run, record.path);
      const stable =
        first.ok &&
        second.ok &&
        first.head === second.head &&
        first.statusHash === second.statusHash;
      const activity =
        writerProcesses.length > 0
          ? "ACTIVE_SKIP"
          : stable && handleResult.status === 0
            ? "FROZEN"
            : "UNVERIFIED";
      if (!stable) warnings.push(`WORKTREE_UNVERIFIED:${sha256(record.path).slice(0, 16)}`);
      worktrees.push({
        id: `worktree_${sha256(record.path).slice(0, 16)}`,
        registryId: registry.id,
        locator: aliasLocator(record.path, aliases),
        head: stable ? first.head : record.head,
        branch: record.branch,
        detached: record.detached,
        locked: record.locked,
        prunable: record.prunable,
        activity,
        changeCount: stable ? first.statusEntries.length : null,
        ignoredCount: stable ? first.ignoredEntries.length : null,
        statusHash: stable ? first.statusHash : null,
        statusEntries: stable ? first.statusEntries : [],
        ignoredEntries: stable ? first.ignoredEntries : [],
        activeProcesses: writerProcesses.map((process) => ({
          pid: process.pid,
          command: process.command,
          evidence: process.evidence,
          ...(process.cwdLocation
            ? { cwd: aliasLocator(process.cwdLocation, aliases) }
            : {}),
        })),
      });
    }
  }

  const registryRefs = [];
  for (const registry of registries) {
    const observedRefs = await collectRefs(run, registry.sourceRoot, options.expectedMainSha);
    registryRefs.push(...observedRefs.map((ref) => ({ ...ref, registryId: registry.id })));
  }
  const refsByIdentity = new Map();
  for (const ref of registryRefs) {
    const key = `${ref.name}\0${ref.head}`;
    const existing = refsByIdentity.get(key);
    if (existing) {
      existing.registryIds.push(ref.registryId);
      continue;
    }
    const { registryId, ...logicalRef } = ref;
    refsByIdentity.set(key, { ...logicalRef, registryIds: [registryId] });
  }
  const refs = [...refsByIdentity.values()]
    .map((ref) => ({ ...ref, registryIds: [...new Set(ref.registryIds)].sort() }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.head.localeCompare(right.head));
  const pullRequestText = await required(run, {
    command: "gh",
    args: [
      "pr",
      "list",
      "--repo",
      "Yehor212/people-first-app",
      "--state",
      "open",
      "--limit",
      "100",
      "--json",
      GH_FIELDS,
    ],
    cwd: options.canonicalRoot,
  });
  const pullRequests = parsePullRequests(pullRequestText);

  const inventory = {
    schema: SCHEMA,
    observedAt: now(),
    expectedMainSha: options.expectedMainSha,
    canonical: {
      locator: aliasLocator(options.canonicalRoot, aliases),
      head: canonicalHead,
      originMain: canonicalMain,
      repository: "github.com/yehor212/people-first-app",
    },
    registries: registries.map((registry) => ({
      id: registry.id,
      sourceRoot: aliasLocator(registry.sourceRoot, aliases),
      commonDir: aliasLocator(registry.commonDir, aliases),
      head: registry.head,
      worktreeCount: registry.worktreeRecords.length,
    })),
    worktrees,
    refs,
    pullRequests,
    warnings: [...new Set(warnings)].sort(),
  };
  inventory.summary = summarizeInventory(inventory);
  return inventory;
}

export function renderPublicSummary(inventory) {
  return {
    schema: inventory.schema,
    observedAt: inventory.observedAt,
    expectedMainSha: inventory.expectedMainSha,
    counts: summarizeInventory(inventory),
    warningCount: Array.isArray(inventory.warnings) ? inventory.warnings.length : 0,
    outputAlias: "private-live-inventory",
  };
}

export async function writePrivateSnapshots({ inventory, outputDir, repositoryRoots }) {
  if (!Array.isArray(repositoryRoots) || repositoryRoots.length === 0) {
    throw new Error("repositoryRoots are required for private output validation");
  }
  const output = await resolveAndValidateOutputLocation(outputDir, repositoryRoots);
  await mkdir(output, { recursive: true, mode: 0o700 });
  await chmod(output, 0o700);
  const directoryInfo = await lstat(output, { bigint: true });
  if (
    !directoryInfo.isDirectory() ||
    directoryInfo.isSymbolicLink() ||
    Number(directoryInfo.mode & 0o777n) !== 0o700
  ) {
    throw new Error("private output directory must be mode 0700");
  }
  const inventoryPath = path.join(output, "inventory.json");
  const summaryPath = path.join(output, "summary.json");
  await atomicPrivateWrite(output, "inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);
  await atomicPrivateWrite(
    output,
    "summary.json",
    `${JSON.stringify(renderPublicSummary(inventory), null, 2)}\n`
  );
  const directoryAfter = await lstat(output, { bigint: true });
  if (
    directoryAfter.dev !== directoryInfo.dev ||
    directoryAfter.ino !== directoryInfo.ino ||
    !directoryAfter.isDirectory() ||
    directoryAfter.isSymbolicLink()
  ) {
    throw new Error("private output directory identity changed during snapshot write");
  }
  return { inventoryPath, summaryPath };
}

async function collectRefs(run, legacyRoot, mainSha) {
  const text = await required(run, {
    command: "git",
    args: [
      "for-each-ref",
      "--format=%(objectname)%09%(refname)",
      "refs/heads",
      "refs/remotes/origin",
    ],
    cwd: legacyRoot,
  });
  const refs = [];
  for (const line of lines(text)) {
    const [head, name] = line.split("\t", 2);
    if (!head || !name) continue;
    if (["refs/heads/main", "refs/remotes/origin/main", "refs/remotes/origin/HEAD"].includes(name)) {
      continue;
    }
    const relation = await optional(run, {
      command: "git",
      args: ["rev-list", "--left-right", "--count", `${name}...${mainSha}`],
      cwd: legacyRoot,
    });
    if (relation.status !== 0) {
      refs.push({ name, head, ahead: null, behind: null, unique: null, equivalent: null, classification: "UNRELATED" });
      continue;
    }
    const [ahead, behind] = relation.stdout.trim().split(/\s+/).map(Number);
    let unique = 0;
    let equivalent = 0;
    if (ahead > 0) {
      const cherry = await optional(run, {
        command: "git",
        args: ["cherry", mainSha, name],
        cwd: legacyRoot,
      });
      if (cherry.status !== 0) {
        refs.push({ name, head, ahead: null, behind: null, unique: null, equivalent: null, classification: "UNRELATED" });
        continue;
      }
      for (const row of lines(cherry.stdout)) {
        if (row.startsWith("+ ")) unique += 1;
        else if (row.startsWith("- ")) equivalent += 1;
      }
    }
    const input = { ahead, behind, unique, equivalent };
    refs.push({
      name,
      head,
      ...input,
      nonPatchCommitCount: ahead - unique - equivalent,
      classification: classifyRefRelation(input),
    });
  }
  return refs.sort((left, right) => left.name.localeCompare(right.name));
}

async function observeWorktree(run, worktreePath) {
  const status = await optional(run, {
    command: "git",
    args: ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
    cwd: worktreePath,
  });
  const head = await optional(run, {
    command: "git",
    args: ["rev-parse", "HEAD"],
    cwd: worktreePath,
  });
  const ignored = await optional(run, {
    command: "git",
    args: ["status", "--porcelain=v1", "--ignored", "--untracked-files=normal", "-z"],
    cwd: worktreePath,
  });
  if (status.status !== 0 || head.status !== 0 || ignored.status !== 0) {
    return {
      ok: false,
      head: null,
      statusHash: null,
      statusEntries: [],
      ignoredEntries: [],
    };
  }
  const ignoredEntries = parseStatus(ignored.stdout).filter((entry) => entry.code === "!!");
  return {
    ok: true,
    head: head.stdout.trim(),
    statusHash: sha256(`${status.stdout}\0ignored\0${ignored.stdout}`),
    statusEntries: parseStatus(status.stdout),
    ignoredEntries,
  };
}

function parseStatus(text) {
  const records = String(text || "").split("\0").filter(Boolean);
  const result = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const code = record.slice(0, 2);
    const statusPath = record.slice(3);
    result.push(sanitizeStatusEntry(code, statusPath));
    if (/[RC]/.test(code)) index += 1;
  }
  return result;
}

function parseLsofLocations(text) {
  const result = [];
  let pid = null;
  let command = "unknown";
  for (const line of String(text || "").split(/\r?\n/)) {
    if (line.startsWith("p")) {
      pid = Number(line.slice(1));
      command = "unknown";
    } else if (line.startsWith("c")) {
      command = line.slice(1).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "unknown";
    } else if (line.startsWith("n") && Number.isInteger(pid) && path.isAbsolute(line.slice(1))) {
      result.push({ pid, command, location: line.slice(1) });
    }
  }
  return result;
}

function dedupeProcesses(processes) {
  const unique = new Map();
  for (const process of processes) {
    const key = `${process.pid}\0${process.command}`;
    const existing = unique.get(key) || {
      pid: process.pid,
      command: process.command,
      evidence: [],
      cwdLocation: null,
    };
    existing.evidence.push(process.evidence);
    if (process.evidence === "cwd") existing.cwdLocation = process.location;
    unique.set(key, existing);
  }
  for (const process of unique.values()) {
    process.evidence = [...new Set(process.evidence)].sort();
  }
  return [...unique.values()].sort((left, right) => left.pid - right.pid);
}

function parsePullRequests(text) {
  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    throw new Error("GitHub pull-request inventory is not valid JSON");
  }
  if (!Array.isArray(rows)) throw new Error("GitHub pull-request inventory must be an array");
  return rows.map((row) => ({
    number: row.number,
    title: String(row.title || "").slice(0, 300),
    headRefName: row.headRefName,
    headRefOid: row.headRefOid,
    baseRefName: row.baseRefName,
    isDraft: Boolean(row.isDraft),
    mergeable: row.mergeable || "UNKNOWN",
    updatedAt: row.updatedAt,
    authorLogin: row.author?.login || "unknown",
    authorIsBot: Boolean(row.author?.is_bot),
    state: "OPEN",
    url: row.url,
  }));
}

function locatorAliases(options) {
  const home = os.homedir();
  return [
    { alias: "legacy", path: options.legacyRoot },
    { alias: "canonical", path: options.canonicalRoot },
    { alias: "zenflow", path: path.dirname(options.canonicalRoot) },
    { alias: "home-codex", path: path.join(home, ".codex") },
    { alias: "home-config", path: path.join(home, ".config") },
  ];
}

async function required(run, request) {
  const result = await invoke(run, request);
  if (result.status !== 0) throw new Error(`${request.command} probe failed`);
  return result.stdout;
}

async function optional(run, request) {
  return invoke(run, request);
}

async function invoke(run, request) {
  return run({
    command: request.command,
    args: [...request.args],
    cwd: request.cwd,
    shell: false,
    timeout: request.timeout || 30_000,
    maxBuffer: request.maxBuffer || 16 * 1024 * 1024,
  });
}

async function runCommand({ command, args, cwd, shell, timeout, maxBuffer }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer,
    shell,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.error ? 1 : result.status ?? 1,
  };
}

async function atomicPrivateWrite(outputDir, fileName, text) {
  if (!["inventory.json", "summary.json"].includes(fileName)) {
    throw new Error("private snapshot filename is not allowlisted");
  }
  const targetPath = path.join(outputDir, fileName);
  if (path.dirname(targetPath) !== outputDir) {
    throw new Error("private snapshot target escaped its validated directory");
  }
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${randomUUID()}`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    const bytes = Buffer.from(text, "utf8");
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset, null);
      if (bytesWritten <= 0) throw new Error("private snapshot byte write made no progress");
      offset += bytesWritten;
    }
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, targetPath);
    await chmod(targetPath, 0o600);
    const info = await lstat(targetPath, { bigint: true });
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.nlink !== 1n ||
      Number(info.mode & 0o777n) !== 0o600
    ) {
      throw new Error("private snapshot must be a mode-0600 regular file");
    }
  } finally {
    await handle?.close();
    await rm(temporaryPath, { force: true });
  }
}

async function canonicalProspectivePath(targetPath) {
  let cursor = path.resolve(targetPath);
  const suffix = [];
  while (true) {
    try {
      await lstat(cursor);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new Error("cannot resolve output path ancestry");
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
  const canonicalBase = await realpath(cursor);
  return path.join(canonicalBase, ...suffix);
}

function secretLikePath(value) {
  return String(value || "")
    .split("/")
    .filter(Boolean)
    .some((segment) =>
      /^(?:\.env(?:\..*)?|[^/]*(?:secret|credential|token|receipt|verification[-_]?done|keychain|production[-_]?export)[^/]*|[^/]+\.(?:pem|key|p12|mobileprovision))$/i.test(
        segment
      )
    );
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function isInsideOrEqual(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const inventory = await collectInventory(options);
  const paths = await writePrivateSnapshots({
    inventory,
    outputDir: options.outputDir,
    repositoryRoots: [
      options.legacyRoot,
      options.canonicalRoot,
      ...(options.additionalRoots || []),
    ],
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ...renderPublicSummary(inventory),
        output: {
          directoryAlias: "private-live-inventory",
          files: [path.basename(paths.inventoryPath), path.basename(paths.summaryPath)],
        },
      },
      null,
      2
    )}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Convergence inventory ERROR: ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
