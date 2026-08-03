"use strict";

const { createHash } = require("node:crypto");
const {
  closeSync,
  constants: fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} = require("node:fs");
const path = require("node:path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const REALPATH = realpathSync.native || realpathSync;

const WRITE_TOOL_PATTERN =
  /(?:^|\.)(?:apply_patch|edit|write|multiedit|writefile|createfile|deletefile|strreplacefile|notebookedit)$/i;
const SHELL_TOOL_PATTERN =
  /(?:^|\.)(?:bash|shell|powershell|pwsh|exec_command|unified_exec|exec)$/i;
const SPECIAL_OUTPUTS = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "nul", "&1", "&2"]);
const STRUCTURED_PATH_KEYS = new Set([
  "destination",
  "file_path",
  "filename",
  "new_path",
  "notebook_path",
  "old_path",
  "path",
  "target_path",
]);
const REVIEWED_PACKAGE_SCRIPTS = new Set([
  "agent:workspace",
  "assets:logos:check",
  "audit:check",
  "build",
  "check:agent-context",
  "check:agent-orchestra",
  "check:agent-orchestra:eval",
  "check:agent-workspace",
  "check:all",
  "check:app-audio",
  "check:best-practices",
  "check:canonical-orbs",
  "check:circular",
  "check:colors",
  "check:hyperfocus-audio",
  "check:licenses",
  "check:no-ai-templates",
  "check:production-data-integrity",
  "check:production-data-integrity:bundle",
  "check:production-data-integrity:diff",
  "check:production-data-integrity:staged",
  "check:rag",
  "check:release-artifacts",
  "check:staged-release-artifacts",
  "check:supabase-migration-prefixes",
  "check:sync-contract",
  "check:task-completion",
  "check:translation-quality",
  "check:types-fresh",
  "check:v2-paper",
  "check:visual",
  "ci:preflight",
  "constitution:check",
  "doc-counts",
  "i18n:check",
  "i18n:deep",
  "i18n:v2-copy",
  "lint",
  "oxlint",
  "rag:audit:free",
  "rag:preflight",
  "rag:search:free",
  "rag:smoke:free",
  "ratchet:check",
  "smoke:chrome-performance",
  "test",
  "test:agent-orchestra",
  "test:agent-workspace",
  "test:coverage",
  "test:e2e",
  "test:e2e:v2:critical",
  "test:e2e:v2:smoke",
  "test:e2e:v2:visual",
  "test:i18n",
  "test:release",
  "test:release-contracts",
  "typecheck",
  "verify:tailwind",
]);
const SPEC_KIT_PROVENANCE = Object.freeze({
  relativePath: ".specify/zenflow-install-manifest.json",
  sha256: "f171991f9ce48e3caadfa8d6db67c1ce3fe509ad0411e796ce2c58c2ac9ccdb2",
  size: 6769,
  mode: 0o644,
});
const CHECK_PREREQUISITES_SCRIPT = Object.freeze({
  relativePath: ".specify/scripts/bash/check-prerequisites.sh",
  sha256: "50fc0aff7ed4c02ca92fe87520130d6c928bff3b7dd3e6cdd86c3d514407e752",
  size: 6333,
  mode: 0o755,
});
const SETUP_PLAN_SCRIPT = Object.freeze({
  relativePath: ".specify/scripts/bash/setup-plan.sh",
  sha256: "4469b22960f43c07c33dca00de6dedb252145e9a9ce8fbb0e63be82e02b082ab",
  size: 2493,
  mode: 0o755,
});
const SETUP_TASKS_SCRIPT = Object.freeze({
  relativePath: ".specify/scripts/bash/setup-tasks.sh",
  sha256: "49e336e94d25ed07da1c3c39c97292c4f217f404a81d1229195a8ce249cbc7f1",
  size: 3241,
  mode: 0o755,
});
// Only --paths-only opts out of get_feature_paths persistence. The other exact
// commands can write feature.json, and setup-plan can also create plan.md.
const REVIEWED_DIRECT_COMMANDS = new Map([
  [
    ".specify/scripts/bash/check-prerequisites.sh --json --paths-only",
    Object.freeze({
      access: "read-only",
      reviewedFile: CHECK_PREREQUISITES_SCRIPT,
      targetFiles: [],
    }),
  ],
  [
    ".specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks",
    Object.freeze({
      access: "feature-mutation",
      reviewedFile: CHECK_PREREQUISITES_SCRIPT,
      targetFiles: [],
    }),
  ],
  [
    ".specify/scripts/bash/setup-plan.sh --json",
    Object.freeze({
      access: "feature-mutation",
      reviewedFile: SETUP_PLAN_SCRIPT,
      targetFiles: ["plan.md"],
    }),
  ],
  [
    ".specify/scripts/bash/setup-tasks.sh --json",
    Object.freeze({
      access: "feature-mutation",
      reviewedFile: SETUP_TASKS_SCRIPT,
      targetFiles: [],
    }),
  ],
]);

function reviewedDirectCommandAnalysis(
  command,
  locationEvidence,
  executorCwd,
  environment
) {
  const reviewedCommand = REVIEWED_DIRECT_COMMANDS.get(command);
  if (!reviewedCommand) return null;

  if (
    !reviewedDirectCommandIsTrusted(reviewedCommand, locationEvidence, executorCwd)
  ) {
    return failClosedReviewedCommandAnalysis();
  }

  if (reviewedCommand.access === "read-only") {
    return reviewedCommandAnalysis({ mutationIntent: false, targets: [] });
  }

  const targets = reviewedSpecKitFeatureTargets(reviewedCommand, environment);
  if (!targets) return failClosedReviewedCommandAnalysis();
  return reviewedCommandAnalysis({ mutationIntent: true, targets });
}

function reviewedDirectCommandIsTrusted(reviewedCommand, locationEvidence, executorCwd) {
  if (!repositoryLocationsAreCanonical(locationEvidence, executorCwd)) return false;

  const provenanceBytes = readReviewedRegularFile(SPEC_KIT_PROVENANCE);
  if (!provenanceBytes) return false;

  let provenance;
  try {
    provenance = JSON.parse(provenanceBytes.toString("utf8"));
  } catch {
    return false;
  }
  if (
    provenance?.source?.latest_release !== "v0.15.1" ||
    provenance?.generator?.specify_cli !== "0.15.1" ||
    !Array.isArray(provenance?.inventory?.tracked_paths) ||
    !provenance.inventory.tracked_paths.includes(reviewedCommand.reviewedFile.relativePath)
  ) {
    return false;
  }

  return readReviewedRegularFile(reviewedCommand.reviewedFile) !== null;
}

