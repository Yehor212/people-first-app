#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { link, lstat, mkdtemp, open, realpath, rename, rmdir, unlink } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const START = "# zenflow-agent-workspace-guard:v1:start";
const END = "# zenflow-agent-workspace-guard:v1:end";
const TRANSACTION_SCHEMA = "zenflow-kimi-hook-install-transaction/v1";
const TRANSACTION_SUFFIX = ".zenflow-transaction.json";
const OWNER_REMOVAL_CONDITION =
  "Retain the backup and transaction receipt until the owner verifies a successful restore and explicitly removes both files.";

export function renderKimiHookBlock(hookPath) {
  const absoluteHook = path.resolve(String(hookPath));
  const command = `node ${shellSingleQuote(absoluteHook)} --expected-agent kimi`;
  return [
    START,
    "[[hooks]]",
    'event = "PreToolUse"',
    `command = "${tomlEscape(command)}"`,
    "timeout = 5",
    END,
  ].join("\n");
}

export async function inspectKimiHook({ configPath, hookPath }) {
  const binding = await createPathBinding(
    configPath,
    "Kimi config ancestor changed during inspection"
  );
  try {
    return await inspectKimiHookWithBinding({ binding, configPath, hookPath });
  } finally {
    await closePathBinding(binding);
  }
}

async function inspectKimiHookWithBinding({ binding, configPath, hookPath }) {
  const snapshot = await readOpaqueConfig(configPath, {
    binding,
    message: "Kimi config changed during inspection",
  });
  const text = snapshot.text;
  const block = renderKimiHookBlock(hookPath);
  const managed = analyzeManagedHook(text);
  const installed = managed.structurallyValid;
  const hookReady = await isRegularNonSymlink(hookPath);
  return {
    duplicateMarkers: managed.duplicateMarkers,
    hookReady,
    installed,
    secureMode: snapshot.identity.mode === 0o600,
    stale: managed.hasMarkers && (!installed || managed.block !== block || !hookReady),
  };
}

export async function applyKimiHook({
  beforeBackup,
  beforeCommit,
  beforeReplace,
  configPath,
  hookPath,
  now = new Date(),
}) {
  const absoluteConfig = path.resolve(configPath);
  const absoluteHook = path.resolve(hookPath);
  await assertRegularFile(absoluteHook, "workspace guard hook");
  const binding = await createPathBinding(
    absoluteConfig,
    "Kimi config ancestor changed during installation"
  );
  try {
    const configSnapshot = await readOpaqueConfig(absoluteConfig, {
      binding,
      message: "Kimi config changed during installation",
    });
    const original = configSnapshot.text;
    const block = renderKimiHookBlock(absoluteHook);
    const existing = extractManagedBlock(original);
    let updated = original;
    if (existing) {
      if (existing !== block) updated = original.replace(existing, block);
    } else {
      updated = `${original.replace(/\s*$/, "")}\n\n${block}\n`;
    }

    await chmodBoundDirectory(binding, 0o700, "Kimi config ancestor changed during installation");
    await chmodChildDirectoryIfPresent(
      binding,
      "logs",
      0o700,
      "Kimi logs directory changed during installation"
    );

    if (updated === original) {
      if (beforeCommit) await beforeCommit();
      const securedIdentity = await chmodBoundFile({
        binding,
        expected: configSnapshot.identity,
        filePath: absoluteConfig,
        message: "Kimi config changed during installation",
        mode: 0o600,
      });
      const finalSnapshot = await readOpaqueConfig(absoluteConfig, {
        binding,
        message: "Kimi config changed during installation",
      });
      if (
        finalSnapshot.text !== original ||
        !sameSnapshot(finalSnapshot.identity, securedIdentity)
      ) {
        throw new Error("Kimi config changed during installation");
      }
      const proof = await inspectKimiHookWithBinding({
        binding,
        configPath: absoluteConfig,
        hookPath: absoluteHook,
      });
      assertHookPostcondition(proof);
      await assertPathBinding(binding, "Kimi config ancestor changed during installation");
      await assertSnapshotUnchanged(
        absoluteConfig,
        securedIdentity,
        "Kimi config changed during installation",
        binding
      );
      return { backupPath: null, changed: false, receiptPath: null };
    }

    const backupPath = `${absoluteConfig}.zenflow-backup-${timestamp(now)}`;
    const receiptPath = `${backupPath}${TRANSACTION_SUFFIX}`;
    if (beforeBackup) await beforeBackup();
    await assertPathBinding(binding, "Kimi config ancestor changed during installation");
    let backupIdentity;
    try {
      backupIdentity = await writeExclusivePrivateFile(backupPath, original, 0o600, {
        binding,
        message: "Kimi config backup changed during installation",
      });
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new Error("private Kimi config backup already exists; refusing to overwrite it");
      }
      throw error;
    }
    if (beforeReplace) await beforeReplace();
    await assertSnapshotUnchanged(
      absoluteConfig,
      configSnapshot.identity,
      "Kimi config changed during installation",
      binding
    );

    let installedIdentity = null;
    try {
      installedIdentity = await replaceIfUnchanged({
        beforeCommit,
        binding,
        expected: configSnapshot.identity,
        message: "Kimi config changed during installation",
        targetPath: absoluteConfig,
        text: updated,
        mode: 0o600,
      });
      const proof = await inspectKimiHookWithBinding({
        binding,
        configPath: absoluteConfig,
        hookPath: absoluteHook,
      });
      assertHookPostcondition(proof);

      const receiptText = renderTransactionReceipt({
        backupIdentity,
        backupPath,
        configPath: absoluteConfig,
        createdAt: new Date(now).toISOString(),
        installedIdentity,
        originalIdentity: configSnapshot.identity,
        originalText: original,
      });
      const receiptIdentity = await writeExclusivePrivateFile(receiptPath, receiptText, 0o600, {
        binding,
        message: "Kimi transaction receipt changed during installation",
      });
      await assertSnapshotUnchanged(
        absoluteConfig,
        installedIdentity,
        "Kimi config changed after installation",
        binding
      );
      await assertPrivateFileMatches({
        binding,
        expected: backupIdentity,
        filePath: backupPath,
        message: "Kimi config backup changed after installation",
        sha256: sha256(original),
      });
      await assertPrivateFileMatches({
        binding,
        expected: receiptIdentity,
        filePath: receiptPath,
        message: "Kimi transaction receipt changed after installation",
        sha256: sha256(receiptText),
      });
      await assertPathBinding(binding, "Kimi config ancestor changed after installation");
      return { backupPath, changed: true, receiptPath };
    } catch (error) {
      if (!installedIdentity) throw error;
      const rollback = await tryRestoreInstalledConfig({
        binding,
        expected: installedIdentity,
        original,
        targetPath: absoluteConfig,
      });
      if (rollback.restored) {
        throw new Error(
          "Kimi hook transaction failed; original config restored and private recovery files retained"
        );
      }
      throw new Error(
        "Kimi hook transaction failed and config or ancestry changed concurrently; private recovery files retained without overwriting the newer config"
      );
    }
  } finally {
    await closePathBinding(binding);
  }
}

