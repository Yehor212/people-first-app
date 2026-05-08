#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const watchedArtifactDirs = [
  "android",
  "coverage",
  "dist",
  "docs",
  "output",
  "public",
  "screenshots",
  "tmp",
  ".claude",
  ".codex-artifacts",
  ".swarm",
];

function toMb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function directorySize(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  const result = {
    name: relativeDir,
    exists: fs.existsSync(absoluteDir),
    files: 0,
    dirs: 0,
    sizeMB: 0,
  };

  if (!result.exists) return result;

  const stack = [absoluteDir];
  let bytes = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);

      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        result.dirs += 1;
        stack.push(entryPath);
        continue;
      }

      if (!entry.isFile()) continue;

      try {
        bytes += fs.statSync(entryPath).size;
        result.files += 1;
      } catch {
        // Keep the diagnostic best-effort; inaccessible temp files should not fail the run.
      }
    }
  }

  result.sizeMB = toMb(bytes);
  return result;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });

  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function powershell(command) {
  return run("powershell", ["-NoProfile", "-Command", command]);
}

function processSnapshot() {
  if (process.platform === "win32") {
    const result = powershell(
      "Get-Process | " +
        "Where-Object { $_.ProcessName -match 'node|Code|Codex|cloudcode|chrome|msedge|msedgewebview' } | " +
        "Sort-Object WorkingSet64 -Descending | " +
        "Select-Object -First 20 Id,ProcessName,@{Name='MemoryMB';Expression={[math]::Round($_.WorkingSet64/1MB,1)}},CPU | " +
        "ConvertTo-Json -Compress",
    );
    return result.stdout || result.stderr;
  }

  const result = run("ps", ["-axo", "pid,comm,rss,pcpu"]);
  return result.stdout
    .split("\n")
    .filter((line) => /node|code|codex|chrome|msedge/i.test(line))
    .slice(0, 20)
    .join("\n");
}

function localPortSnapshot(port) {
  if (process.platform !== "win32") {
    return run("sh", ["-lc", `lsof -nP -iTCP:${port} -sTCP:LISTEN,ESTABLISHED || true`]).stdout;
  }

  const result = powershell(
    `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ` +
      "Select-Object LocalAddress,LocalPort,State,OwningProcess | " +
      "Sort-Object OwningProcess -Unique | ConvertTo-Json -Compress",
  );
  return result.stdout || result.stderr;
}

const report = {
  generatedAt: new Date().toISOString(),
  cwd: root,
  platform: `${os.platform()} ${os.release()}`,
  node: process.version,
  localPort8080: localPortSnapshot(8080),
  relevantProcesses: processSnapshot(),
  watcherSensitiveDirs: watchedArtifactDirs.map(directorySize),
};

console.log(JSON.stringify(report, null, 2));