function reviewedCommandAnalysis({ mutationIntent, targets }) {
  return {
    mutationIntent,
    destructiveFilesystem: false,
    dynamicTarget: false,
    opaqueExecution: false,
    recognizedCommands: ["spec-kit reviewed direct command"],
    targets,
    unknownExecution: false,
    workingDirectories: [],
  };
}

function failClosedReviewedCommandAnalysis() {
  return {
    mutationIntent: true,
    destructiveFilesystem: false,
    dynamicTarget: false,
    opaqueExecution: false,
    recognizedCommands: [],
    targets: [],
    unknownExecution: true,
    workingDirectories: [],
  };
}

function reviewedSpecKitFeatureTargets(reviewedCommand, environment) {
  const source = environment && typeof environment === "object" ? environment : {};
  if (!specifyInitDirectoryIsCanonical(source.SPECIFY_INIT_DIR)) return null;

  const environmentFeature = source.SPECIFY_FEATURE_DIRECTORY;
  const rawFeatureDirectory = isNonEmptyString(environmentFeature)
    ? environmentFeature
    : readPinnedFeatureDirectory();
  const featureDirectory = canonicalInRepositoryFeatureDirectory(rawFeatureDirectory);
  if (!featureDirectory) return null;

  const featureState = canonicalInRepositoryFileTarget(".specify/feature.json");
  if (!featureState) return null;
  const fileTargets = [];
  for (const file of reviewedCommand.targetFiles) {
    const target = canonicalInRepositoryFileTarget(`${featureDirectory}/${file}`);
    if (!target) return null;
    fileTargets.push(target);
  }

  return unique([
    featureState,
    featureDirectory,
    ...fileTargets,
  ]);
}

function specifyInitDirectoryIsCanonical(value) {
  if (value === undefined || value === null || value === "") return true;
  if (!isNonEmptyString(value) || value.includes("\0")) return false;
  const candidate = path.resolve(REPOSITORY_ROOT, value);
  if (candidate !== REPOSITORY_ROOT) return false;
  try {
    const stat = lstatSync(candidate, { bigint: true });
    return (
      stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      REALPATH(candidate) === REPOSITORY_ROOT
    );
  } catch {
    return false;
  }
}

function readPinnedFeatureDirectory() {
  const target = path.join(REPOSITORY_ROOT, ".specify/feature.json");
  let descriptor;
  try {
    const pathStat = lstatSync(target, { bigint: true });
    if (
      !pathStat.isFile() ||
      pathStat.isSymbolicLink() ||
      pathStat.nlink !== 1n ||
      pathStat.size > 65536n ||
      REALPATH(target) !== target
    ) {
      return null;
    }

    descriptor = openSync(
      target,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0)
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (!sameFileIdentity(pathStat, before) || before.nlink !== 1n) return null;
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameFileSnapshot(before, after)) return null;

    const parsed = JSON.parse(bytes.toString("utf8"));
    return isNonEmptyString(parsed?.feature_directory) ? parsed.feature_directory : null;
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function canonicalInRepositoryFeatureDirectory(value) {
  return canonicalInRepositoryTarget(value, "directory");
}

function canonicalInRepositoryFileTarget(value) {
  return canonicalInRepositoryTarget(value, "file");
}

function canonicalInRepositoryTarget(value, expectedType) {
  if (!isNonEmptyString(value) || value.includes("\0")) return null;
  const candidate = path.resolve(REPOSITORY_ROOT, value);
  if (!pathInsideRepository(candidate)) return null;

  const relative = path.relative(REPOSITORY_ROOT, candidate);
  const segments = relative.split(path.sep).filter(Boolean);
  let cursor = REPOSITORY_ROOT;
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]);
    try {
      const stat = lstatSync(cursor, { bigint: true });
      if (stat.isSymbolicLink() || REALPATH(cursor) !== cursor) return null;
      if (index < segments.length - 1 && !stat.isDirectory()) return null;
      if (index === segments.length - 1) {
        if (expectedType === "directory" && !stat.isDirectory()) return null;
        if (expectedType === "file" && (!stat.isFile() || stat.nlink !== 1n)) return null;
      }
    } catch (error) {
      if (error?.code === "ENOENT") break;
      return null;
    }
  }

  return segments.join("/");
}

function repositoryLocationsAreCanonical(locationEvidence, executorCwd) {
  if (!isNonEmptyString(executorCwd) || !path.isAbsolute(executorCwd)) return false;
  const resolvedExecutorCwd = path.resolve(executorCwd);
  if (resolvedExecutorCwd !== REPOSITORY_ROOT) return false;
  try {
    const rootStat = lstatSync(REPOSITORY_ROOT, { bigint: true });
    if (
      !rootStat.isDirectory() ||
      rootStat.isSymbolicLink() ||
      REALPATH(REPOSITORY_ROOT) !== REPOSITORY_ROOT ||
      REALPATH(resolvedExecutorCwd) !== REPOSITORY_ROOT
    ) {
      return false;
    }

    let hasNonEmptyLocation = false;
    for (const evidence of Array.isArray(locationEvidence) ? locationEvidence : []) {
      if (!evidence?.supplied) continue;
      if (typeof evidence.value !== "string") return false;
      if (!evidence.value.trim()) return false;
      hasNonEmptyLocation = true;
      const resolvedLocation = path.resolve(resolvedExecutorCwd, evidence.value);
      if (
        resolvedLocation !== REPOSITORY_ROOT ||
        REALPATH(resolvedLocation) !== REPOSITORY_ROOT
      ) {
        return false;
      }
    }
    return hasNonEmptyLocation;
  } catch {
    return false;
  }
}

