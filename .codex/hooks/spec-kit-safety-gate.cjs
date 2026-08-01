"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ERROR_PREFIX = "HOOK ERROR [spec-kit-safety-gate]";

function fail(message) {
  process.stderr.write(`${ERROR_PREFIX}: ${message}\n`);
  process.exit(2);
}

function allow() {
  process.stdout.write("{}\n");
  process.exit(0);
}

function resolveCurrentGitHubRepository() {
  let origin;
  try {
    origin = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    fail("unable to read the current git origin");
  }

  const originMatch =
    origin.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)$/) ??
    origin.match(/^git@github\.com:([^/\s]+)\/([^/\s]+)$/);
  if (!originMatch) {
    fail("unable to parse the current git origin as canonical GitHub HTTPS or SSH");
  }

  const owner = originMatch[1];
  const repo = originMatch[2].replace(/\.git$/, "");
  if (!owner || !repo || !/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
    fail("unable to parse the current git origin as canonical GitHub HTTPS or SSH");
  }

  return `${owner}/${repo}`;
}

function requireIssueAuthorization(repository) {
  const authorization = process.env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;
  if (!authorization) {
    fail("current direct user authorization requires ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION");
  }

  const expectedAuthorization = `${repository}#1`;
  if (authorization !== expectedAuthorization) {
    fail(`authorization target does not match origin; expected ${expectedAuthorization}`);
  }
}

function splitShellCommandSegments(command) {
  const segments = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (const character of command) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" || character === String.fromCharCode(96)) {
      current += character;
      escaped = true;
      continue;
    }
    if (quote !== null) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (";&|\r\n".includes(character)) {
      if (current.trim()) segments.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) segments.push(current);
  return segments;
}

function normalizeShellCommandCandidate(segment) {
  let candidate = segment.replace(/\s+/g, " ").trim();
  let previous;

  do {
    previous = candidate;
    candidate = candidate.replace(/^(?:if|then|else|do|!)\s+/i, "");
    candidate = candidate.replace(/^[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+/, "");
  } while (candidate !== previous);

  return candidate;
}

function tokenizeShellCandidate(candidate) {
  const tokens = [];
  let current = "";
  let quote = null;
  let tokenStarted = false;

  const pushCurrent = () => {
    if (tokenStarted) tokens.push(current);
    current = "";
    tokenStarted = false;
  };

  for (let index = 0; index < candidate.length; index += 1) {
    const character = candidate[index];
    const nextCharacter = candidate[index + 1];

    if (character === "\\") {
      tokenStarted = true;
      if (quote === "'") {
        current += character;
      } else if (quote === '"' && !["$", "`", '"', "\\", "\n"].includes(nextCharacter)) {
        current += character;
      } else if (nextCharacter !== undefined) {
        current += nextCharacter;
        index += 1;
      } else {
        current += character;
      }
      continue;
    }

    if (character === String.fromCharCode(96)) {
      tokenStarted = true;
      if (nextCharacter !== undefined) {
        current += nextCharacter;
        index += 1;
      } else {
        current += character;
      }
      continue;
    }

    if (quote !== null) {
      tokenStarted = true;
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(character)) {
      pushCurrent();
      continue;
    }

    tokenStarted = true;
    current += character;
  }

  pushCurrent();
  return tokens;
}

function serializeShellTokens(tokens) {
  return tokens.map((token) => JSON.stringify(token)).join(" ");
}

function executableBasename(token) {
  const normalized = String(token ?? "")
    .replace(/\\/g, "/")
    .toLowerCase();
  const basename = normalized.split("/").at(-1) ?? "";
  if (basename === "gh" || basename === "gh.exe") return basename;
  if (normalized.includes(":") && normalized.endsWith("gh.exe")) return "gh.exe";
  return basename;
}

function isGitHubCliExecutable(token) {
  const basename = executableBasename(token);
  return basename === "gh" || basename === "gh.exe";
}

function unwrapEnvTokens(tokens) {
  const valueOptions = new Set(["-u", "--unset", "-c", "--chdir", "--argv0"]);
  const flagOptions = new Set(["-i", "--ignore-environment", "-0", "--null", "-v", "--debug"]);
  let index = 1;

  while (index < tokens.length) {
    const token = tokens[index];
    const lowerToken = token.toLowerCase();
    if (lowerToken === "--") return tokens.slice(index + 1);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
      index += 1;
      continue;
    }
    if (lowerToken === "-s" || lowerToken === "--split-string") {
      return tokens.slice(index + 1);
    }
    if (lowerToken.startsWith("--split-string=")) {
      return [token.slice(token.indexOf("=") + 1), ...tokens.slice(index + 1)];
    }
    if (valueOptions.has(lowerToken)) {
      index += 2;
      continue;
    }
    if (
      lowerToken.startsWith("--unset=") ||
      lowerToken.startsWith("--chdir=") ||
      lowerToken.startsWith("--argv0=") ||
      (/^-u.+/.test(lowerToken) && lowerToken !== "-u")
    ) {
      index += 1;
      continue;
    }
    if (flagOptions.has(lowerToken)) {
      index += 1;
      continue;
    }
    if (lowerToken.startsWith("-")) return [];
    return tokens.slice(index);
  }

  return [];
}

