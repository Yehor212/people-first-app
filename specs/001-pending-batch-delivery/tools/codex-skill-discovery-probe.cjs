#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");

const EXPECTED_SKILLS = [
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

const cwd = process.cwd();
const child = spawn("codex", ["app-server", "--stdio"], {
  cwd,
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
});

let stdoutBuffer = "";
let stderrBytes = 0;
let finished = false;

const timeout = setTimeout(() => {
  finish(7, { probe: "FAIL", stage: "timeout", stderr_bytes: stderrBytes });
}, 20_000);

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function finish(code, payload) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 50);
}

function handleMessage(message) {
  if (message.id === 1) {
    if (message.error) {
      finish(2, {
        probe: "FAIL",
        stage: "initialize",
        error_code: message.error.code,
        stderr_bytes: stderrBytes,
      });
      return;
    }

    send({ jsonrpc: "2.0", method: "initialized" });
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "skills/list",
      params: { cwds: [cwd], forceReload: true },
    });
    return;
  }

  if (message.id !== 2) return;

  if (message.error) {
    finish(3, {
      probe: "FAIL",
      stage: "skills/list",
      error_code: message.error.code,
      stderr_bytes: stderrBytes,
    });
    return;
  }

  const entries = Array.isArray(message.result?.data) ? message.result.data : [];
  const entry = entries.find((candidate) => candidate.cwd === cwd) || entries[0];
  const skills = Array.isArray(entry?.skills) ? entry.skills : [];
  const specKitSkills = skills
    .filter((skill) => typeof skill.name === "string" && skill.name.startsWith("speckit-"))
    .map((skill) => ({
      name: skill.name,
      enabled: skill.enabled,
      scope: skill.scope,
      path: skill.path,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const errors = Array.isArray(entry?.errors)
    ? entry.errors.map((error) => ({ path: error.path, message: error.message }))
    : [];
  const discoveredNames = new Set(specKitSkills.map((skill) => skill.name));
  const missing = EXPECTED_SKILLS.filter((name) => !discoveredNames.has(name));
  const unexpected = specKitSkills
    .map((skill) => skill.name)
    .filter((name) => !EXPECTED_SKILLS.includes(name));
  const disabled = specKitSkills.filter((skill) => !skill.enabled).map((skill) => skill.name);
  const wrongScope = specKitSkills
    .filter((skill) => skill.scope !== "repo")
    .map((skill) => skill.name);
  const wrongRoot = specKitSkills
    .filter((skill) => !skill.path.startsWith(`${cwd}/.agents/skills/speckit-`))
    .map((skill) => skill.name);
  const failed =
    missing.length > 0 ||
    unexpected.length > 0 ||
    disabled.length > 0 ||
    wrongScope.length > 0 ||
    wrongRoot.length > 0 ||
    errors.length > 0;

  finish(failed ? 4 : 0, {
    probe: failed ? "FAIL" : "PASS",
    method: "skills/list",
    cwd,
    force_reload: true,
    discovered_count: specKitSkills.length,
    skills: specKitSkills,
    missing,
    unexpected,
    disabled,
    wrong_scope: wrongScope,
    wrong_root: wrongRoot,
    errors,
  });
}

child.stderr.on("data", (chunk) => {
  stderrBytes += chunk.length;
});

child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk.toString("utf8");
  while (true) {
    const newlineIndex = stdoutBuffer.indexOf("\n");
    if (newlineIndex < 0) break;
    const line = stdoutBuffer.slice(0, newlineIndex).trim();
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
    if (!line) continue;
    try {
      handleMessage(JSON.parse(line));
    } catch {
      // App-server diagnostic lines are ignored; JSON-RPC responses drive the probe.
    }
  }
});

child.on("error", () => {
  finish(5, { probe: "FAIL", stage: "spawn", stderr_bytes: stderrBytes });
});

child.on("exit", (code) => {
  if (!finished) {
    finish(6, {
      probe: "FAIL",
      stage: "early-exit",
      child_exit_code: code,
      stderr_bytes: stderrBytes,
    });
  }
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    clientInfo: { name: "zenflow-spec-kit-probe", version: "1.0.0" },
    capabilities: { experimentalApi: true },
  },
});
