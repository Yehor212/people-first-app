#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import path from "node:path";

import {
  parseStrictJson,
  readRegularFileInsideRoot,
  writePrivateFileInsideRoot,
} from "./persistent-agent-orchestra/eval-core.mjs";
import {
  calculateTaskSliceSha256,
  createPreparedRoutingAbReport,
  sha256Text,
  stableJson,
  validateRoutingAbReport,
} from "./persistent-agent-orchestra/routing-ab-core.mjs";

const rootDir = process.cwd();
const args = process.argv.slice(2);

try {
  if (args.length === 2 && args[0] === "--prepare") {
    await prepare(args[1]);
    process.exit(0);
  }
  if (args.length === 2 && args[0] === "--validate") {
    await validate(args[1]);
    process.exit(0);
  }
  console.error("Usage: node scripts/run-agent-routing-ab-eval.mjs --prepare <task.json>|--validate <report.json>");
  process.exit(2);
} catch (error) {
  console.error(`[agent-routing-ab] ${error.message}`);
  process.exit(2);
}

async function prepare(taskRelativePath) {
  const [taskDescriptor, registry] = await Promise.all([
    readJsonWithinRepo(taskRelativePath),
    readJsonWithinRepo("config/persistent-agent-orchestra.json"),
  ]);
  const roleIds = extractCanonicalRoleIds(registry);
  const task = await normalizeTaskDescriptor(taskDescriptor);
  const now = new Date();
  const runId = `agent-routing-ab-${now.toISOString().replace(/[:.]/g, "-")}-${task.task_slice.sha256.slice(0, 12)}`;
  const report = createPreparedRoutingAbReport({
    now,
    runId,
    roleIds,
    taskSlice: task.task_slice,
    sharedConditions: task.shared_conditions,
    randomBytes,
  });
  const outputRelativePath = `output/agent-orchestra/${runId}.json`;
  await writePrivateFileInsideRoot({
    rootDir,
    relativePath: outputRelativePath,
    content: `${JSON.stringify(report, null, 2)}\n`,
  });
  console.log(`[agent-routing-ab] PREPARED ${outputRelativePath}`);
  console.log(`[agent-routing-ab] execution order: ${report.shared_conditions.execution_order.join(", ")}`);
  console.log("[agent-routing-ab] no model, remote, product runtime, or deployment action was performed");
}

