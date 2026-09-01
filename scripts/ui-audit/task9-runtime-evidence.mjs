import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";

export const TASK9_EXPECTED_CAPTURE_IDS = Object.freeze([
  "AFTER-09-02-settings-account-uk-ink-compact",
  "AFTER-09-03-settings-appearance-ar-paper-medium",
  "AFTER-09-05-settings-high-contrast-font-150",
  "AFTER-09-06-settings-privacy-en-paper",
]);

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function expectedLocalBaseURL(env) {
  const rawPort = String(env.ZENFLOW_PLAYWRIGHT_LOCAL_PORT ?? "").trim();
  if (!/^\d+$/.test(rawPort)) return null;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return `http://127.0.0.1:${port}/people-first-app/`;
}

export function validateTask9ProductionContext({
  env,
  baseURL,
  configuredBaseURL,
}) {
  const errors = [];
  if (!/^(?:1|true)$/i.test(String(env.CI ?? ""))) {
    errors.push("CI must be explicitly true for a production-dist Task 9 capture");
  }
  if (env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER !== "true") {
    errors.push("local Playwright server must be explicitly enabled");
  }
  if (env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR !== "dist") {
    errors.push("preview directory must be exactly dist");
  }

  const expectedBaseURL = expectedLocalBaseURL(env);
  if (!expectedBaseURL) {
    errors.push("local preview port must be an explicit valid TCP port");
    return errors;
  }
  if (baseURL !== expectedBaseURL) {
    errors.push(`baseURL must match the isolated local preview: ${expectedBaseURL}`);
  }
  if (configuredBaseURL !== expectedBaseURL) {
    errors.push(`project baseURL must match the isolated local preview: ${expectedBaseURL}`);
  }
  return errors;
}

export function validateTask9CaptureSet({
  captures,
  outputRoot,
  repositoryRoot,
}) {
  const errors = [];
  if (!Array.isArray(captures)) {
    return ["captures must be an array"];
  }

  const expectedIds = new Set(TASK9_EXPECTED_CAPTURE_IDS);
  const observedIds = new Set();
  for (const capture of captures) {
    if (!capture || typeof capture !== "object") {
      errors.push("capture entry must be an object");
      continue;
    }
    if (observedIds.has(capture.id)) {
      errors.push(`duplicate capture ID: ${String(capture.id)}`);
    }
    observedIds.add(capture.id);
    if (!expectedIds.has(capture.id)) {
      errors.push(`unexpected capture ID: ${String(capture.id)}`);
    }
  }
  for (const id of TASK9_EXPECTED_CAPTURE_IDS) {
    if (!observedIds.has(id)) {
      errors.push(`missing expected capture: ${id}`);
    }
  }
  if (captures.length !== TASK9_EXPECTED_CAPTURE_IDS.length) {
    errors.push(
      `capture count must be exactly ${TASK9_EXPECTED_CAPTURE_IDS.length}; received ${captures.length}`
    );
  }

  const normalizedOutputRoot = normalizeRelativePath(outputRoot).replace(/\/+$/, "");
  for (const capture of captures) {
    if (!capture || typeof capture !== "object" || !expectedIds.has(capture.id)) continue;
    const expectedPath = `${normalizedOutputRoot}/${capture.id}.png`;
    if (capture.path !== expectedPath) {
      errors.push(`${capture.id}: path must be ${expectedPath}`);
      continue;
    }

    const absolutePath = path.resolve(repositoryRoot, capture.path);
    const relativeToRepository = path.relative(repositoryRoot, absolutePath);
    if (relativeToRepository.startsWith("..") || path.isAbsolute(relativeToRepository)) {
      errors.push(`${capture.id}: capture path escapes the repository root`);
      continue;
    }

    try {
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        errors.push(`${capture.id}: capture must be a regular non-symlink file`);
        continue;
      }
      if (stat.size <= 0) {
        errors.push(`${capture.id}: capture file must not be empty`);
      }
      if (capture.sizeBytes !== stat.size) {
        errors.push(`${capture.id}: size does not match the capture file`);
      }
      if (capture.sha256 !== sha256File(absolutePath)) {
        errors.push(`${capture.id}: sha256 does not match the capture file`);
      }
    } catch (error) {
      errors.push(
        `${capture.id}: capture file cannot be inspected: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const provenance = capture.fixtureProvenance;
    if (
      provenance?.kind !== "ISOLATED_TEST_FIXTURE" ||
      provenance?.source !== "e2e/helpers/zenflowV2State.ts" ||
      provenance?.productionReachable !== false
    ) {
      errors.push(`${capture.id}: fixture provenance is not the isolated test contract`);
    }

    if (
      capture.id === "AFTER-09-05-settings-high-contrast-font-150" ||
      capture.id === "AFTER-09-03-settings-appearance-ar-paper-medium"
    ) {
      const observations = capture.observations;
      if (
        observations?.focusVisible !== true ||
        observations?.focusIndicatorVisible !== true ||
        observations?.focusedControlInsidePanel !== true
      ) {
        errors.push(`${capture.id}: focus-visible evidence is incomplete`);
      }
      if (observations?.headerIconInlineWithCopy !== true) {
        errors.push(`${capture.id}: panel header inline alignment evidence is incomplete`);
      }
    }
  }

  return errors;
}
