#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..").toLowerCase();
const keepPorts = new Set(
  (process.env.ZENFLOW_KEEP_PORTS || "8080")
    .split(",")
    .map((port) => port.trim())
    .filter(Boolean),
);
const shouldKill = process.argv.includes("--kill");

function runPowerShell(command) {
  const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `PowerShell exited with ${result.status}`);
  }

  return result.stdout.trim();
}

function parseProcesses() {
  if (process.platform !== "win32") {
    throw new Error("cleanup:dev-processes currently supports Windows only.");
  }

  const output = runPowerShell(
    "Get-CimInstance Win32_Process | " +
      "Where-Object { $_.Name -match 'node' } | " +
      "Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress",
  );

  if (!output) return [];

  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function extractPort(commandLine) {
  const match = commandLine.match(/--port\s+(\d+)/i) || commandLine.match(/\s(\d{4,5})\s*$/);
  return match ? match[1] : "";
}

function classify(processInfo) {
  const commandLine = String(processInfo.CommandLine || "");
  const normalizedCommand = commandLine.toLowerCase();
  const isProjectProcess = normalizedCommand.includes(root);
  const isViteServer =
    normalizedCommand.includes("vite.js") &&
    (normalizedCommand.includes(" preview ") || normalizedCommand.includes(" run preview ") ||
      normalizedCommand.includes(" run dev ") || normalizedCommand.includes(" vite.js\" --host ") ||
      normalizedCommand.includes(" vite.js\" preview "));
  const isRecoveryPreview = normalizedCommand.includes(".codex-recovery-preview-server.cjs");

  if (!isProjectProcess && !isRecoveryPreview) return null;
  if (!isViteServer && !isRecoveryPreview) return null;

  const port = extractPort(commandLine);
  if (keepPorts.has(port)) return null;

  return {
    pid: processInfo.ProcessId,
    name: processInfo.Name,
    port,
    kind: isRecoveryPreview ? "recovery-preview" : "vite",
    commandLine,
  };
}

const candidates = parseProcesses().map(classify).filter(Boolean);

if (candidates.length === 0) {
  console.log(
    JSON.stringify(
      {
        mode: shouldKill ? "kill" : "dry-run",
        keepPorts: [...keepPorts],
        candidates: [],
        message: "No stale ZenFlow dev/preview processes found.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const killed = [];
const failed = [];

if (shouldKill) {
  for (const candidate of candidates) {
    const result = spawnSync("powershell", ["-NoProfile", "-Command", `Stop-Process -Id ${candidate.pid}`], {
      encoding: "utf8",
      windowsHide: true,
    });

    if (result.status === 0) {
      killed.push(candidate);
    } else {
      failed.push({
        ...candidate,
        error: result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`,
      });
    }
  }
}

console.log(
  JSON.stringify(
    {
      mode: shouldKill ? "kill" : "dry-run",
      keepPorts: [...keepPorts],
      candidates,
      killed,
      failed,
      nextStep: shouldKill
        ? "Run npm run diagnose:dev-performance to confirm memory/process pressure dropped."
        : "Run npm run cleanup:dev-processes -- --kill to stop these stale servers.",
    },
    null,
    2,
  ),
);

if (failed.length > 0) {
  process.exit(1);
}