async function validate(reportRelativePath) {
  const [report, registry] = await Promise.all([
    readJsonWithinRepo(reportRelativePath),
    readJsonWithinRepo("config/persistent-agent-orchestra.json"),
  ]);
  const result = validateRoutingAbReport(report, { roleIds: extractCanonicalRoleIds(registry) });
  if (result.errors.length === 0 && report.status === "PILOT_COMPLETED") {
    result.errors.push(...await validateRawOutputFiles(report));
  }
  if (result.errors.length > 0) {
    console.error("[agent-routing-ab] validation failed");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[agent-routing-ab] LOCAL_STRUCTURE_VALID ${report.status}`);
  if (result.non_promotable_reasons.length > 0) {
    console.log(`[agent-routing-ab] non-promotable reasons: ${result.non_promotable_reasons.join(", ")}`);
  }
  for (const warning of result.warnings) console.log(`[agent-routing-ab] warning: ${warning}`);
}

async function validateRawOutputFiles(report) {
  const errors = [];
  for (const arm of report.arms) {
    for (const output of arm.outputs) {
      try {
        const raw = await readRegularFileInsideRoot({ rootDir, relativePath: output.relative_path });
        if (sha256Text(raw) !== output.raw_output_sha256) {
          errors.push(`${arm.arm_id}/${output.actor_id} raw output hash does not match ${output.relative_path}`);
        }
      } catch (error) {
        errors.push(`${arm.arm_id}/${output.actor_id} raw output cannot be read: ${error.message}`);
      }
    }
  }
  return errors;
}

async function normalizeTaskDescriptor(descriptor) {
  if (!isPlainObject(descriptor)) throw new Error("task descriptor must be a strict JSON object");
  const allowedKeys = new Set([
    "schema_version",
    "id",
    "title",
    "prompt",
    "evidence_locators",
    "artifact_paths",
    "tool_surface",
    "budget",
    "rubric",
    "privacy_boundary",
  ]);
  for (const key of Object.keys(descriptor)) {
    if (!allowedKeys.has(key)) throw new Error(`task descriptor contains unknown key ${key}`);
  }
  if (descriptor.schema_version !== 1) throw new Error("task descriptor schema_version must be 1");
  if (!isBoundedIdentifier(descriptor.id)) throw new Error("task descriptor id must be a 3-200 character identifier");
  if (!isBoundedText(descriptor.title, 3, 240)) throw new Error("task descriptor title must be 3-240 characters");
  if (!isBoundedText(descriptor.prompt, 20, 12000)) throw new Error("task descriptor prompt must be 20-12000 characters");
  for (const key of ["evidence_locators", "artifact_paths", "tool_surface", "rubric"]) {
    if (!isNonEmptyStringArray(descriptor[key])) throw new Error(`task descriptor ${key} must be a non-empty unique string array`);
  }
  if (!isPlainObject(descriptor.budget) || Object.keys(descriptor.budget).length === 0) {
    throw new Error("task descriptor budget must be a non-empty object");
  }
  if (descriptor.privacy_boundary !== "NO_PERSONAL_OR_PRODUCTION_DATA") {
    throw new Error("task descriptor privacy_boundary must be NO_PERSONAL_OR_PRODUCTION_DATA");
  }

  const artifactIdentities = [];
  for (const artifactPath of [...descriptor.artifact_paths].sort()) {
    const contents = await readRegularFileInsideRoot({ rootDir, relativePath: resolveWithinRepo(artifactPath) });
    artifactIdentities.push({ path: artifactPath, sha256: sha256Text(contents) });
  }
  const taskContent = {
    id: descriptor.id,
    title: descriptor.title,
    prompt: descriptor.prompt,
    evidence_locators: [...descriptor.evidence_locators].sort(),
    privacy_boundary: descriptor.privacy_boundary,
  };
  return {
    task_slice: {
      ...taskContent,
      sha256: calculateTaskSliceSha256(taskContent),
    },
    shared_conditions: {
      artifact_snapshot_sha256: sha256Text(stableJson(artifactIdentities)),
      runtime_identity_sha256: sha256Text(stableJson({
        node_version: process.version,
        custom_profile_loading: "UNVERIFIED",
        effective_permissions: "UNVERIFIED",
      })),
      tool_surface_sha256: sha256Text(stableJson([...descriptor.tool_surface].sort())),
      budget_identity_sha256: sha256Text(stableJson(descriptor.budget)),
      rubric_sha256: sha256Text(stableJson([...descriptor.rubric].sort())),
    },
  };
}

function extractCanonicalRoleIds(registry) {
  const roleIds = registry?.roles?.map((role) => role?.id);
  if (!isNonEmptyStringArray(roleIds) || roleIds.length !== 10) {
    throw new Error("canonical registry must provide exactly ten unique role IDs");
  }
  return roleIds;
}

async function readJsonWithinRepo(relativePath) {
  const safeRelativePath = resolveWithinRepo(relativePath);
  return parseStrictJson(await readRegularFileInsideRoot({ rootDir, relativePath: safeRelativePath }));
}

function resolveWithinRepo(relativeOrAbsolutePath) {
  const resolved = path.resolve(rootDir, relativeOrAbsolutePath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error("path must name a file inside the repository");
  }
  return relative;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isBoundedIdentifier(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,199}$/.test(value);
}

function isBoundedText(value, minimum, maximum) {
  return typeof value === "string" && value.trim().length >= minimum && value.length <= maximum;
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0) && new Set(value).size === value.length;
}