function unwrapCommandTokens(tokens) {
  let index = 1;
  while (index < tokens.length) {
    const token = tokens[index].toLowerCase();
    if (token === "-v") return [];
    if (token === "--") return tokens.slice(index + 1);
    if (token === "-p") {
      index += 1;
      continue;
    }
    if (token.startsWith("-")) return [];
    return tokens.slice(index);
  }
  return [];
}

function unwrapSudoTokens(tokens) {
  const valueShortOptions = new Set(["-u", "-g", "-h", "-p", "-C", "-R", "-D", "-T", "-r", "-t"]);
  const valueLongOptions = new Set([
    "--user",
    "--group",
    "--host",
    "--prompt",
    "--close-from",
    "--chroot",
    "--chdir",
    "--command-timeout",
    "--role",
    "--type",
  ]);
  const flagShortOptions = new Set(["-A", "-b", "-E", "-H", "-k", "-K", "-n", "-S", "-s"]);
  const flagLongOptions = new Set([
    "--askpass",
    "--background",
    "--preserve-env",
    "--set-home",
    "--remove-timestamp",
    "--non-interactive",
    "--stdin",
    "--shell",
  ]);
  const terminalOptions = new Set([
    "-V",
    "-v",
    "-l",
    "--version",
    "--validate",
    "--list",
    "--help",
  ]);
  let index = 1;

  while (index < tokens.length) {
    const token = tokens[index];
    const lowerToken = token.toLowerCase();
    if (lowerToken === "--") return tokens.slice(index + 1);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
      index += 1;
      continue;
    }
    if (terminalOptions.has(token) || terminalOptions.has(lowerToken)) return [];
    if (valueShortOptions.has(token) || valueLongOptions.has(lowerToken)) {
      index += 2;
      continue;
    }
    if (
      [...valueLongOptions].some((option) => lowerToken.startsWith(option + "=")) ||
      /^-(?:u|g|h|p|C|R|D|T|r|t).+/.test(token) ||
      lowerToken.startsWith("--preserve-env=")
    ) {
      index += 1;
      continue;
    }
    if (flagShortOptions.has(token) || flagLongOptions.has(lowerToken)) {
      index += 1;
      continue;
    }
    if (lowerToken.startsWith("-")) return [];
    return tokens.slice(index);
  }

  return [];
}

