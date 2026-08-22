#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const CHILD_TIMEOUT_MS = 45_000;
const MAX_CAPTURED_OUTPUT_BYTES = 128 * 1024;
export const MAX_SUMMARY_LENGTH = 800;

const VALID_AGENTS = new Set(["codex", "kimi"]);
const VALID_MODES = new Set(["auto", "edit", "review"]);

export class DoctorUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "DoctorUsageError";
  }
}

export function parseDoctorArgs(argv) {
  const parsed = {
    agent: null,
    help: false,
    json: false,
    mode: "auto",
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json" || token === "--help") {
      if (seen.has(token)) throw new DoctorUsageError(`duplicate option ${token}`);
      seen.add(token);
      parsed[token.slice(2)] = true;
      continue;
    }
    if (token === "--mode" || token === "--agent") {
      if (seen.has(token)) throw new DoctorUsageError(`duplicate option ${token}`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new DoctorUsageError(`${token} requires a value`);
      }
      seen.add(token);
      parsed[token.slice(2)] = value;
      index += 1;
      continue;
    }
    if (token.startsWith("--")) throw new DoctorUsageError(`unknown option ${token}`);
    throw new DoctorUsageError(`unexpected argument ${token}`);
  }

  if (parsed.help) {
    if (argv.length !== 1) throw new DoctorUsageError("--help must be used on its own");
    return parsed;
  }
  if (!VALID_MODES.has(parsed.mode)) {
    throw new DoctorUsageError(`--mode must be one of: ${[...VALID_MODES].join(", ")}`);
  }
  if (parsed.agent !== null && !VALID_AGENTS.has(parsed.agent)) {
    throw new DoctorUsageError(`--agent must be one of: ${[...VALID_AGENTS].join(", ")}`);
  }
  if (parsed.mode === "edit" && parsed.agent === null) {
    throw new DoctorUsageError("--mode edit requires --agent codex or kimi");
  }
  if (parsed.mode === "review" && parsed.agent !== null) {
    throw new DoctorUsageError("--mode review does not accept --agent");
  }
  if (parsed.mode === "auto" && parsed.agent !== null) {
    throw new DoctorUsageError("--mode auto does not accept --agent");
  }
  return parsed;
}

export function resolveWorkspaceConfig({ agent = null, branch, mode = "auto" }) {
  if (mode === "review") {
    if (agent !== null) throw new DoctorUsageError("--mode review does not accept --agent");
    return { agent: null, branch: branch ?? null, mode: "review", source: "explicit" };
  }
  if (mode === "edit") {
    if (!VALID_AGENTS.has(agent)) {
      throw new DoctorUsageError("--mode edit requires --agent codex or kimi");
    }
    return { agent, branch: branch ?? null, mode: "edit", source: "explicit" };
  }
  if (mode !== "auto") {
    throw new DoctorUsageError(`--mode must be one of: ${[...VALID_MODES].join(", ")}`);
  }
  if (agent !== null) throw new DoctorUsageError("--mode auto does not accept --agent");
  if (branch === "main") {
    return { agent: null, branch, mode: "review", source: "automatic" };
  }
  if (typeof branch === "string" && branch.startsWith("codex/")) {
    return { agent: "codex", branch, mode: "edit", source: "automatic" };
  }
  if (typeof branch === "string" && branch.startsWith("kimi/")) {
    return { agent: "kimi", branch, mode: "edit", source: "automatic" };
  }
  throw new DoctorUsageError(
    "cannot select a workspace mode from this branch; use --mode review or --mode edit --agent codex|kimi"
  );
}

export function buildProbePlan(configuration, cwd = process.cwd()) {
  const nodeProbe = (id, args) => ({
    args,
    command: process.execPath,
    cwd,
    id,
    spawnOptions: {
      cwd,
      encoding: "utf8",
      maxBuffer: MAX_CAPTURED_OUTPUT_BYTES,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: CHILD_TIMEOUT_MS,
      windowsHide: true,
    },
  });
  const workspaceArgs = ["scripts/agent-workspace.mjs", "doctor", "--mode", configuration.mode];
  if (configuration.agent) workspaceArgs.push("--agent", configuration.agent);
  workspaceArgs.push("--json");

  return [
    nodeProbe("agent-context", ["scripts/check-agent-context.mjs"]),
    nodeProbe("agent-orchestra", ["scripts/sync-persistent-agent-orchestra.mjs", "--check"]),
    nodeProbe("agent-orchestra-eval", [
      "scripts/validate-persistent-agent-orchestra-eval-report.mjs",
      "--catalog",
    ]),
    nodeProbe("context-startup", [
      "tools/zenflow-context/server.mjs",
      "--cli",
      "--context",
      "startup",
      "--topic",
      "startup verification",
      "--max-chars",
      "5000",
    ]),
    nodeProbe("auto-context", ["tools/zenflow-context/auto-context.mjs", "--check"]),
    nodeProbe("workspace", workspaceArgs),
  ];
}

