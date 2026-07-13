#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  buildEvalInvocationPrompt,
  buildProfileIdentityManifest,
  createRunReceipt,
  parseStrictJson,
  readRegularFileInsideRoot,
  sha256Text,
  validateEvalCatalog,
  writePrivateFileInsideRoot,
} from "./persistent-agent-orchestra/eval-core.mjs";

const rootDir = process.cwd();
const args = process.argv.slice(2);

if (args.length !== 1 || args[0] !== "--prepare") {
  console.error("Usage: node scripts/run-persistent-agent-orchestra-evals.mjs --prepare");
  process.exit(2);
}

try {
  const [registry, catalog] = await Promise.all([
    readJson("config/persistent-agent-orchestra.json"),
    readJson("config/persistent-agent-orchestra.evals.json"),
  ]);
  const validation = validateEvalCatalog(catalog, registry);
  if (validation.errors.length > 0) {
    console.error("[agent-orchestra-evals] catalog invalid");
    for (const error of validation.errors) console.error(`- ${error}`);
    process.exit(2);
  }

  const now = new Date();
  const gitObservation = readGitObservation();
  const runReceipt = await createRunReceipt({
    rootDir,
    now,
    projectTrust: "UNKNOWN",
    gitObservation,
    runtime: {
      node_version: process.version,
      codex_version: readCodexVersion(),
      custom_profile_loading: "UNVERIFIED",
      effective_permissions: "UNVERIFIED",
    },
  });
  const runId = `${now.toISOString().replace(/[:.]/g, "-")}-${runReceipt.artifact_hashes.registry.slice(0, 12)}`;
  runReceipt.run_id = runId;
  const profileIdentities = await buildProfileIdentityManifest(rootDir, registry);
  const packet = {
    schema_version: 1,
    status: "PREPARED_NOT_EXECUTED",
    run_id: runId,
    run_receipt: runReceipt,
    fixture_boundary: catalog.fixture_boundary,
    attempts: catalog.scenarios.map((scenario, index) => {
      const attemptId = `${runId}-${String(index + 1).padStart(3, "0")}`;
      const attemptNonce = randomBytes(16).toString("hex");
      const identity = profileIdentities[scenario.role_id];
      const invocationPrompt = buildEvalInvocationPrompt({
        registry,
        scenario,
        runId,
        attemptId,
        attemptNonce,
        runtimeProfileName: identity.runtime_profile_name,
        profileSha256: identity.profile_sha256,
      });
      return {
        attempt_id: attemptId,
        scenario_id: scenario.id,
        role_id: scenario.role_id,
        adapter_version: registry.evaluation_adapter.version,
        adapter_sha256: sha256Text(JSON.stringify(registry.evaluation_adapter)),
        runtime_profile_name: identity.runtime_profile_name,
        profile_sha256: identity.profile_sha256,
        invocation_prompt: invocationPrompt,
        prompt_sha256: sha256Text(invocationPrompt),
        nonce: attemptNonce,
        raw_output: null,
        raw_output_sha256: null,
        candidate: null,
      };
    }),
    limitations: [
      "This packet proves preparation and current artifact hashes only.",
      "Custom-profile loading, effective permissions, semantic quality, human review, and user acceptance remain UNVERIFIED.",
    ],
  };
  const outputRelativePath = "output/agent-orchestra/semantic-eval-prepared.json";
  const outputPath = path.join(rootDir, outputRelativePath);
  await writePrivateFileInsideRoot({
    rootDir,
    relativePath: outputRelativePath,
    content: `${JSON.stringify(packet, null, 2)}\n`,
  });
  console.log(`[agent-orchestra-evals] PREPARED_NOT_EXECUTED ${path.relative(rootDir, outputPath)}`);
  console.log("[agent-orchestra-evals] semantic/runtime/human/user statuses remain UNVERIFIED");
} catch (error) {
  console.error(`[agent-orchestra-evals] ${error.message}`);
  process.exit(2);
}

async function readJson(relativePath) {
  return parseStrictJson(await readRegularFileInsideRoot({ rootDir, relativePath }));
}

function readGitObservation() {
  try {
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const status = execFileSync("git", ["status", "--porcelain=v1"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return {
      head_sha: /^[0-9a-f]{40}$/.test(headSha) ? headSha : null,
      worktree_state: status.trim().length === 0 ? "CLEAN" : "DIRTY",
      source: "LOCAL_GIT_COMMANDS",
    };
  } catch {
    return {
      head_sha: null,
      worktree_state: "UNKNOWN",
      source: null,
    };
  }
}

function readCodexVersion() {
  try {
    return execFileSync("codex", ["--version"], {
      cwd: rootDir,
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