function staticWrapperPayloads(candidate) {
  const tokens = tokenizeShellCandidate(candidate);
  const executable = executableBasename(tokens[0]);
  if (executable === "env") {
    const usesSplitString = tokens.some(
      (token) =>
        token.toLowerCase() === "-s" ||
        token.toLowerCase() === "--split-string" ||
        token.toLowerCase().startsWith("--split-string=")
    );
    const unwrapped = unwrapEnvTokens(tokens);
    return unwrapped.length > 0
      ? [usesSplitString ? unwrapped.join(" ") : serializeShellTokens(unwrapped)]
      : [];
  }
  if (executable === "command") {
    const unwrapped = unwrapCommandTokens(tokens);
    return unwrapped.length > 0 ? [serializeShellTokens(unwrapped)] : [];
  }
  if (executable === "sudo") {
    const unwrapped = unwrapSudoTokens(tokens);
    return unwrapped.length > 0 ? [serializeShellTokens(unwrapped)] : [];
  }
  if (executable === "eval") {
    return tokens.length > 1 ? [tokens.slice(1).join(" ")] : [];
  }

  const shellWrappers = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
  if (shellWrappers.has(executable)) {
    const commandOptionIndex = tokens.findIndex(
      (token, index) => index > 0 && /^-[^-]*c/.test(token.toLowerCase())
    );
    return commandOptionIndex >= 0 && commandOptionIndex + 1 < tokens.length
      ? [tokens.slice(commandOptionIndex + 1).join(" ")]
      : [];
  }

  if (new Set(["pwsh", "powershell", "powershell.exe"]).has(executable)) {
    const commandOptionIndex = tokens.findIndex(
      (token, index) =>
        index > 0 && new Set(["-c", "-command", "/command"]).has(token.toLowerCase())
    );
    return commandOptionIndex >= 0 && commandOptionIndex + 1 < tokens.length
      ? [tokens.slice(commandOptionIndex + 1).join(" ")]
      : [];
  }

  if (executable === "cmd" || executable === "cmd.exe") {
    const commandOptionIndex = tokens.findIndex(
      (token, index) => index > 0 && new Set(["/c", "/k"]).has(token.toLowerCase())
    );
    return commandOptionIndex >= 0 && commandOptionIndex + 1 < tokens.length
      ? [tokens.slice(commandOptionIndex + 1).join(" ")]
      : [];
  }

  return [];
}

function shellCommandCandidates(command, depth = 0) {
  const directCandidates = splitShellCommandSegments(command)
    .map(normalizeShellCommandCandidate)
    .filter(Boolean);
  const candidates = [...directCandidates];

  if (depth < 4) {
    for (const candidate of directCandidates) {
      for (const payload of staticWrapperPayloads(candidate)) {
        candidates.push(...shellCommandCandidates(payload, depth + 1));
      }
    }
  }

  return [...new Set(candidates)];
}

function isGitHubIssueShellCandidate(candidate) {
  const lowerCandidate = candidate.toLowerCase();
  const tokens = tokenizeShellCandidate(candidate);
  const executable = tokens[0];
  const lowerTokens = tokens.map((token) => token.toLowerCase());
  const mutatingActions = new Set([
    "create",
    "new",
    "close",
    "comment",
    "delete",
    "develop",
    "edit",
    "lock",
    "pin",
    "reopen",
    "transfer",
    "unlock",
    "unpin",
  ]);
  const optionsWithValues = new Set(["-r", "--repo", "--hostname"]);
  let namespaceIndex;

  if (isGitHubCliExecutable(executable) || executable === "g" || executable?.startsWith("$")) {
    let index = 1;
    while (index < lowerTokens.length) {
      const token = lowerTokens[index];
      if (token === "issue") {
        namespaceIndex = index;
        break;
      }
      if (optionsWithValues.has(token)) {
        index += 2;
        continue;
      }
      if (
        token.startsWith("--repo=") ||
        token.startsWith("--hostname=") ||
        (token.startsWith("-r") && token.length > 2)
      ) {
        index += 1;
        continue;
      }
      break;
    }
  }

  if (namespaceIndex !== undefined) {
    let actionIndex = namespaceIndex + 1;
    while (actionIndex < lowerTokens.length) {
      const token = lowerTokens[actionIndex];
      if (optionsWithValues.has(token)) {
        actionIndex += 2;
        continue;
      }
      if (
        token.startsWith("--repo=") ||
        token.startsWith("--hostname=") ||
        (token.startsWith("-r") && token.length > 2)
      ) {
        actionIndex += 1;
        continue;
      }
      break;
    }

    const issueAction = lowerTokens[actionIndex];
    if (mutatingActions.has(issueAction) || issueAction?.startsWith("$")) {
      return true;
    }
  }

  return (
    lowerCandidate.startsWith("$(") &&
    (lowerCandidate.includes(") issue create") || lowerCandidate.includes(") issue new"))
  );
}

