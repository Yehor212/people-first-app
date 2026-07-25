#!/usr/bin/env node

import {
  aggregateAssuranceRun,
  buildAssuranceImplementationIdentity,
  buildRepositorySnapshot,
  classifyAssuranceTask,
  createSpecialistPacket,
  sha256Canonical,
  validateAssuranceReport,
  validateAuthorityDecision,
  validateEvidenceLedger,
  validateRoleReceipt,
  validateRuntimePersistenceInventory,
  validateUsageLedger,
} from "./persistent-agent-orchestra/assurance-core.mjs";
import {
  checkWorkspace,
  validateRegistry,
} from "./persistent-agent-orchestra/registry-core.mjs";
import { readRegularFileInsideRoot } from "./persistent-agent-orchestra/secure-read.mjs";
import { assertNoDuplicateJsonKeys } from "./persistent-agent-orchestra/strict-json.mjs";

const ROOT_DIR = process.cwd();
const REGISTRY_PATH = "config/persistent-agent-orchestra.json";
const WAIVERS_PATH = "config/persistent-agent-orchestra.source-waivers.json";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check-contract")) {
    await checkContract();
    return;
  }
  if (args.includes("--classify")) {
    const registry = await readJson(REGISTRY_PATH);
    const routingMode = optionalValue(args, "--routing-mode")
      ?? registry.assurance_protocol?.risk_classification_registry?.routing_modes?.default
      ?? "EVIDENCE_FIRST_ADAPTIVE";
    printJson(classifyAssuranceTask(registry, valuesFor(args, "--trigger"), {
      routingMode,
    }));
    return;
  }
  if (args.includes("--assurance-build")) {
    printJson(await buildAssuranceImplementationIdentity(ROOT_DIR));
    return;
  }
  if (args.includes("--validate-assurance-build")) {
    const supplied = await readJson(requiredValue(args, "--identity"));
    const current = await buildAssuranceImplementationIdentity(ROOT_DIR);
    const errors = [];
    if (sha256Canonical(supplied) !== sha256Canonical(current)) {
      errors.push("assurance build identity does not match the current canonical artifact set");
    }
    printValidation("ASSURANCE_BUILD_IDENTITY", { errors });
    return;
  }
  if (args.includes("--prepare-packet")) {
    const registry = await readJson(REGISTRY_PATH);
    const manifest = await readJson(requiredValue(args, "--manifest"));
    const dependencyPath = optionalValue(args, "--phase-dependencies");
    const phaseDependencyReceipts = dependencyPath === null
      ? undefined
      : await readJson(dependencyPath);
    const closureAuditPath = optionalValue(args, "--closure-audit");
    const closureAudit = closureAuditPath === null ? undefined : await readJson(closureAuditPath);
    const evidenceRecordsPath = optionalValue(args, "--evidence-records");
    const evidenceRecords = evidenceRecordsPath === null ? undefined : await readJson(evidenceRecordsPath);
    const packet = createSpecialistPacket({
      registry,
      manifest,
      inputDataClassification: requiredValue(args, "--input-classification"),
      roleId: requiredValue(args, "--role-id"),
      phase: requiredValue(args, "--phase"),
      questionOwned: requiredValue(args, "--question"),
      evidenceLocators: valuesFor(args, "--evidence-locator"),
      evidenceRecords,
      phaseDependencyReceipts,
      closureAudit,
    });
    printJson(packet);
    return;
  }
  if (args.includes("--snapshot")) {
    const scopes = valuesFor(args, "--scope");
    const snapshot = await buildRepositorySnapshot({ rootDir: ROOT_DIR, scopePaths: scopes });
    printJson(snapshot);
    return;
  }
  if (args.includes("--validate-receipt")) {
    const manifest = await readJson(requiredValue(args, "--manifest"));
    const receipt = await readJson(requiredValue(args, "--receipt"));
    printValidation("ROLE_RECEIPT", validateRoleReceipt(receipt, manifest));
    return;
  }
  if (args.includes("--aggregate")) {
    const packet = await readJson(requiredValue(args, "--packet"));
    printJson(aggregateAssuranceRun(packet));
    return;
  }
  if (args.includes("--validate-report")) {
    const report = await readJson(requiredValue(args, "--report"));
    const packet = await readJson(requiredValue(args, "--packet"));
    printValidation("ASSURANCE_REPORT", validateAssuranceReport(report, packet));
    return;
  }
  if (args.includes("--validate-usage")) {
    const ledger = await readJson(requiredValue(args, "--ledger"));
    const manifest = await readJson(requiredValue(args, "--manifest"));
    printValidation("USAGE_LEDGER", validateUsageLedger(ledger, { manifest }));
    return;
  }
  if (args.includes("--validate-evidence")) {
    const ledger = await readJson(requiredValue(args, "--ledger"));
    printValidation("EVIDENCE_LEDGER", validateEvidenceLedger(ledger));
    return;
  }
  if (args.includes("--validate-authority")) {
    const decision = await readJson(requiredValue(args, "--decision"));
    printValidation("AUTHORITY_DECISION", validateAuthorityDecision(decision));
    return;
  }
  if (args.includes("--validate-persistence")) {
    const inventory = await readJson(requiredValue(args, "--inventory"));
    printValidation("RUNTIME_PERSISTENCE_INVENTORY", validateRuntimePersistenceInventory(inventory));
    return;
  }
  throw new Error(
    "usage: --check-contract | --assurance-build | --validate-assurance-build --identity path | --classify --trigger ID [--trigger ID] [--routing-mode EVIDENCE_FIRST_ADAPTIVE|FIXED_FULL_TEN] | --prepare-packet --manifest path --role-id id --phase phase --question text --input-classification REDACTED_TASK_METADATA --evidence-locator path [--phase-dependencies path] [--closure-audit path] [--evidence-records path] | --snapshot --scope path | --validate-receipt --manifest path --receipt path | --aggregate --packet path | --validate-report --report path --packet path | --validate-evidence --ledger path | --validate-usage --ledger path | --validate-authority --decision path | --validate-persistence --inventory path",
  );
}