export async function restoreKimiBackup({ backupPath, beforeCommit, configPath, receiptPath }) {
  const absoluteConfig = path.resolve(configPath);
  const absoluteBackup = path.resolve(backupPath);
  const absoluteReceipt = path.resolve(receiptPath || "");
  if (!receiptPath || absoluteReceipt !== `${absoluteBackup}${TRANSACTION_SUFFIX}`) {
    throw new Error("restore requires the exact transaction receipt for the selected backup");
  }
  if (path.dirname(absoluteBackup) !== path.dirname(absoluteConfig)) {
    throw new Error("backup must be a sibling of config.toml");
  }
  if (
    !path.basename(absoluteBackup).startsWith(`${path.basename(absoluteConfig)}.zenflow-backup-`)
  ) {
    throw new Error("backup name is not managed by the ZenFlow installer");
  }
  const binding = await createPathBinding(
    absoluteConfig,
    "Kimi config ancestor changed during restoration"
  );
  try {
    const receiptSnapshot = await readOpaqueConfig(absoluteReceipt, {
      binding,
      message: "Kimi transaction receipt changed during restoration",
    });
    if (receiptSnapshot.identity.mode !== 0o600) {
      throw new Error("Kimi transaction receipt must remain a private mode-0600 file");
    }
    const receipt = parseTransactionReceipt(receiptSnapshot.text);
    if (receipt.configPath !== absoluteConfig || receipt.backup.path !== absoluteBackup) {
      throw new Error("transaction receipt does not bind the selected config and backup");
    }

    const backupSnapshot = await readOpaqueConfig(absoluteBackup, {
      binding,
      message: "Kimi config backup changed during restoration",
    });
    if (backupSnapshot.identity.mode !== 0o600) {
      throw new Error("Kimi config backup must remain a private mode-0600 file");
    }
    if (
      !sameSnapshot(backupSnapshot.identity, receipt.backup.identity) ||
      sha256(backupSnapshot.text) !== receipt.backup.sha256
    ) {
      throw new Error("transaction receipt backup identity or hash does not match");
    }
    const current = await readOpaqueConfig(absoluteConfig, {
      binding,
      message: "Kimi config changed during restoration",
    });
    if (!sameSnapshot(current.identity, receipt.target.installedIdentity)) {
      throw new Error("Kimi config no longer matches the transaction target identity");
    }
    await chmodBoundDirectory(binding, 0o700, "Kimi config ancestor changed during restoration");
    const restoredIdentity = await replaceIfUnchanged({
      beforeCommit,
      binding,
      expected: current.identity,
      message: "Kimi config changed during restoration",
      targetPath: absoluteConfig,
      text: backupSnapshot.text,
      mode: 0o600,
    });
    await assertPrivateFileMatches({
      binding,
      expected: restoredIdentity,
      filePath: absoluteConfig,
      message: "Kimi config changed after restoration",
      sha256: receipt.backup.sha256,
    });
    await assertPrivateFileMatches({
      binding,
      expected: backupSnapshot.identity,
      filePath: absoluteBackup,
      message: "Kimi config backup changed during restoration",
      sha256: receipt.backup.sha256,
    });
    await assertSnapshotUnchanged(
      absoluteReceipt,
      receiptSnapshot.identity,
      "Kimi transaction receipt changed during restoration",
      binding
    );
    await assertPathBinding(binding, "Kimi config ancestor changed during restoration");
  } finally {
    await closePathBinding(binding);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "--check";
  const configPath = option(args, "--config") || path.join(homedir(), ".kimi-code", "config.toml");
  const hookPath =
    option(args, "--hook") || path.resolve(".codex", "hooks", "agent-workspace-guard.cjs");

  if (mode === "--check") {
    const result = await inspectKimiHook({ configPath, hookPath });
    process.stdout.write(
      `Kimi workspace hook: ${result.installed && !result.stale && result.secureMode ? "PASS" : "UNVERIFIED"}\n`
    );
    process.exit(result.installed && !result.stale && result.secureMode ? 0 : 2);
  }
  if (mode === "--apply") {
    const result = await applyKimiHook({ configPath, hookPath });
    const doctor = runKimiDoctor();
    process.stdout.write(
      `Kimi workspace hook: ${result.changed ? "installed" : "already current"}; ` +
        `config_mode=0600; kimi_doctor=${doctor}\n`
    );
    if (result.backupPath) {
      process.stdout.write(`Private rollback backup: ${result.backupPath}\n`);
      process.stdout.write(`Private transaction receipt: ${result.receiptPath}\n`);
    }
    return;
  }
  if (mode === "--restore") {
    const backupPath = option(args, "--backup");
    const receiptPath = option(args, "--receipt");
    if (!backupPath) throw new Error("--restore requires --backup <absolute-path>");
    if (!receiptPath) throw new Error("--restore requires --receipt <absolute-path>");
    await restoreKimiBackup({ backupPath, configPath, receiptPath });
    process.stdout.write("Kimi workspace hook config restored from private backup.\n");
    return;
  }
  throw new Error("usage: --check | --apply | --restore --backup <path> --receipt <path>");
}

function extractManagedBlock(text) {
  const managed = analyzeManagedHook(text);
  if (!managed.hasMarkers) return "";
  if (!managed.validMarkerPair) {
    throw new Error("malformed or duplicate ZenFlow Kimi hook markers");
  }
  return managed.block;
}

function analyzeManagedHook(text) {
  const startCount = countOccurrences(text, START);
  const endCount = countOccurrences(text, END);
  const hasMarkers = startCount > 0 || endCount > 0;
  const duplicateMarkers = startCount > 1 || endCount > 1;
  const scan = scanTomlStructure(text);
  const activeStarts = scan.lines.filter((line) => line.activeAtStart && line.text === START);
  const activeEnds = scan.lines.filter((line) => line.activeAtStart && line.text === END);
  const validMarkerPair =
    scan.complete &&
    startCount === 1 &&
    endCount === 1 &&
    activeStarts.length === 1 &&
    activeEnds.length === 1 &&
    activeStarts[0].index < activeEnds[0].index;

  if (!validMarkerPair) {
    return {
      block: "",
      duplicateMarkers,
      hasMarkers,
      structurallyValid: false,
      validMarkerPair: false,
    };
  }

  const startLine = activeStarts[0];
  const endLine = activeEnds[0];
  const managedLines = scan.lines.slice(startLine.index, endLine.index + 1);
  const block = text.slice(startLine.start, endLine.end);
  const structurallyValid =
    managedLines.length === 6 &&
    managedLines.every((line) => line.activeAtStart) &&
    managedLines[0].text === START &&
    managedLines[1].text === "[[hooks]]" &&
    managedLines[2].text === 'event = "PreToolUse"' &&
    /^command = "(?:[^"\\]|\\.)*"$/.test(managedLines[3].text) &&
    managedLines[4].text === "timeout = 5" &&
    managedLines[5].text === END;

  return {
    block,
    duplicateMarkers,
    hasMarkers,
    structurallyValid,
    validMarkerPair: true,
  };
}

