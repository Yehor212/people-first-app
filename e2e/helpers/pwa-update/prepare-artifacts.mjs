import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const distRoot = resolve(repoRoot, "dist");
const artifactRoot = resolve(repoRoot, "output/playwright/pwa-update/artifacts");
const versions = [
  { label: "a", buildTime: 1_460_000_001_001 },
  { label: "b", buildTime: 1_460_000_001_002 },
];
const requiredFiles = ["index.html", "manifest.webmanifest", "registerSW.js", "sw.js", "version.json"];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runProductionBuild(buildTime) {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmExecutable, ["run", "build"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CAPACITOR_BUILD: "false",
      VITE_APP_BUILD_TIME: String(buildTime),
    },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`T146 PWA build ${buildTime} failed with exit ${String(result.status)}`);
  }
}

mkdirSync(artifactRoot, { recursive: true });
const manifest = { schemaVersion: 1, task: "T146", artifacts: {} };

for (const version of versions) {
  runProductionBuild(version.buildTime);
  for (const file of requiredFiles) {
    if (!existsSync(resolve(distRoot, file))) {
      throw new Error(`T146 PWA build ${version.label} is missing ${file}`);
    }
  }
  const versionRecord = JSON.parse(readFileSync(resolve(distRoot, "version.json"), "utf8"));
  if (versionRecord.buildTime !== version.buildTime) {
    throw new Error(`T146 PWA build ${version.label} did not retain its requested buildTime`);
  }
  const destination = resolve(artifactRoot, `version-${version.label}`);
  rmSync(destination, { recursive: true, force: true });
  cpSync(distRoot, destination, { recursive: true });
  manifest.artifacts[version.label] = {
    buildTime: version.buildTime,
    indexSha256: sha256(resolve(destination, "index.html")),
    serviceWorkerSha256: sha256(resolve(destination, "sw.js")),
    versionSha256: sha256(resolve(destination, "version.json")),
  };
}

if (manifest.artifacts.a.serviceWorkerSha256 === manifest.artifacts.b.serviceWorkerSha256) {
  throw new Error("T146 requires two distinct production service-worker artifacts");
}
if (manifest.artifacts.a.indexSha256 === manifest.artifacts.b.indexSha256) {
  throw new Error("T146 requires two distinct production application shells");
}

writeFileSync(
  resolve(artifactRoot, "artifact-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(manifest)}\n`);
