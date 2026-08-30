#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[a-zA-Z0-9._:-]{1,120}$/;
const STATUS_PRIORITY = new Map([
  ["FAIL", 4],
  ["PASS", 3],
  ["BLOCKED", 2],
  ["UNVERIFIED", 1],
  ["NOT_APPLICABLE", 0],
]);
const TRANSITION_CLASSES = new Set([
  "none",
  "press",
  "route",
  "drawer",
  "sheet",
  "modal",
  "theme",
  "ime",
  "system",
]);

function fail(message) {
  throw new Error(`Android control manifest: ${message}`);
}

function round6(value) {
  return Number(value.toFixed(6));
}

function roleFor(node) {
  if (node.className?.endsWith("SeekBar")) return "slider";
  if (node.className?.endsWith("RadioButton")) return "radio";
  if (node.className?.endsWith("ToggleButton")) return "switch";
  return "button";
}

function interactionFor(role) {
  if (role === "slider") return "drag";
  if (role === "switch") return "toggle";
  return "tap";
}

function transitionFor(route, label) {
  const normalized = `${route} ${label}`.toLowerCase();
  if (/open menu|close menu|global-drawer/.test(normalized)) return "drawer";
  if (/dark theme|light theme|theme/.test(normalized)) return "theme";
  if (/^global-drawer (mood|habits|diary|planning|settings)$/.test(normalized)) {
    return "route";
  }
  return "press";
}