function readReviewedRegularFile(reviewedFile) {
  const target = path.resolve(REPOSITORY_ROOT, reviewedFile.relativePath);
  if (path.dirname(target) === target || !pathInsideRepository(target)) return null;

  let descriptor;
  try {
    const pathStat = lstatSync(target, { bigint: true });
    if (!reviewedFileStatMatches(pathStat, reviewedFile)) return null;
    if (REALPATH(target) !== target) return null;

    descriptor = openSync(
      target,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0)
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (!sameFileIdentity(pathStat, before) || !reviewedFileStatMatches(before, reviewedFile)) {
      return null;
    }

    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameFileSnapshot(before, after)) return null;
    return sha256(bytes) === reviewedFile.sha256 ? bytes : null;
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function pathInsideRepository(candidate) {
  const relative = path.relative(REPOSITORY_ROOT, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function reviewedFileStatMatches(stat, reviewedFile) {
  return (
    stat.isFile() &&
    !stat.isSymbolicLink() &&
    stat.nlink === 1n &&
    stat.size === BigInt(reviewedFile.size) &&
    (stat.mode & 0o777n) === BigInt(reviewedFile.mode)
  );
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileSnapshot(left, right) {
  return (
    sameFileIdentity(left, right) &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function analyzeToolEvent(event) {
  const input =
    event && typeof event.tool_input === "object" && event.tool_input !== null
      ? event.tool_input
      : {};
  const toolName = String(event?.tool_name || event?.tool || event?.matcher || "");
  const writeLikeTool = WRITE_TOOL_PATTERN.test(toolName);
  const shellTool = SHELL_TOOL_PATTERN.test(toolName);
  const structuredPaths = extractStructuredPaths(input);
  const directTargets = structuredPaths.paths;
  const patchTexts = [input.patch, input.input, event?.patch].filter(isNonEmptyString);
  if (writeLikeTool && isNonEmptyString(input.command)) patchTexts.push(input.command);
  const patchTargets = patchTexts.flatMap(extractPatchPaths);
  const command = [input.command, input.cmd].filter(isNonEmptyString).join("\n");
  const locationEvidence = [
    { supplied: hasOwn(event, "cwd"), value: event?.cwd },
    { supplied: hasOwn(input, "cwd"), value: input.cwd },
    { supplied: hasOwn(input, "workdir"), value: input.workdir },
  ];
  const shell = shellTool
    ? analyzeShellCommand(command, {
        allowReviewedDirect: true,
        executorCwd: process.cwd(),
        locationEvidence,
      })
    : {
        mutationIntent: false,
        destructiveFilesystem: false,
        dynamicTarget: false,
        opaqueExecution: false,
        recognizedCommands: [],
        targets: [],
        unknownExecution: false,
        workingDirectories: [],
      };

  return {
    command,
    mutationIntent: writeLikeTool || shell.mutationIntent,
    destructiveFilesystem: shell.destructiveFilesystem,
    dynamicTarget: shell.dynamicTarget || (writeLikeTool && structuredPaths.overflow),
    patchTargets,
    shellMutation: shell.mutationIntent,
    opaqueExecution: shell.opaqueExecution,
    unknownExecution: shell.unknownExecution,
    targets: unique([...directTargets, ...patchTargets, ...shell.targets]),
    toolName,
    workingDirectories: shell.workingDirectories,
    writeLikeTool,
    recognizedCommands: shell.recognizedCommands,
  };
}

function extractPatchPaths(text) {
  const targets = [];
  for (const match of String(text || "").matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) {
    targets.push(match[1].trim());
  }
  for (const match of String(text || "").matchAll(/^\*\*\* Move to: (.+)$/gm)) {
    targets.push(match[1].trim());
  }
  for (const match of String(text || "").matchAll(/^(?:---|\+\+\+) (.+)$/gm)) {
    const candidate = match[1].split("\t", 1)[0].trim().replace(/^[ab]\//, "");
    if (candidate !== "/dev/null") targets.push(candidate);
  }
  return unique(targets);
}

function extractStructuredPaths(value) {
  const state = { overflow: false, paths: [] };
  visitStructuredPaths(value, 0, state);
  return { overflow: state.overflow, paths: unique(state.paths) };
}

function visitStructuredPaths(value, depth, state) {
  if (value === null || value === undefined) return;
  if (depth > 4) {
    state.overflow = true;
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visitStructuredPaths(item, depth + 1, state);
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, candidate] of Object.entries(value)) {
    if (STRUCTURED_PATH_KEYS.has(key.toLowerCase()) && isNonEmptyString(candidate)) {
      if (state.paths.length >= 100) {
        state.overflow = true;
      } else {
        state.paths.push(candidate);
      }
    } else if (typeof candidate === "object" && candidate !== null) {
      visitStructuredPaths(candidate, depth + 1, state);
    }
  }
}

function analyzeShellCommand(command, options = {}) {
  const text = String(command || "");
  if (!text.trim()) {
    return {
      mutationIntent: false,
      destructiveFilesystem: false,
      dynamicTarget: false,
      opaqueExecution: false,
      recognizedCommands: [],
      targets: [],
      unknownExecution: false,
      workingDirectories: [],
    };
  }
  if (options.allowReviewedDirect === true) {
    const reviewed = reviewedDirectCommandAnalysis(
      text,
      options.locationEvidence,
      options.executorCwd,
      options.environment || process.env
    );
    if (reviewed) return reviewed;
  }
  const targets = extractOutputRedirections(text);
  const workingDirectories = [];
  const recognizedCommands = [];
  let mutationIntent = targets.length > 0;
  let destructiveFilesystem = false;
  let dynamicTarget = targets.some((target) => /[$*?\[\]{}()`]/.test(target));
  let opaqueExecution = false;
  let unknownExecution = false;

  for (const statement of splitStatements(text)) {
    const tokens = tokenizeWords(stripShellGrouping(statement));
    if (tokens.length === 0) continue;
    const directoryChange = shellDirectoryChange(tokens);
    if (directoryChange) workingDirectories.push(directoryChange);
    const result = analyzeStatement(tokens);
    if (!result) {
      if (!isReadOnlyStatement(tokens)) unknownExecution = true;
      continue;
    }
    mutationIntent = true;
    destructiveFilesystem ||= result.destructiveFilesystem === true;
    dynamicTarget ||= result.dynamicTarget === true;
    opaqueExecution ||= result.opaqueExecution === true;
    recognizedCommands.push(result.command);
    targets.push(...result.targets);
  }

  return {
    mutationIntent,
    destructiveFilesystem,
    dynamicTarget,
    opaqueExecution,
    unknownExecution,
    targets: unique(targets.map(normalizeShellTarget).filter(Boolean)),
    recognizedCommands: unique(recognizedCommands),
    workingDirectories: unique(workingDirectories.map(normalizeShellTarget).filter(Boolean)),
  };
}

function analyzeStatement(tokens) {
  const commandIndex = commandIndexAfterPrefixes(tokens);
  if (commandIndex >= tokens.length) return null;
  const command = baseCommand(tokens[commandIndex]);
  const args = tokens.slice(commandIndex + 1);

  if (["bash", "sh", "zsh"].includes(command)) {
    const commandFlag = args.findIndex((arg) => arg === "-c" || arg === "-lc");
    if (commandFlag >= 0 && args[commandFlag + 1]) {
      const nested = analyzeShellCommand(args[commandFlag + 1], {
        allowReviewedDirect: false,
      });
      return nested.mutationIntent
        ? {
            command: `${command} -c`,
            destructiveFilesystem: nested.destructiveFilesystem,
            dynamicTarget: nested.dynamicTarget,
            opaqueExecution: nested.opaqueExecution,
            targets: nested.targets.length > 0 ? nested.targets : ["."],
          }
        : null;
    }
    if (
      args.length === 0 ||
      args.every((arg) => ["--help", "--version", "-n", "-v"].includes(arg))
    ) {
      return null;
    }
    return {
      ...mutationResult(`${command} script`, positional(args)),
      opaqueExecution: true,
    };
  }

  if (
    ["node", "nodejs", "bun", "deno", "python", "python3", "py", "ruby", "perl", "php"].includes(
      command
    )
  ) {
    const inline = analyzeInlineProgram(command, args);
    if (inline) return inline;
    if (interpreterInvocationIsReadOnly(command, args)) return null;
    return {
      ...mutationResult(`${command} program`, positional(args)),
      opaqueExecution: true,
    };
  }

  if ([".", "eval", "source", "xargs", "parallel"].includes(command)) {
    return {
      ...mutationResult(`${command} opaque`, positional(args)),
      opaqueExecution: true,
    };
  }

  if (["rm", "rmdir", "shred", "srm", "unlink"].includes(command)) {
    return {
      ...mutationResult(command, positional(args)),
      destructiveFilesystem: true,
    };
  }
  if (["touch", "mkdir", "tee"].includes(command)) {
    return mutationResult(command, positional(args));
  }
  if (command === "truncate") {
    return {
      ...mutationResult(command, positional(args)),
      destructiveFilesystem: true,
    };
  }
  if (["mv", "cp", "install", "ln", "rsync"].includes(command)) {
    const targetDirectory = optionValue(args, "-t", "--target-directory");
    const values = positional(args);
    return mutationResult(command, targetDirectory ? [...values, targetDirectory] : values);
  }
  if (["chmod", "chown", "chgrp"].includes(command)) {
    const values = positional(args);
    return mutationResult(command, values.length > 1 ? values.slice(1) : []);
  }
  if (command === "dd") {
    const output = args.find((arg) => arg.startsWith("of="));
    return {
      ...mutationResult(command, output ? [output.slice(3)] : []),
      destructiveFilesystem: true,
    };
  }
  if (
    [
      "add-content",
      "clear-content",
      "new-item",
      "out-file",
      "remove-item",
      "rename-item",
      "set-content",
    ].includes(command)
  ) {
    const explicitTarget = optionValueInsensitive(args, [
      "-destination",
      "-filepath",
      "-literalpath",
      "-path",
    ]);
    const values = positional(args);
    return {
      ...mutationResult(
        command,
        explicitTarget ? [explicitTarget] : values.length > 0 ? [values[0]] : []
      ),
      destructiveFilesystem: ["clear-content", "remove-item"].includes(command),
    };
  }
  if (["copy-item", "move-item"].includes(command)) {
    const destination = optionValueInsensitive(args, ["-destination"]);
    const source = optionValueInsensitive(args, ["-literalpath", "-path"]);
    const values = positional(args);
    return mutationResult(command, unique([source, destination, ...values]));
  }
  if (command === "find") {
    if (args.includes("-delete")) {
      return {
        ...mutationResult(command, positional(args).slice(0, 1)),
        destructiveFilesystem: true,
      };
    }
    const execIndex = args.findIndex((arg) => arg === "-exec" || arg === "-execdir");
    if (execIndex >= 0) {
      const nestedTokens = args
        .slice(execIndex + 1)
        .filter((arg) => arg !== ";" && arg !== "+" && arg !== "\\");
      const nested = analyzeStatement(nestedTokens);
      if (nested) {
        return {
          command: `find ${args[execIndex]}`,
          destructiveFilesystem: nested.destructiveFilesystem,
          dynamicTarget: nested.dynamicTarget,
          opaqueExecution: nested.opaqueExecution,
          targets: nested.targets,
        };
      }
    }
  }
  if (
    ["node", "nodejs", "bun", "deno", "python", "python3", "py", "ruby", "perl", "php"].includes(
      command
    )
  ) {
    return interpreterInvocationIsReadOnly(command, args);
  }
  if (["sed", "perl"].includes(command) && args.some((arg) => /^-.*i/.test(arg))) {
    const values = positional(args);
    return mutationResult(command, values);
  }
  if (command === "git") return analyzeGit(args);
  if (["npm", "pnpm", "yarn", "bun"].includes(command)) {
    const operation = args.find((arg) => !arg.startsWith("-"));
    if (["add", "install", "remove", "uninstall", "update", "upgrade"].includes(operation)) {
      return {
        ...mutationResult(`${command} ${operation}`, ["package.json"]),
        opaqueExecution: true,
      };
    }
  }
  return null;
}

function isReadOnlyStatement(tokens) {
  const commandIndex = commandIndexAfterPrefixes(tokens);
  if (commandIndex >= tokens.length) return true;
  const command = baseCommand(tokens[commandIndex]);
  const args = tokens.slice(commandIndex + 1);
  if (
    [
      "cat",
      "cd",
      "chdir",
      "cut",
      "dir",
      "echo",
      "file",
      "grep",
      "head",
      "jq",
      "ls",
      "md5",
      "md5sum",
      "popd",
      "printf",
      "pushd",
      "pwd",
      "readlink",
      "realpath",
      "rg",
      "sed",
      "set-location",
      "sha256sum",
      "shasum",
      "sl",
      "sort",
      "stat",
      "tail",
      "test",
      "tr",
      "type",
      "uniq",
      "wc",
      "which",
    ].includes(command)
  ) {
    return true;
  }
  if (command === "find") {
    return !args.some((arg) => ["-delete", "-exec", "-execdir", "-ok", "-okdir"].includes(arg));
  }
  if (["bash", "sh", "zsh", "powershell", "pwsh"].includes(command)) {
    const commandFlag = args.findIndex((arg) =>
      ["-c", "-lc", "-command"].includes(arg.toLowerCase())
    );
    if (commandFlag < 0 || !args[commandFlag + 1]) return false;
    const nested = analyzeShellCommand(args[commandFlag + 1], {
      allowReviewedDirect: false,
    });
    return !nested.mutationIntent && !nested.opaqueExecution && !nested.unknownExecution;
  }
  if (command === "git") return isReadOnlyGit(args);
  if (["npm", "pnpm", "yarn", "bun"].includes(command)) {
    return isReadOnlyPackageRun(args);
  }
  return false;
}

function isReadOnlyGit(args) {
  const normalizedArgs = stripGitGlobalOptions(args);
  const operationIndex = normalizedArgs.findIndex((arg) => !arg.startsWith("-"));
  if (operationIndex < 0) return true;
  const operation = normalizedArgs[operationIndex].toLowerCase();
  const rest = normalizedArgs.slice(operationIndex + 1);
  if (
    [
      "annotate",
      "blame",
      "cat-file",
      "check-attr",
      "check-ignore",
      "check-ref-format",
      "cherry",
      "count-objects",
      "describe",
      "diff",
      "diff-files",
      "diff-index",
      "diff-tree",
      "difftool",
      "for-each-ref",
      "grep",
      "help",
      "log",
      "ls-files",
      "ls-remote",
      "ls-tree",
      "merge-base",
      "name-rev",
      "rev-list",
      "rev-parse",
      "shortlog",
      "show",
      "show-ref",
      "status",
      "verify-commit",
      "verify-tag",
      "version",
      "whatchanged",
    ].includes(operation)
  ) {
    return true;
  }
  if (operation === "clean") return rest.some(isDryRunArgument);
  if (operation === "branch") {
    return !rest.some(
      (arg) =>
        /^-[^-]*[cCdDfFmM]/.test(arg) || ["--copy", "--delete", "--force", "--move"].includes(arg)
    );
  }
  if (operation === "tag") {
    return (
      rest.length === 0 ||
      rest.some((arg) =>
        [
          "-l",
          "--list",
          "--contains",
          "--no-contains",
          "--points-at",
          "--merged",
          "--no-merged",
        ].includes(arg)
      )
    );
  }
  if (operation === "notes") {
    const subcommand = rest.find((arg) => !arg.startsWith("-")) || "list";
    return ["get-ref", "list", "show"].includes(subcommand);
  }
  if (operation === "remote") {
    const subcommand = rest.find((arg) => !arg.startsWith("-")) || "";
    return !subcommand || ["get-url", "show"].includes(subcommand);
  }
  if (operation === "config") {
    return rest.some((arg) =>
      /^(?:--get|--get-all|--get-regexp|--get-urlmatch|--list|-l|--show-origin|--show-names|--show-scope)$/.test(
        arg
      )
    );
  }
  if (operation === "worktree") {
    const subcommand = rest.find((arg) => !arg.startsWith("-")) || "";
    return subcommand === "list";
  }
  if (operation === "symbolic-ref") {
    const positionalValues = rest.filter((arg) => !arg.startsWith("-"));
    return !rest.includes("--delete") && positionalValues.length <= 1;
  }
  if (operation === "stash") {
    const subcommand = rest.find((arg) => !arg.startsWith("-")) || "list";
    return ["list", "show"].includes(subcommand);
  }
  return false;
}

function isReadOnlyPackageRun(args) {
  const runIndex = args.findIndex((arg) => arg.toLowerCase() === "run");
  let script = "";
  if (runIndex >= 0) {
    script = args[runIndex + 1] || "";
  } else {
    script = args.find((arg) => !arg.startsWith("-")) || "";
  }
  return REVIEWED_PACKAGE_SCRIPTS.has(script.toLowerCase());
}

function analyzeGit(args) {
  const normalizedArgs = stripGitGlobalOptions(args);
  const operationIndex = normalizedArgs.findIndex((arg) => !arg.startsWith("-"));
  if (operationIndex < 0) return null;
  const operation = normalizedArgs[operationIndex];
  const rest = normalizedArgs.slice(operationIndex + 1);
  if (operation === "clean" && rest.some(isDryRunArgument)) {
    return null;
  }
  if (
    [
      "add",
      "am",
      "cherry-pick",
      "clean",
      "commit",
      "merge",
      "pull",
      "push",
      "rebase",
      "reset",
      "revert",
      "switch",
    ].includes(operation)
  ) {
    return mutationResult(`git ${operation}`, ["."]);
  }
  if (operation === "stash" && rest.some((arg) => ["apply", "pop"].includes(arg))) {
    return mutationResult("git stash", ["."]);
  }
  if (["checkout", "restore"].includes(operation)) {
    const separator = rest.indexOf("--");
    if (separator >= 0) return mutationResult(`git ${operation}`, rest.slice(separator + 1));
    return mutationResult(`git ${operation}`, ["."]);
  }
  if (operation === "apply") return mutationResult("git apply", ["."]);
  if (["rm", "mv", "update-ref", "replace"].includes(operation)) {
    return mutationResult(`git ${operation}`, ["."]);
  }
  if (
    operation === "branch" &&
    rest.some((arg) => /^-[dDmM]$/.test(arg) || /^--(?:delete|move|force)$/.test(arg))
  ) {
    return mutationResult("git branch", ["."]);
  }
  if (
    operation === "worktree" &&
    rest.some((arg) => ["add", "lock", "move", "prune", "remove", "repair", "unlock"].includes(arg))
  ) {
    return mutationResult("git worktree", ["."]);
  }
  return null;
}

function analyzeGitOperations(command) {
  const operations = [];
  for (const statement of splitStatements(command)) {
    collectGitOperations(tokenizeWords(stripShellGrouping(statement)), operations);
  }
  return operations;
}

function collectGitOperations(tokens, operations) {
  const commandIndex = commandIndexAfterPrefixes(tokens);
  if (commandIndex >= tokens.length) return;
  const command = baseCommand(tokens[commandIndex]);
  const args = tokens.slice(commandIndex + 1);
  if (["bash", "sh", "zsh", "powershell", "pwsh"].includes(command)) {
    const commandFlag = args.findIndex((arg) =>
      ["-c", "-lc", "-command"].includes(arg.toLowerCase())
    );
    if (commandFlag >= 0 && args[commandFlag + 1]) {
      operations.push(...analyzeGitOperations(args[commandFlag + 1]));
    }
    return;
  }
  if (command !== "git") return;

  const normalizedArgs = stripGitGlobalOptions(args);
  const operationIndex = normalizedArgs.findIndex((arg) => !arg.startsWith("-"));
  if (operationIndex < 0) return;
  const operation = normalizedArgs[operationIndex].toLowerCase();
  const rest = normalizedArgs.slice(operationIndex + 1);
  const reason =
    gitSafetyBypassReason(tokens.slice(0, commandIndex), args, operation, rest) ||
    destructiveGitReason(operation, rest);
  const repositoryPaths = gitRepositoryPaths(args, tokens.slice(0, commandIndex));
  operations.push({
    args: rest,
    dangerous: Boolean(reason),
    operation,
    reason,
    repositoryPaths: repositoryPaths.explicit,
    workingDirectories: repositoryPaths.workingDirectories,
  });
}

function gitSafetyBypassReason(prefixTokens, gitArgs, operation, operationArgs) {
  const environmentBypass = prefixTokens.some((token) =>
    /^(?:HUSKY|HUSKY_SKIP_HOOKS|SKIP_HUSKY|GIT_(?:ALTERNATE_OBJECT_DIRECTORIES|COMMON_DIR|CONFIG(?:_[A-Z0-9_]+)?|DIR|INDEX_FILE|NAMESPACE|OBJECT_DIRECTORY|WORK_TREE))=/i.test(
      token
    )
  );
  if (environmentBypass) {
    return "environment override can bypass the cross-client Git safety hooks";
  }
  for (let index = 0; index < gitArgs.length; index += 1) {
    const arg = gitArgs[index];
    const configValue = arg === "-c" ? gitArgs[index + 1] || "" : /^-c(.+)$/.exec(arg)?.[1] || "";
    if (/^core\.hooksPath=/i.test(configValue)) {
      return "core.hooksPath override can bypass the cross-client Git safety hooks";
    }
    if (/^alias\./i.test(configValue)) {
      return "Git alias override can bypass the cross-client Git safety hooks";
    }
    if (/^--config-env=core\.hooksPath=/i.test(arg)) {
      return "core.hooksPath override can bypass the cross-client Git safety hooks";
    }
    if (/^--config-env=alias\./i.test(arg)) {
      return "Git alias override can bypass the cross-client Git safety hooks";
    }
  }
  if (
    operation === "commit" &&
    operationArgs.some(
      (arg) =>
        arg === "--no-verify" ||
        (arg.startsWith("-") && !arg.startsWith("--") && arg.slice(1).includes("n"))
    )
  ) {
    return "git commit --no-verify bypasses the cross-client Git safety hooks";
  }
  if (operation === "push" && operationArgs.includes("--no-verify")) {
    return "git push --no-verify bypasses the cross-client Git safety hooks";
  }
  return "";
}

function gitRepositoryPaths(args, prefixTokens = []) {
  const explicit = gitEnvironmentRepositoryPaths(prefixTokens);
  const workingDirectories = [];
  const consumesValue = new Set([
    "-c",
    "--config-env",
    "--git-dir",
    "--namespace",
    "--super-prefix",
    "--work-tree",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-C") {
      if (args[index + 1]) workingDirectories.push(args[index + 1]);
      index += 1;
      continue;
    }
    if (/^-C.+/.test(arg)) {
      workingDirectories.push(arg.slice(2));
      continue;
    }
    if (arg === "--git-dir" || arg === "--work-tree") {
      if (args[index + 1]) explicit.push(args[index + 1]);
      index += 1;
      continue;
    }
    const explicitPath = /^--(?:git-dir|work-tree)=(.+)$/.exec(arg);
    if (explicitPath) {
      explicit.push(explicitPath[1]);
      continue;
    }
    if (consumesValue.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) continue;
    break;
  }
  return { explicit, workingDirectories };
}

function destructiveGitReason(operation, args) {
  if (
    [
      "reset",
      "restore",
      "checkout",
      "switch",
      "rebase",
      "merge",
      "pull",
      "cherry-pick",
      "revert",
      "am",
      "update-ref",
      "replace",
      "filter-branch",
      "filter-repo",
    ].includes(operation)
  ) {
    return `git ${operation} can discard, rewrite, or ambiguously combine agent work`;
  }
  if (operation === "fetch") {
    return "direct git fetch mutates shared remote-tracking refs; use the fetch-only workspace sync";
  }
  if (operation === "clean" && !args.some(isDryRunArgument)) {
    return "git clean can delete untracked or ignored recovery files";
  }
  if (
    operation === "push" &&
    args.some(
      (arg) =>
        arg === "-f" ||
        /^-[^-]*f/.test(arg) ||
        arg.startsWith("--force") ||
        arg === "--delete" ||
        arg === "--mirror" ||
        arg === "--prune" ||
        /^\+[^+]/.test(arg) ||
        /^:[^:]/.test(arg)
    )
  ) {
    return "forced or deleting pushes can remove remote recovery history";
  }
  if (
    operation === "push" &&
    args.some(
      (arg) =>
        arg === "--all" ||
        arg === "main" ||
        arg === "refs/heads/main" ||
        /:(?:refs\/heads\/)?main$/.test(arg)
    )
  ) {
    return "direct pushes to refs/heads/main are forbidden; use a pull request";
  }
  if (
    operation === "push" &&
    args.some(
      (arg) =>
        arg === "--tags" ||
        /(?:^|:)refs\/tags\//.test(arg) ||
        /:(?:refs\/heads\/)?(?:codex|kimi)\//.test(arg)
    )
  ) {
    return "explicit tag or renamed agent-branch pushes bypass the same-name handoff contract";
  }
  if (
    operation === "branch" &&
    args.some(
      (arg) =>
        /^-[^-]*[dDfFmM]/.test(arg) || /^-[^-]*C/.test(arg) || /^--(?:delete|move|force)$/.test(arg)
    )
  ) {
    return "branch deletion or forced movement can hide recovery refs";
  }
  if (
    operation === "worktree" &&
    args.some((arg) => ["add", "lock", "move", "prune", "remove", "repair", "unlock"].includes(arg))
  ) {
    return "manual worktree administration bypasses the isolated workspace registry";
  }
  if (operation === "stash") {
    const subcommand = args.find((arg) => !arg.startsWith("-")) || "push";
    if (!["list", "show"].includes(subcommand)) {
      return "shared stash mutation or restoration is not bound to this agent handoff";
    }
  }
  if (operation === "remote") {
    const subcommand = args.find((arg) => !arg.startsWith("-")) || "";
    if (subcommand && !["get-url", "show"].includes(subcommand)) {
      return "remote mutation can disable canonical repository identity";
    }
  }
  if (operation === "config") {
    const positional = args.filter((arg) => !arg.startsWith("-"));
    const mutatingFlag = args.some((arg) =>
      /^(?:--add|--edit|-e|--fixed-value|--rename-section|--remove-section|--replace-all|--unset|--unset-all)$/.test(
        arg
      )
    );
    if (mutatingFlag || positional.length >= 2) {
      return "Git config mutation can disable hooks or change repository trust";
    }
  }
  if (operation === "commit" && args.includes("--amend")) {
    return "amending rewrites the current handoff tip";
  }
  if (operation === "tag") {
    const readOnly = args.some((arg) =>
      [
        "-l",
        "--list",
        "--contains",
        "--no-contains",
        "--points-at",
        "--merged",
        "--no-merged",
      ].includes(arg)
    );
    const mutating =
      args.some(
        (arg) =>
          /^-[^-]*[adfsu]$/.test(arg) ||
          ["--annotate", "--delete", "--force", "--sign", "--local-user"].includes(arg)
      ) ||
      (!readOnly && args.some((arg) => !arg.startsWith("-")));
    if (mutating) return "git tag mutation can rewrite or hide recovery references";
  }
  if (operation === "notes") {
    const subcommand = args.find((arg) => !arg.startsWith("-")) || "list";
    if (!["get-ref", "list", "show"].includes(subcommand)) {
      return "git notes mutation can attach hidden or rewritten recovery metadata";
    }
  }
  if (["gc", "prune", "repack", "reflog"].includes(operation)) {
    return `git ${operation} can remove recovery evidence`;
  }
  if (
    !["add", "apply", "commit", "mv", "push", "rm"].includes(operation) &&
    !isReadOnlyGit([operation, ...args])
  ) {
    return `git ${operation} is not an approved read-only or ordinary feature-branch operation`;
  }
  return "";
}

function isDryRunArgument(arg) {
  return arg === "--dry-run" || /^-[^-]*n/.test(arg);
}

function mutationResult(command, targets) {
  const rawTargets = targets.map((target) => String(target || "")).filter(Boolean);
  const normalized = rawTargets.map(normalizeShellTarget).filter(Boolean);
  return {
    command,
    dynamicTarget: rawTargets.some((target) => /[$*?\[\]{}()`]/.test(target)),
    targets: normalized.length > 0 ? normalized : ["."],
  };
}

function positional(args) {
  const values = [];
  let optionsEnded = false;
  for (const arg of args) {
    if (arg === "--") {
      optionsEnded = true;
      continue;
    }
    if (!optionsEnded && arg.startsWith("-")) continue;
    values.push(arg);
  }
  return values;
}

function extractOutputRedirections(text) {
  const targets = [];
  const input = String(text);
  let quote = null;
  let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char !== ">") continue;
    if (input[index - 1] === ">") continue;

    let cursor = input[index + 1] === ">" ? index + 2 : index + 1;
    while (/\s/.test(input[cursor] || "")) cursor += 1;
    let target = "";
    let targetQuote = null;
    let targetEscaped = false;
    while (cursor < input.length) {
      const candidate = input[cursor];
      if (targetEscaped) {
        target += candidate;
        targetEscaped = false;
        cursor += 1;
        continue;
      }
      if (candidate === "\\" && targetQuote !== "'") {
        targetEscaped = true;
        cursor += 1;
        continue;
      }
      if (targetQuote) {
        if (candidate === targetQuote) targetQuote = null;
        else target += candidate;
        cursor += 1;
        continue;
      }
      if (candidate === "'" || candidate === '"') {
        targetQuote = candidate;
        cursor += 1;
        continue;
      }
      if (/[\s;&|<>]/.test(candidate)) break;
      target += candidate;
      cursor += 1;
    }
    if (normalizeShellTarget(target)) targets.push(target);
    index = Math.max(index, cursor - 1);
  }
  return targets;
}

function stripShellGrouping(statement) {
  return String(statement)
    .trim()
    .replace(/^[({]+\s*/, "")
    .replace(/\s*[)}]+$/, "")
    .trim();
}

function analyzeInlineProgram(command, args) {
  const flag =
    command.startsWith("python") || command === "py" ? "-c" : command === "php" ? "-r" : "-e";
  const flagIndex = args.findIndex((arg) => arg === flag || arg === "--eval");
  if (flagIndex < 0 || !args[flagIndex + 1]) return null;
  const program = args[flagIndex + 1];
  const mutationPattern =
    /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|truncate(?:Sync)?|unlink(?:Sync)?|rm(?:Sync)?|rename(?:Sync)?|copyFile(?:Sync)?|mkdir(?:Sync)?|chmod(?:Sync)?|chown(?:Sync)?|createWriteStream|write_text|write_bytes|unlink|remove|rmdir|rename|replace|copy|copy2|move|File\.(?:write|delete|rename)|exec(?:File)?Sync|spawnSync|system)\b/i;
  const opaqueExecutionPattern =
    /\b(?:exec(?:File)?Sync|spawnSync|system|subprocess\.(?:call|run|Popen)|child_process)\b/i;
  if (!mutationPattern.test(program) && !/\bopen\s*\([^)]*,\s*['"][wax+]/i.test(program))
    return null;
  const targets = [];
  for (const match of program.matchAll(/['"]([^'"\r\n]+)['"]/g)) {
    const candidate = match[1];
    if (/^(?:fs|node:fs|child_process|node:child_process|w|a|x|r\+|w\+|a\+)$/.test(candidate))
      continue;
    if (/[\\/]|\.[A-Za-z0-9_-]{1,12}$|^[A-Z][A-Z0-9_.-]+\.md$/i.test(candidate))
      targets.push(candidate);
  }
  return {
    ...mutationResult(`${command} inline`, targets),
    opaqueExecution: opaqueExecutionPattern.test(program),
  };
}

function interpreterInvocationIsReadOnly(command, args) {
  if (args.length === 0 || args.every((arg) => ["--help", "--version", "-h", "-V"].includes(arg))) {
    return true;
  }
  if (["node", "nodejs"].includes(command)) {
    return args.some((arg) => ["--check", "-c"].includes(arg));
  }
  return false;
}

function commandIndexAfterPrefixes(tokens) {
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    const command = baseCommand(token);
    if (
      /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(token) ||
      ["then", "do", "else", "elif", "time"].includes(command)
    ) {
      index += 1;
      continue;
    }
    if (["command", "nohup"].includes(command)) {
      index += 1;
      while (index < tokens.length && tokens[index].startsWith("-")) index += 1;
      continue;
    }
    if (command === "env") {
      index += 1;
      while (index < tokens.length) {
        const candidate = tokens[index];
        if (/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(candidate)) {
          index += 1;
          continue;
        }
        if (candidate === "--") {
          index += 1;
          break;
        }
        if (/^(?:-i|--ignore-environment|-0|--null)$/.test(candidate)) {
          index += 1;
          continue;
        }
        if (/^(?:-u|--unset)$/.test(candidate)) {
          index += 2;
          continue;
        }
        if (/^--unset=/.test(candidate)) {
          index += 1;
          continue;
        }
        break;
      }
      continue;
    }
    if (["sudo", "doas"].includes(command)) {
      index += 1;
      while (index < tokens.length && tokens[index].startsWith("-")) {
        const option = tokens[index];
        index += 1;
        if (/^(?:-u|-g|-h|-p|-C|--user|--group|--host|--prompt|--chdir)$/.test(option)) {
          index += 1;
        }
      }
      continue;
    }
    break;
  }
  return index;
}

function shellDirectoryChange(tokens) {
  const commandIndex = commandIndexAfterPrefixes(tokens);
  if (commandIndex >= tokens.length) return "";
  const command = baseCommand(tokens[commandIndex]);
  if (!["cd", "chdir", "pushd", "set-location", "sl"].includes(command)) return "";
  const args = tokens.slice(commandIndex + 1);
  const values = positional(args);
  return values.at(-1) || "";
}

function gitEnvironmentRepositoryPaths(prefixTokens) {
  const paths = [];
  for (const token of prefixTokens) {
    const match = /^GIT_(?:DIR|WORK_TREE)=(.+)$/i.exec(token);
    if (match?.[1]) paths.push(match[1]);
  }
  return paths;
}

function stripGitGlobalOptions(args) {
  const result = [];
  const consumesValue = new Set([
    "-C",
    "-c",
    "--git-dir",
    "--work-tree",
    "--namespace",
    "--config-env",
    "--super-prefix",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (result.length === 0 && consumesValue.has(arg)) {
      index += 1;
      continue;
    }
    if (
      result.length === 0 &&
      /^(?:-C|--git-dir=|--work-tree=|--namespace=|--config-env=|--super-prefix=)/.test(arg)
    )
      continue;
    if (result.length === 0 && arg.startsWith("-")) continue;
    result.push(...args.slice(index));
    break;
  }
  return result;
}

function optionValue(args, shortName, longName) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === shortName || arg === longName) return args[index + 1] || "";
    if (arg.startsWith(`${longName}=`)) return arg.slice(longName.length + 1);
  }
  return "";
}

function optionValueInsensitive(args, names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index]);
    const lower = arg.toLowerCase();
    if (wanted.has(lower)) return args[index + 1] || "";
    for (const name of wanted) {
      if (lower.startsWith(`${name}:`) || lower.startsWith(`${name}=`)) {
        return arg.slice(name.length + 1);
      }
    }
  }
  return "";
}

