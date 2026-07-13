"use strict";

const path = require("node:path");

const WRITE_TOOL_PATTERN = /(?:^|\.)(?:apply_patch|edit|write|multiedit)$/i;
const SHELL_TOOL_PATTERN = /(?:^|\.)(?:bash|shell|exec_command|unified_exec|exec)$/i;
const SPECIAL_OUTPUTS = new Set([
  "/dev/null",
  "/dev/stdout",
  "/dev/stderr",
  "nul",
  "&1",
  "&2",
]);

function analyzeToolEvent(event) {
  const input = event && typeof event.tool_input === "object" && event.tool_input !== null
    ? event.tool_input
    : {};
  const toolName = String(event?.tool_name || event?.tool || event?.matcher || "");
  const writeLikeTool = WRITE_TOOL_PATTERN.test(toolName);
  const shellTool = SHELL_TOOL_PATTERN.test(toolName);
  const directTargets = [input.file_path, input.path, input.target_path, input.filename]
    .filter(isNonEmptyString);
  const patchTexts = [input.patch, input.input, event?.patch].filter(isNonEmptyString);
  if (writeLikeTool && isNonEmptyString(input.command)) patchTexts.push(input.command);
  const patchTargets = patchTexts.flatMap(extractPatchPaths);
  const command = [input.command, input.cmd].filter(isNonEmptyString).join("\n");
  const shell = shellTool
    ? analyzeShellCommand(command)
    : { mutationIntent: false, targets: [], recognizedCommands: [] };

  return {
    command,
    mutationIntent: writeLikeTool || shell.mutationIntent,
    patchTargets,
    shellMutation: shell.mutationIntent,
    targets: unique([...directTargets, ...patchTargets, ...shell.targets]),
    toolName,
    writeLikeTool,
    recognizedCommands: shell.recognizedCommands,
  };
}

function extractPatchPaths(text) {
  const targets = [];
  for (const match of String(text || "").matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) {
    targets.push(match[1].trim());
  }
  for (const match of String(text || "").matchAll(/^\+\+\+ (?:b\/)?(.+)$/gm)) {
    if (match[1].trim() !== "/dev/null") targets.push(match[1].trim());
  }
  return unique(targets);
}

function analyzeShellCommand(command) {
  const text = String(command || "");
  if (!text.trim()) return { mutationIntent: false, targets: [], recognizedCommands: [] };
  const targets = extractOutputRedirections(text);
  const recognizedCommands = [];
  let mutationIntent = targets.length > 0;

  for (const statement of splitStatements(text)) {
    const tokens = tokenizeWords(stripShellGrouping(statement));
    if (tokens.length === 0) continue;
    const result = analyzeStatement(tokens);
    if (!result) continue;
    mutationIntent = true;
    recognizedCommands.push(result.command);
    targets.push(...result.targets);
  }

  return {
    mutationIntent,
    targets: unique(targets.map(normalizeShellTarget).filter(Boolean)),
    recognizedCommands: unique(recognizedCommands),
  };
}

function analyzeStatement(tokens) {
  let commandIndex = 0;
  while (
    commandIndex < tokens.length &&
    (/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(tokens[commandIndex]) ||
      ["command", "env", "sudo", "doas", "nohup"].includes(baseCommand(tokens[commandIndex])))
  ) {
    commandIndex += 1;
  }
  while (
    commandIndex < tokens.length &&
    ["then", "do", "else", "elif", "time"].includes(baseCommand(tokens[commandIndex]))
  ) {
    commandIndex += 1;
  }
  if (commandIndex >= tokens.length) return null;
  const command = baseCommand(tokens[commandIndex]);
  const args = tokens.slice(commandIndex + 1);

  if (["bash", "sh", "zsh"].includes(command)) {
    const commandFlag = args.findIndex((arg) => arg === "-c" || arg === "-lc");
    if (commandFlag >= 0 && args[commandFlag + 1]) {
      const nested = analyzeShellCommand(args[commandFlag + 1]);
      return nested.mutationIntent
        ? { command: `${command} -c`, targets: nested.targets.length > 0 ? nested.targets : ["."] }
        : null;
    }
    return null;
  }

  if (["node", "nodejs", "bun", "deno", "python", "python3", "py", "ruby", "perl", "php"].includes(command)) {
    return analyzeInlineProgram(command, args);
  }

  if (command === "rm") return mutationResult(command, positional(args));
  if (["touch", "mkdir", "truncate", "tee"].includes(command)) {
    return mutationResult(command, positional(args));
  }
  if (["mv", "cp", "install", "ln", "rsync"].includes(command)) {
    const targetDirectory = optionValue(args, "-t", "--target-directory");
    if (targetDirectory) return mutationResult(command, [targetDirectory]);
    const values = positional(args);
    return mutationResult(command, values.length > 0 ? [values.at(-1)] : []);
  }
  if (["chmod", "chown", "chgrp"].includes(command)) {
    const values = positional(args);
    return mutationResult(command, values.length > 1 ? values.slice(1) : []);
  }
  if (command === "dd") {
    const output = args.find((arg) => arg.startsWith("of="));
    return mutationResult(command, output ? [output.slice(3)] : []);
  }
  if (command === "find") {
    if (args.includes("-delete")) return mutationResult(command, positional(args).slice(0, 1));
    const execIndex = args.findIndex((arg) => arg === "-exec" || arg === "-execdir");
    if (execIndex >= 0) {
      const nestedTokens = args.slice(execIndex + 1).filter((arg) => arg !== ";" && arg !== "+" && arg !== "\\");
      const nested = analyzeStatement(nestedTokens);
      if (nested) return { command: `find ${args[execIndex]}`, targets: nested.targets };
    }
  }
  if (["sed", "perl"].includes(command) && args.some((arg) => /^-.*i/.test(arg))) {
    const values = positional(args);
    return mutationResult(command, values.length > 1 ? [values.at(-1)] : []);
  }
  if (command === "git") return analyzeGit(args);
  if (["npm", "pnpm", "yarn", "bun"].includes(command)) {
    const operation = args.find((arg) => !arg.startsWith("-"));
    if (["add", "install", "remove", "uninstall", "update", "upgrade"].includes(operation)) {
      return mutationResult(`${command} ${operation}`, ["package.json"]);
    }
  }
  return null;
}