function controlIdFor(route, node) {
  const role = roleFor(node);
  const identity = node.resourceId || node.contentDescription || node.label || node.text;
  if (typeof identity !== "string" || identity.trim().length === 0) {
    fail(`clickable node in ${route} has no semantic identity`);
  }
  const digest = createHash("sha256")
    .update(`${route}\0${role}\0${identity.trim()}`)
    .digest("hex")
    .slice(0, 16);
  const routeToken = route.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${routeToken || "state"}:${role}:${digest}`;
}

function mapStatus(status) {
  if (status === "N/A") return "NOT_APPLICABLE";
  if (STATUS_PRIORITY.has(status)) return status;
  fail(`unsupported inventory status ${status}`);
}

function mergeStatus(left, right) {
  return STATUS_PRIORITY.get(left) >= STATUS_PRIORITY.get(right) ? left : right;
}

function assertBounds(bounds, label) {
  if (
    !bounds ||
    ![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite) ||
    bounds.right <= bounds.left ||
    bounds.bottom <= bounds.top
  ) {
    fail(`${label} bounds are invalid`);
  }
}

export function summarizeControlCoverage(controls) {
  const ids = new Set();
  let duplicateControlIds = 0;
  for (const control of controls) {
    if (ids.has(control.controlId)) duplicateControlIds += 1;
    ids.add(control.controlId);
  }
  const mandatory = controls.filter((control) => control.mandatory);
  const exercisedPass = mandatory.filter((control) => control.status === "PASS").length;
  return {
    discovered: controls.length,
    duplicateControlIds,
    exercisedPass,
    mandatoryBlocked: mandatory.filter((control) => control.status === "BLOCKED").length,
    mandatoryDiscovered: mandatory.length,
    mandatoryFail: mandatory.filter((control) => control.status === "FAIL").length,
    mandatoryUnverified: mandatory.filter((control) => control.status === "UNVERIFIED").length,
    notApplicable: controls.filter((control) => control.status === "NOT_APPLICABLE").length,
    percent: mandatory.length === 0 ? 0 : round6((100 * exercisedPass) / mandatory.length),
  };
}

export function buildControlManifest({
  artifactSha256,
  generatedAt = new Date().toISOString(),
  inventories,
  locale,
  motion,
  runId,
  scenario,
  sourceJourney,
}) {
  if (!SHA256.test(artifactSha256 ?? "")) fail("artifactSha256 is invalid");
  if (!Array.isArray(inventories) || inventories.length === 0) {
    fail("at least one clickable-node inventory is required");
  }
  for (const [label, value] of [["locale", locale], ["motion", motion], ["runId", runId], ["scenario", scenario]]) {
    if (typeof value !== "string" || !SAFE_ID.test(value)) fail(`${label} is invalid`);
  }
  if (
    !sourceJourney ||
    typeof sourceJourney.path !== "string" ||
    !Number.isInteger(sourceJourney.bytes) ||
    sourceJourney.bytes < 0 ||
    !SHA256.test(sourceJourney.sha256 ?? "")
  ) {
    fail("sourceJourney artifact is invalid");
  }
  if (Number.isNaN(Date.parse(generatedAt))) fail("generatedAt is invalid");

  const byId = new Map();
  for (const inventory of inventories) {
    if (typeof inventory?.route !== "string" || inventory.route.length === 0) {
      fail("inventory route is required");
    }
    if (!Array.isArray(inventory.nodes)) fail(`inventory ${inventory.route} nodes are required`);
    for (const node of inventory.nodes) {
      assertBounds(node.bounds, node.label || inventory.route);
      const controlId = controlIdFor(inventory.route, node);
      const status = mapStatus(node.status);
      const role = roleFor(node);
      const existing = byId.get(controlId);
      const exercisedRunIds = status === "PASS" ? [runId] : [];
      const row = {
        controlId,
        route: inventory.route.split("-", 1)[0] || "global",
        state: inventory.route,
        role,
        accessibleName: node.label,
        resourceId: node.resourceId || null,
        bounds: node.bounds,
        interaction: interactionFor(role),
        transitionClass: transitionFor(inventory.route, node.actionLabel || node.label),
        dataAuthority: "empty-state",
        mandatory: status !== "NOT_APPLICABLE",
        discoveredAt: generatedAt,
        exercisedRunIds,
        status,
        exclusionReason: status === "NOT_APPLICABLE" ? "inventory marked N/A" : null,
      };
      if (!existing) {
        byId.set(controlId, row);
        continue;
      }
      const mergedStatus = mergeStatus(existing.status, row.status);
      byId.set(controlId, {
        ...existing,
        bounds: row.bounds,
        status: mergedStatus,
        exercisedRunIds: [...new Set([...existing.exercisedRunIds, ...row.exercisedRunIds])],
      });
    }
  }
  const controls = [...byId.values()].sort((left, right) =>
    left.controlId.localeCompare(right.controlId),
  );
  const manifest = {
    schemaVersion: 1,
    generatedAt,
    artifactSha256,
    sourceJourney,
    runId,
    scenario,
    locale,
    motion,
    controls,
    coverage: summarizeControlCoverage(controls),
  };
  return validateControlManifest(manifest);
}

export function validateControlManifest(manifest, { requireComplete = false } = {}) {
  if (!manifest || manifest.schemaVersion !== 1) fail("schemaVersion 1 is required");
  if (!SHA256.test(manifest.artifactSha256 ?? "")) fail("artifactSha256 is invalid");
  if (!Array.isArray(manifest.controls)) fail("controls must be an array");
  const seen = new Set();
  for (const [index, control] of manifest.controls.entries()) {
    if (typeof control.controlId !== "string" || !SAFE_ID.test(control.controlId)) {
      fail(`controls[${index}] controlId is invalid`);
    }
    if (seen.has(control.controlId)) fail(`duplicate controlId ${control.controlId}`);
    seen.add(control.controlId);
    assertBounds(control.bounds, `controls[${index}]`);
    if (!STATUS_PRIORITY.has(control.status)) fail(`controls[${index}] status is invalid`);
    if (!TRANSITION_CLASSES.has(control.transitionClass)) {
      fail(`controls[${index}] transition classification is invalid`);
    }
    if (!Array.isArray(control.exercisedRunIds)) {
      fail(`controls[${index}] exercisedRunIds must be an array`);
    }
    if (control.status === "PASS" && control.exercisedRunIds.length === 0) {
      fail(`controls[${index}] PASS has no accepted run id`);
    }
    if (control.status === "NOT_APPLICABLE" && !control.exclusionReason) {
      fail(`controls[${index}] NOT_APPLICABLE needs an exclusion reason`);
    }
  }
  const coverage = summarizeControlCoverage(manifest.controls);
  if (JSON.stringify(coverage) !== JSON.stringify(manifest.coverage)) {
    fail("coverage summary does not match controls");
  }
  if (
    requireComplete &&
    (coverage.mandatoryDiscovered === 0 ||
      coverage.exercisedPass !== coverage.mandatoryDiscovered ||
      coverage.mandatoryBlocked !== 0 ||
      coverage.mandatoryFail !== 0 ||
      coverage.mandatoryUnverified !== 0 ||
      coverage.duplicateControlIds !== 0)
  ) {
    fail("mandatory control coverage is incomplete");
  }
  return manifest;
}

function valueFor(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

async function main() {
  const argv = process.argv.slice(2);
  const input = valueFor(argv, "--input");
  const output = valueFor(argv, "--output");
  const artifactSha256 = valueFor(argv, "--artifact-sha256");
  const runId = valueFor(argv, "--run-id");
  const locale = valueFor(argv, "--locale");
  const motion = valueFor(argv, "--motion");
  if (!input || !output || !artifactSha256 || !runId || !locale || !motion) {
    throw new Error("Usage: build-control-manifest.mjs --input <journey.json> --output <manifest.json> --artifact-sha256 <sha> --run-id <id> --locale <locale> --motion <mode>");
  }
  const root = process.cwd();
  const inputPath = path.resolve(root, input);
  const outputPath = path.resolve(root, output);
  const outputRelative = path.relative(root, outputPath);
  if (outputRelative.startsWith("..") || path.isAbsolute(outputRelative) || !outputRelative.startsWith("output/")) {
    fail("output must stay under repository output/");
  }
  try {
    await lstat(outputPath);
    fail(`output already exists: ${outputRelative}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const inputBytes = await readFile(inputPath);
  const journey = JSON.parse(inputBytes.toString("utf8"));
  const manifest = buildControlManifest({
    artifactSha256,
    inventories: journey.clickableNodeInventories,
    locale,
    motion,
    runId,
    scenario: journey.scenario,
    sourceJourney: {
      path: path.relative(root, inputPath).split(path.sep).join("/"),
      bytes: inputBytes.byteLength,
      sha256: createHash("sha256").update(inputBytes).digest("hex"),
    },
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(JSON.stringify({ output: outputRelative, coverage: manifest.coverage }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