function isSpecifyWorkflowRunCandidate(candidate) {
  const tokens = tokenizeShellCandidate(candidate).map((token) => token.toLowerCase());
  const executable = executableBasename(tokens[0]);
  return (
    (executable === "specify" || executable === "specify.exe") &&
    tokens[1] === "workflow" &&
    tokens[2] === "run"
  );
}

function isGitHubApiIssueWriteCandidate(candidate) {
  const lowerCandidate = candidate.toLowerCase();
  const tokens = tokenizeShellCandidate(candidate).map((token) => token.toLowerCase());
  if (
    !isGitHubCliExecutable(tokens[0]) ||
    tokens[1] !== "api" ||
    !lowerCandidate.includes("issue")
  ) {
    return false;
  }

  const writeMethods = new Set(["post", "put", "patch", "delete"]);
  const fieldFlags = new Set(["-f", "--field", "--raw-field", "--input"]);
  let explicitMethod;
  let hasFieldInput = false;
  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];
    if ((token === "--method" || token === "-x") && typeof nextToken === "string") {
      explicitMethod = nextToken.replace(/^=/, "");
      continue;
    }
    if (token.startsWith("--method=")) {
      explicitMethod = token.slice("--method=".length);
      continue;
    }
    if (token.startsWith("-x") && token.length > 2) {
      explicitMethod = token.slice(2).replace(/^=/, "");
      continue;
    }
    if (fieldFlags.has(token) || [...fieldFlags].some((flag) => token.startsWith(flag + "="))) {
      hasFieldInput = true;
    }
  }

  if (lowerCandidate.includes("mutation") || lowerCandidate.includes("createissue")) {
    return true;
  }
  if (typeof explicitMethod === "string") {
    return writeMethods.has(explicitMethod);
  }
  return hasFieldInput;
}