function analyzeGit(args) {
  const normalizedArgs = stripGitGlobalOptions(args);
  const operationIndex = normalizedArgs.findIndex((arg) => !arg.startsWith("-"));
  if (operationIndex < 0) return null;
  const operation = normalizedArgs[operationIndex];
  const rest = normalizedArgs.slice(operationIndex + 1);
  if (["reset", "clean", "switch", "pull", "merge", "rebase", "cherry-pick", "revert", "am"].includes(operation)) {
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
  return null;
}

function mutationResult(command, targets) {
  const normalized = targets.map(normalizeShellTarget).filter(Boolean);
  return { command, targets: normalized.length > 0 ? normalized : ["."] };
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
    const targetQuote = input[cursor] === "'" || input[cursor] === '"' ? input[cursor] : null;
    if (targetQuote) cursor += 1;
    while (cursor < input.length) {
      const candidate = input[cursor];
      if (targetQuote ? candidate === targetQuote : /[\s;&|]/.test(candidate)) break;
      target += candidate;
      cursor += 1;
    }
    const normalized = normalizeShellTarget(target);
    if (normalized) targets.push(normalized);
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
  const flag = command.startsWith("python") || command === "py"
    ? "-c"
    : command === "php"
      ? "-r"
      : "-e";
  const flagIndex = args.findIndex((arg) => arg === flag || arg === "--eval");
  if (flagIndex < 0 || !args[flagIndex + 1]) return null;
  const program = args[flagIndex + 1];
  const mutationPattern = /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|truncate(?:Sync)?|unlink(?:Sync)?|rm(?:Sync)?|rename(?:Sync)?|copyFile(?:Sync)?|mkdir(?:Sync)?|chmod(?:Sync)?|chown(?:Sync)?|createWriteStream|write_text|write_bytes|unlink|remove|rmdir|rename|replace|copy|copy2|move|File\.(?:write|delete|rename)|exec(?:File)?Sync|spawnSync|system)\b/i;
  if (!mutationPattern.test(program) && !/\bopen\s*\([^)]*,\s*['"][wax+]/i.test(program)) return null;
  const targets = [];
  for (const match of program.matchAll(/['"]([^'"\r\n]+)['"]/g)) {
    const candidate = match[1];
    if (/^(?:fs|node:fs|child_process|node:child_process|w|a|x|r\+|w\+|a\+)$/.test(candidate)) continue;
    if (/[\\/]|\.[A-Za-z0-9_-]{1,12}$|^[A-Z][A-Z0-9_.-]+\.md$/i.test(candidate)) targets.push(candidate);
  }
  return mutationResult(`${command} inline`, targets);
}

function stripGitGlobalOptions(args) {
  const result = [];
  const consumesValue = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env", "--super-prefix"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (result.length === 0 && consumesValue.has(arg)) {
      index += 1;
      continue;
    }
    if (result.length === 0 && /^(?:-C|--git-dir=|--work-tree=|--namespace=|--config-env=|--super-prefix=)/.test(arg)) continue;
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

function splitStatements(text) {
  return String(text)
    .split(/\r?\n|;|&&|\|\||(?<!\|)\|(?!\|)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
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

function normalizeShellTarget(value) {
  const target = String(value || "").trim().replace(/^['"]|['"]$/g, "");
  if (!target) return "";
  if (SPECIAL_OUTPUTS.has(target.toLowerCase())) return "";
  if (/[$*?\[\]{}()`]/.test(target)) return ".";
  return target;
}

function baseCommand(value) {
  return path.posix.basename(String(value || "").replace(/\\/g, "/")).toLowerCase();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values) {
  return [...new Set(values.filter(isNonEmptyString))];
}

module.exports = {
  analyzeShellCommand,
  analyzeToolEvent,
  extractPatchPaths,
};