async function checkContract() {
  const registry = await readJson(REGISTRY_PATH);
  const waivers = await readJson(WAIVERS_PATH);
  const validation = validateRegistry(registry, { waivers });
  if (validation.errors.length !== 0) {
    throw new Error(validation.errors.join("\n"));
  }
  const workspace = await checkWorkspace({ rootDir: ROOT_DIR });
  if (workspace.errors.length !== 0) {
    throw new Error(workspace.errors.join("\n"));
  }
  const assuranceBuild = await buildAssuranceImplementationIdentity(ROOT_DIR);
  const profileNames = registry.roles.map(function generatedProfileName(role) {
    return role.filename;
  });
  let profileBytes = 0;
  for (const profileName of profileNames) {
    const text = await readRegularFileInsideRoot({
      rootDir: ROOT_DIR,
      relativePath: `.codex/agents/${profileName}`,
    });
    profileBytes += Buffer.byteLength(text, "utf8");
  }
  const compaction = registry.prompt_budgets.profile_compaction;
  const reduction = ((compaction.baseline_total_bytes - profileBytes) / compaction.baseline_total_bytes) * 100;
  printJson({
    status: "STRUCTURAL_CONTRACT_VALID",
    protocol_version: registry.assurance_protocol.version,
    registry_schema_version: registry.schema_version,
    role_count: registry.roles.length,
    risk_registry_sha256: sha256Canonical(registry.assurance_protocol.risk_classification_registry),
    assurance_build_sha256: assuranceBuild.assurance_build_sha256,
    assurance_build_artifact_count: assuranceBuild.artifact_inventory.length,
    generated_profile_bytes: profileBytes,
    profile_byte_reduction_percent: Number(reduction.toFixed(4)),
    profile_byte_metric_boundary: compaction.proof_boundary,
    superiority_status: registry.assurance_protocol.evaluation.promotion_status,
    warnings: validation.warnings,
  });
}

async function readJson(relativePath) {
  const raw = await readRegularFileInsideRoot({ rootDir: ROOT_DIR, relativePath });
  assertNoDuplicateJsonKeys(raw);
  return JSON.parse(raw);
}

function valuesFor(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    values.push(value);
  }
  if (values.length === 0) throw new Error(`${flag} is required`);
  return values;
}

function optionalValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function requiredValue(args, flag) {
  return valuesFor(args, flag)[0];
}

function printValidation(kind, validation) {
  const status = validation.errors.length === 0 ? "VALID" : "INVALID";
  printJson({ kind, status, errors: validation.errors });
  if (validation.errors.length !== 0) process.exitCode = 2;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

main().catch(function reportError(error) {
  process.stderr.write(`[ten-lens-assurance] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