function canonicalizeWithMissingSuffix(candidate) {
  const missing = [];
  let ancestor = candidate;

  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) {
      fail("unable to resolve feature_directory");
    }
    missing.unshift(path.basename(ancestor));
    ancestor = parent;
  }

  return path.resolve(fs.realpathSync(ancestor), ...missing);
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  let event;
  try {
    event = JSON.parse(input);
  } catch (error) {
    fail("malformed JSON");
  }

  if (event?.hook_event_name !== "PreToolUse") {
    allow();
  }

  const command = event?.tool_input?.command ?? event?.tool_input?.cmd;
  const toolName = String(event?.tool_name ?? "");
  const isGitHubMcpIssueWrite =
    /github/i.test(toolName) && /(?:(?:create|write)_issue|issue_(?:create|write))/i.test(toolName);
  const shellCandidates = typeof command === "string" ? shellCommandCandidates(command) : [];
  const isRecognizableGitHubIssueShellCommand = shellCandidates.some(isGitHubIssueShellCandidate);
  const isRecognizableSpecifyWorkflowRun = shellCandidates.some(isSpecifyWorkflowRunCandidate);
  const isRecognizableGitHubApiIssueWrite = shellCandidates.some(isGitHubApiIssueWriteCandidate);

  if (isGitHubMcpIssueWrite) {
    const originRepository = resolveCurrentGitHubRepository();
    requireIssueAuthorization(originRepository);

    const toolInput = event?.tool_input;
    const requestedRepository =
      toolInput?.repository_full_name ??
      toolInput?.repo_full_name ??
      toolInput?.repository ??
      (typeof toolInput?.owner === "string" && typeof toolInput?.repo === "string"
        ? `${toolInput.owner}/${toolInput.repo}`
        : undefined);
    if (typeof requestedRepository !== "string" || requestedRepository.length === 0) {
      fail("GitHub MCP issue write requires an explicit repository target");
    }
    if (requestedRepository !== originRepository) {
      fail(`requested repository does not match origin; expected ${originRepository}`);
    }

    allow();
  }

  if (isRecognizableSpecifyWorkflowRun) {
    fail("bundled workflow is disabled; explicit Spec Kit skills are required");
  }

  if (
    typeof command === "string" &&
    command.includes(".specify/scripts/bash/") &&
    /\b(?:(?:export|env)\s+)?(?:SPECIFY_FEATURE_DIRECTORY|SPECIFY_INIT_DIR)\s*=/.test(command)
  ) {
    fail("inline SPECIFY_FEATURE_DIRECTORY or SPECIFY_INIT_DIR assignments are forbidden");
  }

  if (isRecognizableGitHubApiIssueWrite) {
    fail("gh api issue creation is forbidden");
  }

  if (isRecognizableGitHubIssueShellCommand && typeof command === "string") {
    const trimmedCommand = command.trim();
    const issueCreateOccurrences = trimmedCommand.match(/\bgh\s+issue\s+create\b/gi) ?? [];
    const isDirectIssueCreate = /^gh issue create(?:\s|$)/.test(trimmedCommand);
    const hasShellControl = /[;\r\n|<>`]|&&|\$\(/.test(trimmedCommand);
    const isRepeatedLoop =
      /^(?:for|while|until)\b/.test(trimmedCommand) && issueCreateOccurrences.length > 0;
    if (
      isRepeatedLoop ||
      (isDirectIssueCreate && (issueCreateOccurrences.length !== 1 || hasShellControl))
    ) {
      fail(
        "one issue per invocation; shell control, redirection, and substitution syntax is forbidden"
      );
    }

    if (isDirectIssueCreate) {
      const originRepository = resolveCurrentGitHubRepository();
      requireIssueAuthorization(originRepository);

      fail(
        "shell GitHub issue commands are disabled; use structured GitHub MCP with an explicit repository target"
      );
    }
  }

  if (isRecognizableGitHubIssueShellCommand) {
    fail(
      "shell GitHub issue commands are disabled; use structured GitHub MCP with an explicit repository target"
    );
  }

  if (typeof command !== "string" || !command.includes(".specify/scripts/bash/")) {
    allow();
  }

  let root;
  try {
    const reportedRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    root = fs.realpathSync(reportedRoot);
  } catch (error) {
    fail("unable to resolve the current repository");
  }

  const specifyFeatureDirectory = process.env.SPECIFY_FEATURE_DIRECTORY;
  if (typeof specifyFeatureDirectory === "string" && specifyFeatureDirectory.length > 0) {
    const requested = path.isAbsolute(specifyFeatureDirectory)
      ? specifyFeatureDirectory
      : path.resolve(root, specifyFeatureDirectory);
    const canonical = canonicalizeWithMissingSuffix(requested);

    if (canonical !== root && !canonical.startsWith(`${root}${path.sep}`)) {
      fail("SPECIFY_FEATURE_DIRECTORY is outside the current repository");
    }
  }

  const specifyInitDirectory = process.env.SPECIFY_INIT_DIR;
  if (typeof specifyInitDirectory === "string" && specifyInitDirectory.length > 0) {
    const requested = path.isAbsolute(specifyInitDirectory)
      ? specifyInitDirectory
      : path.resolve(process.cwd(), specifyInitDirectory);
    const canonical = canonicalizeWithMissingSuffix(requested);

    if (canonical !== root && !canonical.startsWith(`${root}${path.sep}`)) {
      fail("SPECIFY_INIT_DIR is outside the current repository");
    }
  }

  const featureFile = path.join(root, ".specify", "feature.json");
  if (!fs.existsSync(featureFile)) {
    allow();
  }

  let feature;
  try {
    feature = JSON.parse(fs.readFileSync(featureFile, "utf8"));
  } catch (error) {
    fail("malformed .specify/feature.json");
  }

  if (typeof feature?.feature_directory !== "string" || feature.feature_directory.length === 0) {
    allow();
  }

  const requested = path.isAbsolute(feature.feature_directory)
    ? feature.feature_directory
    : path.resolve(root, feature.feature_directory);
  const canonical = canonicalizeWithMissingSuffix(requested);

  if (canonical !== root && !canonical.startsWith(`${root}${path.sep}`)) {
    fail("feature_directory is outside the current repository");
  }

  allow();
});

process.stdin.resume();