function scanTomlStructure(text) {
  const lines = [];
  let cursor = 0;
  let mode = "normal";
  let invalid = false;
  let index = 0;

  while (cursor <= text.length) {
    const newline = text.indexOf("\n", cursor);
    const rawEnd = newline < 0 ? text.length : newline;
    const rawLine = text.slice(cursor, rawEnd);
    const lineText = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const activeAtStart = !invalid && mode === "normal";
    const scanned = scanTomlLine(lineText, mode);
    mode = scanned.mode;
    invalid ||= scanned.invalid;
    lines.push({
      activeAtStart,
      end: rawEnd - (rawLine.endsWith("\r") ? 1 : 0),
      index,
      start: cursor,
      text: lineText,
    });
    index += 1;
    if (newline < 0) break;
    cursor = newline + 1;
  }

  return {
    complete: !invalid && mode === "normal",
    lines,
  };
}

function scanTomlLine(line, initialMode) {
  let mode = initialMode;
  let invalid = false;
  let cursor = 0;

  while (cursor < line.length && !invalid) {
    if (mode === "multiline-basic") {
      if (line[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (line.startsWith('"""', cursor)) {
        mode = "normal";
        cursor += 3;
        continue;
      }
      cursor += 1;
      continue;
    }

    if (mode === "multiline-literal") {
      if (line.startsWith("'''", cursor)) {
        mode = "normal";
        cursor += 3;
        continue;
      }
      cursor += 1;
      continue;
    }

    const character = line[cursor];
    if (character === "#") break;
    if (line.startsWith('"""', cursor)) {
      mode = "multiline-basic";
      cursor += 3;
      continue;
    }
    if (line.startsWith("'''", cursor)) {
      mode = "multiline-literal";
      cursor += 3;
      continue;
    }
    if (character === '"') {
      const closing = scanSingleLineBasicString(line, cursor + 1);
      if (closing < 0) {
        invalid = true;
        continue;
      }
      cursor = closing + 1;
      continue;
    }
    if (character === "'") {
      const closing = line.indexOf("'", cursor + 1);
      if (closing < 0) {
        invalid = true;
        continue;
      }
      cursor = closing + 1;
      continue;
    }
    cursor += 1;
  }

  return { invalid, mode };
}

function scanSingleLineBasicString(line, start) {
  for (let cursor = start; cursor < line.length; cursor += 1) {
    if (line[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (line[cursor] === '"') return cursor;
  }
  return -1;
}

function countOccurrences(text, value) {
  let count = 0;
  let cursor = 0;
  while (true) {
    const match = text.indexOf(value, cursor);
    if (match < 0) return count;
    count += 1;
    cursor = match + value.length;
  }
}

async function replaceIfUnchanged({
  beforeCommit,
  binding,
  expected,
  message,
  mode,
  targetPath,
  text,
}) {
  await assertPathBinding(binding, message);
  await assertSnapshotUnchanged(targetPath, expected, message, binding);
  const directory = binding.canonicalDirectory;
  const transactionDirectory = await mkdtemp(
    path.join(directory, `.${path.basename(targetPath)}.zenflow-txn-`)
  );
  await assertPathBinding(binding, message);
  const displacedPath = path.join(transactionDirectory, "original");
  const transactionBinding = await createPathBinding(displacedPath, message);
  await chmodBoundDirectory(transactionBinding, 0o700, message);
  let displacedIdentity = null;
  try {
    await assertPathBinding(binding, message);
    await assertPathBinding(transactionBinding, message);
    await assertSnapshotUnchanged(targetPath, expected, message, binding);
    await assertPathAbsent(displacedPath, transactionBinding, message);
    await rename(boundPath(binding, targetPath), boundPath(transactionBinding, displacedPath));
    await assertPathBinding(binding, message);
    await assertPathBinding(transactionBinding, message);
    const displacedSnapshot = await readOpaqueConfig(displacedPath, {
      binding: transactionBinding,
      message,
    });
    if (!sameSnapshotAfterRename(displacedSnapshot.identity, expected)) {
      throw new Error(message);
    }
    displacedIdentity = displacedSnapshot.identity;
    if (beforeCommit) await beforeCommit();
    let installedIdentity;
    try {
      await assertPathBinding(binding, message);
      await assertPathBinding(transactionBinding, message);
      await assertSnapshotUnchanged(displacedPath, displacedIdentity, message, transactionBinding);
      installedIdentity = await writeExclusivePrivateFile(targetPath, text, mode, {
        binding,
        message,
      });
    } catch (error) {
      const restored = await restoreDisplacedWithoutOverwrite({
        binding,
        displacedBinding: transactionBinding,
        displacedPath,
        expected: displacedIdentity,
        message,
        targetPath,
      });
      if (restored) displacedIdentity = null;
      if (error?.code === "EEXIST") throw new Error(message);
      throw error;
    }
    await unlinkVerified(displacedPath, displacedIdentity, transactionBinding, message);
    displacedIdentity = null;
    return installedIdentity;
  } finally {
    if (displacedIdentity) {
      try {
        const restored = await restoreDisplacedWithoutOverwrite({
          binding,
          displacedBinding: transactionBinding,
          displacedPath,
          expected: displacedIdentity,
          message,
          targetPath,
        });
        if (restored) displacedIdentity = null;
      } catch {
        // Preserve verified recovery bytes when the original pathname cannot be rebound safely.
      }
    }
    try {
      await rmdirBoundDirectory(transactionDirectory, transactionBinding, binding, message);
    } catch {
      // A non-empty or identity-changed transaction directory is owner recovery evidence.
    }
    await closePathBinding(transactionBinding);
  }
}

async function restoreDisplacedWithoutOverwrite({
  binding,
  displacedBinding,
  displacedPath,
  expected,
  message,
  targetPath,
}) {
  if (!expected) return false;
  try {
    await assertPathBinding(binding, message);
    await assertPathBinding(displacedBinding, message);
    await assertSnapshotUnchanged(displacedPath, expected, message, displacedBinding);
    await assertPathAbsent(targetPath, binding, message);
    await link(boundPath(displacedBinding, displacedPath), boundPath(binding, targetPath));
    await assertPathBinding(binding, message);
    await assertPathBinding(displacedBinding, message);
    const restored = snapshotIdentity(
      await lstat(boundPath(binding, targetPath), { bigint: true })
    );
    if (!sameSnapshotAfterHardLink(restored, expected)) {
      throw new Error(message);
    }
    await unlinkLinkedNode(displacedPath, expected, displacedBinding, message);
    const finalTarget = snapshotIdentity(
      await lstat(boundPath(binding, targetPath), { bigint: true })
    );
    if (!sameSnapshotAfterRename(finalTarget, expected)) {
      throw new Error(message);
    }
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

async function writeExclusivePrivateFile(filePath, text, mode, { binding, message }) {
  const boundFile = boundPath(binding, filePath);
  let handle;
  let createdIdentity = null;
  try {
    await assertPathBinding(binding, message);
    handle = await open(
      boundFile,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW || 0),
      mode
    );
    createdIdentity = snapshotIdentity(await handle.stat({ bigint: true }));
    if (!createdIdentity.regularFile || createdIdentity.nlink !== 1n) throw new Error(message);
    await handle.writeFile(text, { encoding: "utf8" });
    await handle.chmod(mode);
    await handle.sync();
    const finalIdentity = snapshotIdentity(await handle.stat({ bigint: true }));
    await assertHandleStillBound({
      binding,
      expected: finalIdentity,
      filePath,
      handle,
      message,
    });
    return finalIdentity;
  } catch (error) {
    if (handle) {
      try {
        createdIdentity = snapshotIdentity(await handle.stat({ bigint: true }));
      } catch {
        // Preserve the path when its identity cannot be proven.
      }
      await handle?.close();
      handle = null;
    }
    if (createdIdentity) {
      await unlinkIfSame(filePath, createdIdentity, binding);
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

async function unlinkIfSame(filePath, expected, binding) {
  try {
    await assertPathBinding(binding, "path ancestry changed during cleanup");
    const boundFile = boundPath(binding, filePath);
    const current = snapshotIdentity(await lstat(boundFile, { bigint: true }));
    if (sameSnapshot(current, expected)) await unlink(boundFile);
  } catch {
    // Preserve an unknown replacement instead of deleting it.
  }
}

async function assertRegularFile(filePath, label) {
  let binding;
  let handle;
  try {
    binding = await createPathBinding(filePath, `${label} ancestor must remain a real directory`);
    handle = await open(
      boundPath(binding, filePath),
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0)
    );
    const identity = snapshotIdentity(await handle.stat({ bigint: true }));
    if (!identity.regularFile || identity.nlink !== 1n) {
      throw new Error(`${label} must be a single-link regular non-symlink file`);
    }
    await assertHandleStillBound({
      binding,
      expected: identity,
      filePath,
      handle,
      message: `${label} changed during inspection`,
    });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ELOOP") {
      throw new Error(`${label} must exist as a regular non-symlink file`);
    }
    throw error;
  } finally {
    await handle?.close();
    if (binding) await closePathBinding(binding);
  }
}

async function isRegularNonSymlink(filePath) {
  try {
    await assertRegularFile(filePath, "workspace guard hook");
    return true;
  } catch {
    return false;
  }
}

async function readOpaqueConfig(
  configPath,
  { binding: suppliedBinding, message = "Kimi config changed while it was being read" } = {}
) {
  const binding =
    suppliedBinding ||
    (await createPathBinding(configPath, "Kimi config ancestor changed while reading"));
  const ownsBinding = !suppliedBinding;
  const absolute = boundPath(binding, configPath);
  let handle;
  try {
    await assertPathBinding(binding, message);
    handle = await open(absolute, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    const before = snapshotIdentity(await handle.stat({ bigint: true }));
    if (!before.regularFile || before.nlink !== 1n) {
      throw new Error("Kimi config must be a single-link regular non-symlink file");
    }
    const text = await handle.readFile({ encoding: "utf8" });
    const after = snapshotIdentity(await handle.stat({ bigint: true }));
    if (!sameSnapshot(before, after)) {
      throw new Error(message);
    }
    await assertHandleStillBound({
      binding,
      expected: after,
      filePath: configPath,
      handle,
      message,
    });
    return { identity: after, text };
  } catch (error) {
    if (error?.code === "ELOOP") {
      throw new Error("Kimi config must be a regular non-symlink file");
    }
    throw error;
  } finally {
    await handle?.close();
    if (ownsBinding) await closePathBinding(binding);
  }
}

async function assertSnapshotUnchanged(filePath, expected, message, suppliedBinding) {
  const binding = suppliedBinding || (await createPathBinding(filePath, message));
  const ownsBinding = !suppliedBinding;
  try {
    await assertPathBinding(binding, message);
    const current = snapshotIdentity(await lstat(boundPath(binding, filePath), { bigint: true }));
    if (!current.regularFile || !sameSnapshot(current, expected)) {
      throw new Error(message);
    }
  } catch {
    throw new Error(message);
  } finally {
    if (ownsBinding) await closePathBinding(binding);
  }
}

function snapshotIdentity(info) {
  return {
    ctimeNs: info.ctimeNs,
    dev: info.dev,
    directory: info.isDirectory() && !info.isSymbolicLink(),
    ino: info.ino,
    mode: Number(info.mode & 0o777n),
    mtimeNs: info.mtimeNs,
    nlink: info.nlink,
    regularFile: info.isFile() && !info.isSymbolicLink(),
    size: info.size,
  };
}

function sameSnapshot(left, right) {
  return (
    left.ctimeNs === right.ctimeNs &&
    left.dev === right.dev &&
    left.directory === right.directory &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.nlink === right.nlink &&
    left.regularFile === right.regularFile &&
    left.size === right.size
  );
}

function sameSnapshotAfterRename(left, right) {
  return (
    left.dev === right.dev &&
    left.directory === right.directory &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.nlink === right.nlink &&
    left.regularFile === right.regularFile &&
    left.size === right.size
  );
}

function sameSnapshotAfterHardLink(left, right) {
  return (
    left.dev === right.dev &&
    left.directory === right.directory &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.nlink === right.nlink + 1n &&
    left.regularFile === right.regularFile &&
    left.size === right.size
  );
}

async function createPathBinding(filePath, message) {
  const requestedTarget = path.resolve(filePath);
  const requestedDirectory = path.dirname(requestedTarget);
  let canonicalDirectory;
  try {
    canonicalDirectory = await realpath(requestedDirectory);
  } catch {
    throw new Error(message);
  }
  const anchors = [];
  try {
    for (const ancestorPath of ancestorDirectories(canonicalDirectory)) {
      const before = snapshotIdentity(await lstat(ancestorPath, { bigint: true }));
      if (!before.directory) throw new Error(message);
      const handle = await open(
        ancestorPath,
        fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY || 0) | (fsConstants.O_NOFOLLOW || 0)
      );
      const opened = snapshotIdentity(await handle.stat({ bigint: true }));
      const after = snapshotIdentity(await lstat(ancestorPath, { bigint: true }));
      if (!sameAnchorIdentity(before, opened) || !sameAnchorIdentity(opened, after)) {
        await handle.close();
        throw new Error(message);
      }
      anchors.push({ handle, identity: opened, path: ancestorPath });
    }
    const binding = {
      anchors,
      canonicalDirectory,
      requestedDirectory,
      requestedTarget,
    };
    await assertPathBinding(binding, message);
    return binding;
  } catch (error) {
    for (const anchor of anchors.reverse()) {
      try {
        await anchor.handle.close();
      } catch {
        // Closing a failed inspection handle must not hide the identity failure.
      }
    }
    throw error;
  }
}

async function closePathBinding(binding) {
  for (const anchor of [...binding.anchors].reverse()) {
    try {
      await anchor.handle.close();
    } catch {
      // The operation result is determined before best-effort descriptor cleanup.
    }
  }
}

async function assertPathBinding(binding, message) {
  let currentCanonical;
  try {
    currentCanonical = await realpath(binding.requestedDirectory);
  } catch {
    throw new Error(message);
  }
  if (currentCanonical !== binding.canonicalDirectory) throw new Error(message);
  for (const anchor of binding.anchors) {
    let opened;
    let pathname;
    try {
      opened = snapshotIdentity(await anchor.handle.stat({ bigint: true }));
      pathname = snapshotIdentity(await lstat(anchor.path, { bigint: true }));
    } catch {
      throw new Error(message);
    }
    if (
      !opened.directory ||
      !pathname.directory ||
      !sameAnchorIdentity(opened, anchor.identity) ||
      !sameAnchorIdentity(pathname, anchor.identity)
    ) {
      throw new Error(message);
    }
  }
}

function boundPath(binding, filePath) {
  const requested = path.resolve(filePath);
  if (path.dirname(requested) !== binding.requestedDirectory) {
    throw new Error("bound filesystem operation escaped its transaction directory");
  }
  return path.join(binding.canonicalDirectory, path.basename(requested));
}

function ancestorDirectories(directory) {
  const result = [];
  let cursor = directory;
  while (true) {
    result.unshift(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) return result;
    cursor = parent;
  }
}

function sameAnchorIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.directory === true &&
    right.directory === true
  );
}

async function assertHandleStillBound({ binding, expected, filePath, handle, message }) {
  await assertPathBinding(binding, message);
  let opened;
  let pathname;
  try {
    opened = snapshotIdentity(await handle.stat({ bigint: true }));
    pathname = snapshotIdentity(await lstat(boundPath(binding, filePath), { bigint: true }));
  } catch {
    throw new Error(message);
  }
  if (!sameSnapshot(opened, expected) || !sameSnapshot(pathname, expected)) {
    throw new Error(message);
  }
  await assertPathBinding(binding, message);
}

async function assertPathAbsent(filePath, binding, message) {
  await assertPathBinding(binding, message);
  try {
    await lstat(boundPath(binding, filePath), { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      await assertPathBinding(binding, message);
      return;
    }
    throw new Error(message);
  }
  const error = new Error(message);
  error.code = "EEXIST";
  throw error;
}

async function chmodBoundDirectory(binding, mode, message) {
  await assertPathBinding(binding, message);
  const directoryAnchor = binding.anchors.at(-1);
  await directoryAnchor.handle.chmod(mode);
  await directoryAnchor.handle.sync();
  await assertPathBinding(binding, message);
}

async function chmodChildDirectoryIfPresent(binding, childName, mode, message) {
  const childPath = path.join(binding.canonicalDirectory, childName);
  let handle;
  try {
    await assertPathBinding(binding, message);
    handle = await open(
      childPath,
      fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY || 0) | (fsConstants.O_NOFOLLOW || 0)
    );
    const before = snapshotIdentity(await handle.stat({ bigint: true }));
    const pathname = snapshotIdentity(await lstat(childPath, { bigint: true }));
    if (!sameAnchorIdentity(before, pathname)) throw new Error(message);
    await handle.chmod(mode);
    await handle.sync();
    const after = snapshotIdentity(await handle.stat({ bigint: true }));
    const finalPath = snapshotIdentity(await lstat(childPath, { bigint: true }));
    if (!sameAnchorIdentity(before, after) || !sameAnchorIdentity(after, finalPath)) {
      throw new Error(message);
    }
    await assertPathBinding(binding, message);
  } catch (error) {
    if (error?.code !== "ENOENT" || handle) throw error;
    await assertPathBinding(binding, message);
  } finally {
    await handle?.close();
  }
}

async function chmodBoundFile({ binding, expected, filePath, message, mode }) {
  let handle;
  try {
    await assertPathBinding(binding, message);
    handle = await open(
      boundPath(binding, filePath),
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0)
    );
    const before = snapshotIdentity(await handle.stat({ bigint: true }));
    if (!sameSnapshot(before, expected)) throw new Error(message);
    await assertHandleStillBound({
      binding,
      expected,
      filePath,
      handle,
      message,
    });
    await handle.chmod(mode);
    await handle.sync();
    const after = snapshotIdentity(await handle.stat({ bigint: true }));
    await assertHandleStillBound({
      binding,
      expected: after,
      filePath,
      handle,
      message,
    });
    return after;
  } finally {
    await handle?.close();
  }
}

async function unlinkVerified(filePath, expected, binding, message) {
  await assertSnapshotUnchanged(filePath, expected, message, binding);
  await unlink(boundPath(binding, filePath));
  await assertPathBinding(binding, message);
}

async function unlinkIfSameNode(filePath, expected, binding, message) {
  await assertPathBinding(binding, message);
  const current = snapshotIdentity(await lstat(boundPath(binding, filePath), { bigint: true }));
  if (!sameSnapshotAfterRename(current, expected)) throw new Error(message);
  await unlink(boundPath(binding, filePath));
  await assertPathBinding(binding, message);
}

async function unlinkLinkedNode(filePath, expected, binding, message) {
  await assertPathBinding(binding, message);
  const current = snapshotIdentity(await lstat(boundPath(binding, filePath), { bigint: true }));
  if (!sameSnapshotAfterHardLink(current, expected)) throw new Error(message);
  await unlink(boundPath(binding, filePath));
  await assertPathBinding(binding, message);
}

async function rmdirBoundDirectory(
  transactionDirectory,
  transactionBinding,
  parentBinding,
  message
) {
  await assertPathBinding(parentBinding, message);
  await assertPathBinding(transactionBinding, message);
  await rmdir(transactionDirectory);
  await assertPathBinding(parentBinding, message);
}

async function assertPrivateFileMatches({
  binding,
  expected,
  filePath,
  message,
  sha256: expectedHash,
}) {
  const snapshot = await readOpaqueConfig(filePath, { binding, message });
  if (
    snapshot.identity.mode !== 0o600 ||
    !sameSnapshot(snapshot.identity, expected) ||
    sha256(snapshot.text) !== expectedHash
  ) {
    throw new Error(message);
  }
}

function assertHookPostcondition(proof) {
  if (!proof.installed || proof.stale || proof.duplicateMarkers || !proof.secureMode) {
    throw new Error("Kimi hook postcondition failed");
  }
}

async function tryRestoreInstalledConfig({ binding, expected, original, targetPath }) {
  try {
    await assertSnapshotUnchanged(
      targetPath,
      expected,
      "Kimi config changed after installation",
      binding
    );
    await replaceIfUnchanged({
      binding,
      expected,
      message: "Kimi config changed after installation",
      targetPath,
      text: original,
      mode: 0o600,
    });
    return { restored: true };
  } catch (error) {
    return { error, restored: false };
  }
}

function renderTransactionReceipt({
  backupIdentity,
  backupPath,
  configPath,
  createdAt,
  installedIdentity,
  originalIdentity,
  originalText,
}) {
  return `${JSON.stringify(
    {
      schema: TRANSACTION_SCHEMA,
      createdAt,
      configPath,
      backup: {
        path: backupPath,
        sha256: sha256(originalText),
        identity: serializeIdentity(backupIdentity),
      },
      target: {
        beforeInstallIdentity: serializeIdentity(originalIdentity),
        installedIdentity: serializeIdentity(installedIdentity),
      },
      retention: {
        automaticRemoval: false,
        ownerRemovalCondition: OWNER_REMOVAL_CONDITION,
      },
    },
    null,
    2
  )}\n`;
}

function parseTransactionReceipt(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Kimi transaction receipt is not valid JSON");
  }
  if (
    !isPlainObject(value) ||
    value.schema !== TRANSACTION_SCHEMA ||
    typeof value.configPath !== "string" ||
    path.resolve(value.configPath) !== value.configPath ||
    typeof value.createdAt !== "string" ||
    !isExactIsoTimestamp(value.createdAt) ||
    !isPlainObject(value.backup) ||
    typeof value.backup.path !== "string" ||
    path.resolve(value.backup.path) !== value.backup.path ||
    typeof value.backup.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.backup.sha256) ||
    !isPlainObject(value.target) ||
    !isPlainObject(value.retention) ||
    value.retention.automaticRemoval !== false ||
    value.retention.ownerRemovalCondition !== OWNER_REMOVAL_CONDITION
  ) {
    throw new Error("Kimi transaction receipt does not match the managed schema");
  }
  return {
    ...value,
    backup: {
      ...value.backup,
      identity: deserializeIdentity(value.backup.identity),
    },
    target: {
      beforeInstallIdentity: deserializeIdentity(value.target.beforeInstallIdentity),
      installedIdentity: deserializeIdentity(value.target.installedIdentity),
    },
  };
}

function serializeIdentity(identity) {
  return {
    ctimeNs: identity.ctimeNs.toString(),
    dev: identity.dev.toString(),
    directory: identity.directory,
    ino: identity.ino.toString(),
    mode: identity.mode,
    mtimeNs: identity.mtimeNs.toString(),
    nlink: identity.nlink.toString(),
    regularFile: identity.regularFile,
    size: identity.size.toString(),
  };
}

function deserializeIdentity(value) {
  if (
    !isPlainObject(value) ||
    value.directory !== false ||
    value.regularFile !== true ||
    !Number.isInteger(value.mode) ||
    value.mode < 0 ||
    value.mode > 0o777
  ) {
    throw new Error("Kimi transaction receipt contains an invalid file identity");
  }
  return {
    ctimeNs: parseUnsignedBigInt(value.ctimeNs),
    dev: parseUnsignedBigInt(value.dev),
    directory: value.directory,
    ino: parseUnsignedBigInt(value.ino),
    mode: value.mode,
    mtimeNs: parseUnsignedBigInt(value.mtimeNs),
    nlink: value.nlink === undefined ? 1n : parseUnsignedBigInt(value.nlink),
    regularFile: value.regularFile,
    size: parseUnsignedBigInt(value.size),
  };
}

function parseUnsignedBigInt(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("Kimi transaction receipt contains an invalid file identity");
  }
  return BigInt(value);
}

function isExactIsoTimestamp(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function tomlEscape(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function timestamp(date) {
  return new Date(date).toISOString().replace(/[-:.]/g, "");
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}

function runKimiDoctor() {
  const result = spawnSync("kimi", ["doctor"], {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 30_000,
  });
  return result.error || result.status !== 0 ? "UNVERIFIED" : "PASS";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Kimi workspace hook ERROR: ${error.message}\n`);
    process.exit(1);
  });
}