export function redactSummary(value) {
  const normalized = toText(value).replace(/\s+/g, " ").trim();
  const redacted = normalized
    .replace(/((?:https?|ssh):)\/\/[^@\s/]+@/gi, "$1//REDACTED@")
    .replace(/\b(?:ghp|github_pat|sbp|ctx7sk|sk)-?[A-Za-z0-9_-]{8,}\b/gi, "REDACTED_TOKEN")
    .replace(/Authorization:\s*Bearer\s+[^\s`'"]+/gi, "Authorization: Bearer REDACTED_TOKEN");
  return redacted.slice(0, MAX_SUMMARY_LENGTH);
}

export function runDoctor({ argv = process.argv.slice(2), branch, clock = () => performance.now(), execute } = {}) {
  let options;
  try {
    options = parseDoctorArgs(argv);
    if (options.help) return helpReport();

    const resolvedBranch = options.mode === "auto" ? branch ?? detectCurrentBranch() : branch ?? null;
    const configuration = resolveWorkspaceConfig({ ...options, branch: resolvedBranch });
    const probes = buildProbePlan(configuration);
    const results = probes.map((probe) => runProbe(probe, execute ?? executeProbe, clock));
    const status = results.every((result) => result.status === "GO") ? "GO" : "STOP";

    return {
      checks: results,
      configuration,
      errors: [],
      exitCode: status === "GO" ? 0 : 2,
      help: false,
      schemaVersion: 1,
      status,
    };
  } catch (error) {
    const message = redactSummary(error instanceof Error ? error.message : String(error));
    return {
      checks: [],
      configuration: null,
      errors: [message || "invalid doctor invocation"],
      exitCode: 2,
      help: false,
      schemaVersion: 1,
      status: "STOP",
    };
  }
}

export function formatDoctorReport(report) {
  if (report.help) return helpText();
  const configuration = report.configuration;
  const lines = [`${report.status}: agent doctor`];
  if (configuration) {
    const actor = configuration.agent ? ` agent=${configuration.agent}` : "";
    const branch = configuration.branch ? ` branch=${configuration.branch}` : "";
    lines.push(`workspace mode=${configuration.mode}${actor}${branch} source=${configuration.source}`);
  }
  for (const check of report.checks) {
    const exit = check.exitCode === null ? check.failureKind : `exit=${check.exitCode}`;
    lines.push(`${check.status} ${check.id} ${check.elapsedMs}ms ${exit}: ${check.summary}`);
  }
  for (const error of report.errors) lines.push(`STOP: ${error}`);
  return `${lines.join("\n")}\n`;
}

function detectCurrentBranch() {
  const result = spawnSync("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], {
    encoding: "utf8",
    maxBuffer: MAX_CAPTURED_OUTPUT_BYTES,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: CHILD_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const summary = redactSummary([result.error, result.stderr, result.stdout].filter(Boolean).join("\n"));
    throw new DoctorUsageError(summary || "cannot determine the current Git branch");
  }
  const branch = toText(result.stdout).trim();
  if (!branch) throw new DoctorUsageError("cannot determine the current Git branch");
  return branch;
}

function executeProbe(probe) {
  return spawnSync(probe.command, probe.args, probe.spawnOptions);
}

function runProbe(probe, execute, clock) {
  const startedAt = clock();
  let child;
  try {
    child = execute(probe) ?? {};
  } catch (error) {
    child = { error, signal: null, status: null, stderr: "", stdout: "" };
  }
  const elapsedMs = Math.max(0, Math.round(clock() - startedAt));
  const error = child.error ?? null;
  const exitCode = typeof child.status === "number" ? child.status : null;

  if (!error && exitCode === 0) {
    return {
      elapsedMs,
      exitCode: 0,
      failureKind: null,
      id: probe.id,
      status: "GO",
      summary: "exit 0",
    };
  }

  const failureKind = error?.code === "ETIMEDOUT" ? "timeout" : error ? "spawn-error" : child.signal ? "signal" : "exit";
  const summary = safeFailureSummary(child, error);
  return {
    elapsedMs,
    exitCode,
    failureKind,
    id: probe.id,
    status: "STOP",
    summary: summary || defaultFailureSummary(failureKind, exitCode, child.signal),
  };
}

function defaultFailureSummary(failureKind, exitCode, signal) {
  if (failureKind === "signal") return `process ended with signal ${signal}`;
  if (failureKind === "timeout") return "process timed out";
  if (failureKind === "spawn-error") return "process could not start";
  return `process exited with code ${exitCode ?? "unknown"}`;
}

function safeFailureSummary(child, error) {
  const candidates = [
    structuredErrorSummary(child.stderr),
    structuredErrorSummary(child.stdout),
    lastNonEmptyLine(child.stderr),
    error instanceof Error ? error.message : toText(error),
    lastNonEmptyLine(child.stdout),
  ];
  return redactSummary(candidates.find((candidate) => toText(candidate).trim()) ?? "");
}

function structuredErrorSummary(value) {
  const raw = toText(value).trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
    if (Array.isArray(parsed.errors)) {
      const errors = parsed.errors.filter((entry) => typeof entry === "string" && entry.trim());
      if (errors.length > 0) return errors.join("; ");
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
  } catch {
    return "";
  }
  return "";
}

function lastNonEmptyLine(value) {
  return toText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) ?? "";
}

function helpReport() {
  return {
    checks: [],
    configuration: null,
    errors: [],
    exitCode: 0,
    help: true,
    schemaVersion: 1,
    status: "GO",
  };
}

function helpText() {
  return [
    "ZenFlow agent doctor",
    "",
    "Usage:",
    "  npm run doctor:agent",
    "  npm run doctor:agent -- --mode review",
    "  npm run doctor:agent -- --mode edit --agent codex|kimi",
    "  npm run doctor:agent -- --json",
    "",
    "The command runs bounded read-only agent-health diagnostics and never repairs or synchronizes a workspace.",
    "",
  ].join("\n");
}

function toText(value) {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function main() {
  const report = runDoctor();
  const output = report.help
    ? formatDoctorReport(report)
    : process.argv.includes("--json")
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatDoctorReport(report);
  process.stdout.write(output);
  process.exitCode = report.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