function splitStatements(text) {
  const statements = [];
  const input = String(text);
  let current = "";
  let quote = null;
  let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      current += char;
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    const pair = input.slice(index, index + 2);
    const ampersandSeparator = char === "&" && input[index - 1] !== ">" && input[index + 1] !== ">";
    if (char === "\n" || char === "\r" || char === ";" || char === "|" || ampersandSeparator) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      if (pair === "&&" || pair === "||") index += 1;
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function tokenizeWords(statement) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const char of String(statement)) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function normalizeShellCommandTokens(command) {
  const views = [String(command || ""), stripPowerShellBacktickEscapes(command)];
  return unique(views.map(normalizeShellCommandView)).join(" ; ");
}

function hasDynamicPackageScriptSelection(command) {
  for (const statement of splitStatements(command)) {
    const tokens = tokenizeWords(stripShellGrouping(statement));
    let commandIndex = commandIndexAfterPrefixes(tokens);
    if (commandIndex >= tokens.length) continue;
    let commandName = baseCommand(tokens[commandIndex]);
    if (commandName === "corepack") {
      commandIndex += 1;
      while (commandIndex < tokens.length && tokens[commandIndex].startsWith("-")) {
        commandIndex += 1;
      }
      commandName = baseCommand(tokens[commandIndex]);
    }
    if (!["bun", "npm", "pnpm", "yarn"].includes(commandName)) continue;
    const args = tokens.slice(commandIndex + 1);
    const runIndex = args.findIndex((arg) => arg.toLowerCase() === "run");
    const candidates =
      runIndex >= 0 ? args.slice(runIndex + 1) : commandName === "yarn" ? args : [];
    const script = candidates.find((arg) => arg !== "--" && !arg.startsWith("-")) || "";
    if (/[$`(){}%]/.test(script)) return true;
  }
  return false;
}

function hasExecutableShellExpansion(command) {
  const input = String(command || "").replace(/\\\r?\n/g, "");
  let quote = null;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote === "'") {
      if (char === "'") quote = null;
      continue;
    }
    if (!quote && char === "'") {
      quote = char;
      continue;
    }
    if (char === '"') {
      quote = quote === '"' ? null : '"';
      continue;
    }
    if (char === "`") return true;
    if (char === "$" && input[index + 1] === "(") return true;
    if (!quote && char === "(") return true;
  }
  return false;
}

function hasShellEnvironmentAssignment(command) {
  for (const statement of splitStatements(command)) {
    const tokens = tokenizeWords(stripShellGrouping(statement));
    const commandIndex = commandIndexAfterPrefixes(tokens);
    if (
      tokens
        .slice(0, commandIndex)
        .some((token) => /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(token))
    ) {
      return true;
    }
    const commandName = baseCommand(tokens[commandIndex]);
    if (["bash", "sh", "zsh", "powershell", "pwsh"].includes(commandName)) {
      const args = tokens.slice(commandIndex + 1);
      const nestedIndex = args.findIndex((arg) =>
        ["-c", "-lc", "-command"].includes(arg.toLowerCase())
      );
      if (nestedIndex >= 0 && args[nestedIndex + 1]) {
        if (hasShellEnvironmentAssignment(args[nestedIndex + 1])) return true;
      }
    }
  }
  return false;
}

function hasPrivilegedShellWrapper(command) {
  for (const statement of splitStatements(command)) {
    const tokens = tokenizeWords(stripShellGrouping(statement));
    const commandIndex = commandIndexAfterPrefixes(tokens);
    if (
      tokens
        .slice(0, Math.min(tokens.length, commandIndex + 1))
        .some((token) => ["sudo", "doas"].includes(baseCommand(token)))
    ) {
      return true;
    }
    const commandName = baseCommand(tokens[commandIndex]);
    if (["bash", "sh", "zsh", "powershell", "pwsh"].includes(commandName)) {
      const args = tokens.slice(commandIndex + 1);
      const nestedIndex = args.findIndex((arg) =>
        ["-c", "-lc", "-command"].includes(arg.toLowerCase())
      );
      if (nestedIndex >= 0 && args[nestedIndex + 1]) {
        if (hasPrivilegedShellWrapper(args[nestedIndex + 1])) return true;
      }
    }
  }
  return false;
}

function normalizeShellCommandView(command) {
  return splitStatements(command)
    .map((statement) => tokenizeWords(stripShellGrouping(statement)).join(" "))
    .filter(Boolean)
    .join(" ; ");
}

function stripPowerShellBacktickEscapes(command) {
  const input = String(command || "");
  let output = "";
  let quote = null;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote === "'") {
      output += char;
      if (char === "'") quote = null;
      continue;
    }
    if (char === "'") {
      quote = char;
      output += char;
      continue;
    }
    if (char === "`" && index + 1 < input.length) {
      const escaped = input[index + 1];
      index += 1;
      if (escaped === "\r" && input[index + 1] === "\n") index += 1;
      if (escaped !== "\r" && escaped !== "\n") output += escaped;
      continue;
    }
    output += char;
  }
  return output;
}

function normalizeShellTarget(value) {
  const target = String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!target) return "";
  if (SPECIAL_OUTPUTS.has(target.toLowerCase())) return "";
  if (/[$*?\[\]{}()`]/.test(target)) return ".";
  return target;
}

function baseCommand(value) {
  return path.posix.basename(String(value || "").replace(/\\/g, "/")).toLowerCase();
}

function hasOwn(value, key) {
  return value !== null && typeof value === "object" && Object.hasOwn(value, key);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values) {
  return [...new Set(values.filter(isNonEmptyString))];
}

module.exports = {
  analyzeGitOperations,
  analyzeShellCommand,
  analyzeToolEvent,
  extractPatchPaths,
  hasDynamicPackageScriptSelection,
  hasExecutableShellExpansion,
  hasPrivilegedShellWrapper,
  hasShellEnvironmentAssignment,
  normalizeShellCommandTokens,
};
