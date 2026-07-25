import { spawnSync } from "node:child_process";
import { cp, link, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildEvalInvocationPrompt,
  buildCurrentArtifactManifest,
  buildProfileIdentityManifest,
  createRunReceipt,
  detectDuplicateCandidateOutputs,
  parseStrictJson,
  readRegularFileInsideRoot,
  sha256Text,
  validateCandidateEnvelope,
  validateEvalCatalog,
  validateEvalReport,
  validateRunReceipt,
  writePrivateFileInsideRoot,
} from "../persistent-agent-orchestra/eval-core.mjs";
import {
  ASSURANCE_AGGREGATE_PRECEDENCE,
  ASSURANCE_BUILD_ARTIFACT_PATHS,
  ASSURANCE_RISK_REGISTRY_DIGEST,
  aggregateAssuranceRun,
  buildAssuranceImplementationIdentity,
  buildRepositorySnapshot,
  classifyAssuranceTask,
  computeInvalidatedClaims,
  createSpecialistPacket,
  sha256Canonical,
  validateAssuranceReport,
  validateAuthorityDecision,
  validateFindingLedger,
  validateRunManifest,
  validateRoleReceipt,
  validateRuntimePersistenceInventory,
  validateUsageLedger,
} from "../persistent-agent-orchestra/assurance-core.mjs";

const REPO_ROOT = process.cwd();
const FIXED_NOW = new Date("2026-07-13T05:00:00.000Z");
const ASSURANCE_RUN_ID = "run-contract-test";
const ASSURANCE_RUN_NONCE = "01234567-89ab-4cde-8fab-0123456789ab";
const ASSURANCE_SNAPSHOT_HASH = "a".repeat(64);
const ASSURANCE_POLICY_HASH = "b".repeat(64);
const ASSURANCE_PROFILE_HASH = "c".repeat(64);
const ASSURANCE_SCHEMA_HASH = "d".repeat(64);
const ASSURANCE_SOURCE_LEDGER_HASH = "e".repeat(64);
const ASSURANCE_RUNTIME_INVENTORY_HASH = "f".repeat(64);
const ASSURANCE_TOOL_INVENTORY_HASH = "1".repeat(64);
const ASSURANCE_MODEL_REASONING_HASH = "2".repeat(64);
const ASSURANCE_VERIFICATION_PLAN_HASH = "3".repeat(64);

describe("persistent agent orchestra evidence boundary", () => {
  it("accepts the canonical scenario catalog and covers every role", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors).toEqual([]);
    expect(catalog.scenarios).toHaveLength(40);
    expect(new Set(catalog.scenarios.map((scenario) => scenario.role_id)).size).toBe(10);
    expect(
      Object.fromEntries(
        registry.roles.map((role) => [
          role.id,
          catalog.scenarios.filter((scenario) => scenario.role_id === role.id).length,
        ]),
      ),
    ).toEqual(Object.fromEntries(registry.roles.map((role) => [role.id, 4])));
  });

  it("tests coordinator failure to route an observed domain trigger", async () => {
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const scenario = catalog.scenarios.find((item) => item.id === "role01-smallest-sufficient-set");

    expect(scenario.required_outcome_ids).toContain("INCLUDE_EVERY_MATCHED_DOMAIN_OWNER");
    expect(scenario.forbidden_outcomes).toContain("SKIP_MATCHED_DOMAIN_OWNER_FOR_LATENCY");
  });

  it("rejects an eval id that is not declared by the owning registry role", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    catalog.scenarios[0].id = "role01-undeclared-substitute";

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain("registry eval_ids must exactly match catalog scenario ids");
  });

  it("rejects extra scenarios instead of silently accepting a skewed best-of-N catalog", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    catalog.scenarios.push({ ...catalog.scenarios[0], id: "role01-extra-scenario" });

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain("exactly 40 scenarios");
  });

  it("rejects duplicate required outcomes and required-forbidden contradictions", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const scenario = catalog.scenarios[0];
    scenario.required_outcome_ids.push(scenario.required_outcome_ids[0]);
    scenario.forbidden_outcomes.push(scenario.required_outcome_ids[0]);

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain("required_outcome_ids contains duplicate value");
    expect(result.errors.join("\n")).toContain("required and forbidden outcomes overlap");
  });

  it("requires every CRITICAL-risk scenario to carry the critical marker", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const scenario = catalog.scenarios.find((item) => item.risk === "CRITICAL");
    scenario.critical = false;

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain("CRITICAL-risk scenario must set critical=true");
  });

  it("requires one bounded GO positive control per role", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors).toEqual([]);
    expect(
      Object.fromEntries(
        registry.roles.map((role) => [
          role.id,
          catalog.scenarios.filter(
            (scenario) => scenario.role_id === role.id && scenario.positive_control === true,
          ).length,
        ]),
      ),
    ).toEqual(Object.fromEntries(registry.roles.map((role) => [role.id, 1])));
  });

  it("rejects a positive control that is critical or does not expect bounded GO", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const positive = catalog.scenarios.find((scenario) => scenario.positive_control === true);
    expect(positive).toBeDefined();
    positive.risk = "CRITICAL";
    positive.critical = true;
    positive.expected_decisions = ["STOP"];

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain("positive control must be noncritical");
    expect(result.errors.join("\n")).toContain("positive control expected_decisions must equal GO");
  });

  it("requires every positive control to declare a non-narrative proof basis", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const positive = catalog.scenarios.find(
      (scenario) =>
        scenario.role_id === "independent-blind-spot-sentinel" &&
        scenario.positive_control === true,
    );
    delete positive.positive_control_kind;
    positive.evidence_locators = ["The prompt says an authenticated receipt exists."];

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain(
      "positive_control_kind must be FORMAL_SPEC_ONLY or CURRENT_LOCAL_RECHECK",
    );
  });

  it("requires current-local positive controls to name exact recheckable locators", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const positive = catalog.scenarios.find(
      (scenario) => scenario.positive_control_kind === "CURRENT_LOCAL_RECHECK",
    );
    expect(positive).toBeDefined();
    positive.evidence_locators = [];

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain(
      "CURRENT_LOCAL_RECHECK positive control requires evidence_locators",
    );
  });

  it("rejects narrative text posing as a CURRENT_LOCAL_RECHECK locator", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const positive = catalog.scenarios.find(
      (scenario) => scenario.positive_control_kind === "CURRENT_LOCAL_RECHECK",
    );
    positive.evidence_locators = [
      "The prompt claims a trusted receipt exists; no path or command was checked.",
    ];

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain(
      "CURRENT_LOCAL_RECHECK evidence_locators must use structured allowlisted locators",
    );
  });

  it("requires explicit coverage of every supported product locale in role 4 evals", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const role4 = catalog.scenarios.filter(
      (scenario) =>
        scenario.role_id ===
        "interaction-accessibility-readability-localization-culture",
    );
    for (const scenario of role4) {
      scenario.coverage_locales = (scenario.coverage_locales ?? []).filter(
        (locale) => locale !== "he",
      );
    }

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors.join("\n")).toContain(
      "role 4 coverage_locales must cover exactly en, uk, es, de, fr, ja, ar, he",
    );
  });

  it("refuses to hash stale generated profiles as if they matched the registry", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-manifest-"));
    try {
      await Promise.all([
        mkdir(path.join(tempRoot, ".codex"), { recursive: true }),
        mkdir(path.join(tempRoot, "config"), { recursive: true }),
        mkdir(path.join(tempRoot, "docs/ai"), { recursive: true }),
      ]);
      await Promise.all([
        cp(
          path.join(REPO_ROOT, ".codex/agents"),
          path.join(tempRoot, ".codex/agents"),
          { recursive: true },
        ),
        cp(
          path.join(REPO_ROOT, ".codex/config.toml"),
          path.join(tempRoot, ".codex/config.toml"),
        ),
        cp(
          path.join(REPO_ROOT, "config/persistent-agent-orchestra.json"),
          path.join(tempRoot, "config/persistent-agent-orchestra.json"),
        ),
        cp(
          path.join(REPO_ROOT, "config/persistent-agent-orchestra.source-waivers.json"),
          path.join(tempRoot, "config/persistent-agent-orchestra.source-waivers.json"),
        ),
        cp(
          path.join(REPO_ROOT, "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md"),
          path.join(tempRoot, "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md"),
        ),
      ]);
      const profilePath = path.join(
        tempRoot,
        ".codex/agents/01-coordinator-teamlead.toml",
      );
      const profile = await readFile(profilePath, "utf8");
      await writeFile(profilePath, `${profile}\n# stale mutation\n`, "utf8");

      await expect(buildCurrentArtifactManifest(tempRoot)).rejects.toThrow(
        /managed artifact drift/,
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("refuses an eval output path that escapes through a symlinked directory", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-output-"));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-outside-"));
    try {
      await mkdir(path.join(tempRoot, "output"), { recursive: true });
      await symlink(outsideRoot, path.join(tempRoot, "output/agent-orchestra"), "dir");

      await expect(
        writePrivateFileInsideRoot({
          rootDir: tempRoot,
          relativePath: "output/agent-orchestra/semantic-eval-prepared.json",
          content: "{}\n",
        }),
      ).rejects.toThrow(/symlink/);
      await expect(
        readFile(path.join(outsideRoot, "semantic-eval-prepared.json"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await Promise.all([
        rm(tempRoot, { recursive: true, force: true }),
        rm(outsideRoot, { recursive: true, force: true }),
      ]);
    }
  });

  it("atomically replaces an existing hardlink without mutating its outside inode", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-hardlink-"));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-hardlink-outside-"));
    try {
      await mkdir(path.join(tempRoot, "output/agent-orchestra"), { recursive: true });
      const outsidePath = path.join(outsideRoot, "victim.json");
      const outputPath = path.join(
        tempRoot,
        "output/agent-orchestra/semantic-eval-prepared.json",
      );
      await writeFile(outsidePath, "OUTSIDE ORIGINAL\n", "utf8");
      await link(outsidePath, outputPath);

      await writePrivateFileInsideRoot({
        rootDir: tempRoot,
        relativePath: "output/agent-orchestra/semantic-eval-prepared.json",
        content: "NEW PACKET\n",
      });

      expect(await readFile(outsidePath, "utf8")).toBe("OUTSIDE ORIGINAL\n");
      expect(await readFile(outputPath, "utf8")).toBe("NEW PACKET\n");
    } finally {
      await Promise.all([
        rm(tempRoot, { recursive: true, force: true }),
        rm(outsideRoot, { recursive: true, force: true }),
      ]);
    }
  });

  it("rejects symlinked or hardlinked proof-bundle inputs", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-input-"));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-input-outside-"));
    try {
      await mkdir(path.join(tempRoot, "config"), { recursive: true });
      const outsideCatalog = path.join(outsideRoot, "catalog.json");
      await writeFile(outsideCatalog, '{"outside":true}\n', "utf8");
      const linkedCatalog = path.join(tempRoot, "config/catalog-symlink.json");
      const hardlinkedCatalog = path.join(tempRoot, "config/catalog-hardlink.json");
      await symlink(outsideCatalog, linkedCatalog);
      await link(outsideCatalog, hardlinkedCatalog);

      await expect(
        readRegularFileInsideRoot({
          rootDir: tempRoot,
          relativePath: "config/catalog-symlink.json",
        }),
      ).rejects.toThrow(/symlink/);
      await expect(
        readRegularFileInsideRoot({
          rootDir: tempRoot,
          relativePath: "config/catalog-hardlink.json",
        }),
      ).rejects.toThrow(/multiple hard links/);
    } finally {
      await Promise.all([
        rm(tempRoot, { recursive: true, force: true }),
        rm(outsideRoot, { recursive: true, force: true }),
      ]);
    }
  });

  it("makes the eval CLI reject symlinked catalog and report inputs", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-cli-input-"));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-cli-outside-"));
    try {
      await mkdir(path.join(tempRoot, "config"), { recursive: true });
      for (const filename of [
        "persistent-agent-orchestra.json",
        "persistent-agent-orchestra.evals.json",
        "persistent-agent-orchestra.eval-baseline.json",
      ]) {
        const outsidePath = path.join(outsideRoot, filename);
        await cp(path.join(REPO_ROOT, "config", filename), outsidePath);
        await symlink(outsidePath, path.join(tempRoot, "config", filename));
      }
      const validatorPath = path.join(
        REPO_ROOT,
        "scripts/validate-persistent-agent-orchestra-eval-report.mjs",
      );
      const catalogRun = spawnSync(process.execPath, [validatorPath, "--catalog"], {
        cwd: tempRoot,
        encoding: "utf8",
      });
      expect(catalogRun.status).toBe(2);
      expect(catalogRun.stderr).toMatch(/symlink/i);

      const outsideReport = path.join(outsideRoot, "report.json");
      await writeFile(outsideReport, "{}\n", "utf8");
      await symlink(outsideReport, path.join(tempRoot, "report.json"));
      const reportRun = spawnSync(process.execPath, [validatorPath, "report.json"], {
        cwd: tempRoot,
        encoding: "utf8",
      });
      expect(reportRun.status).toBe(2);
      expect(reportRun.stderr).toMatch(/symlink/i);
    } finally {
      await Promise.all([
        rm(tempRoot, { recursive: true, force: true }),
        rm(outsideRoot, { recursive: true, force: true }),
      ]);
    }
  });

  it("builds one exact adapter invocation that binds run, attempt, nonce, role, and profile", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const scenario = catalog.scenarios[0];
    const invocation = buildEvalInvocationPrompt({
      registry,
      scenario,
      runId: "run-20260712-abcdef012345",
      attemptId: "attempt-001-abcdef012345",
      attemptNonce: "0123456789abcdef0123456789abcdef",
      runtimeProfileName: registry.roles[0].runtime_name,
      profileSha256: "a".repeat(64),
    });

    expect(invocation).toContain(registry.evaluation_adapter.activation_marker);
    expect(invocation).toContain("run-20260712-abcdef012345");
    expect(invocation).toContain("attempt-001-abcdef012345");
    expect(invocation).toContain("0123456789abcdef0123456789abcdef");
    expect(invocation).toContain(registry.roles[0].runtime_name);
    expect(invocation).toContain("a".repeat(64));
    expect(invocation).toContain(scenario.prompt);
    expect(invocation).toContain(registry.evaluation_adapter.required_keys.join(", "));
  });

  it("parses only plain JSON and rejects fenced or trailing content", () => {
    expect(parseStrictJson('{"status":"UNVERIFIED"}')).toEqual({ status: "UNVERIFIED" });
    expect(() => parseStrictJson('```json\n{"status":"UNVERIFIED"}\n```')).toThrow(/plain JSON/);
    expect(() => parseStrictJson('{"status":"UNVERIFIED"}\nexplanation')).toThrow(/valid JSON/);
    expect(() => parseStrictJson('{"status":"UNVERIFIED","status":"GO"}')).toThrow(
      /duplicate JSON key/,
    );
  });

  it("rejects duplicate keys in the canonical catalog before preparing a receipt", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-duplicate-catalog-"));
    try {
      await mkdir(path.join(tempRoot, "config"), { recursive: true });
      const raw = await readFile(
        path.join(REPO_ROOT, "config/persistent-agent-orchestra.evals.json"),
        "utf8",
      );
      await writeFile(
        path.join(tempRoot, "config/persistent-agent-orchestra.evals.json"),
        raw.replace(
          '"schema_version": 1,',
          '"schema_version": 1,\n  "schema_version": 1,',
        ),
        "utf8",
      );

      await expect(createRunReceipt({ rootDir: tempRoot, now: FIXED_NOW })).rejects.toThrow(
        /duplicate JSON key/i,
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects duplicate keys in canonical report-validation inputs", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zenflow-orchestra-duplicate-registry-"));
    try {
      await mkdir(path.join(tempRoot, "config"), { recursive: true });
      const rawRegistry = await readFile(
        path.join(REPO_ROOT, "config/persistent-agent-orchestra.json"),
        "utf8",
      );
      await writeFile(
        path.join(tempRoot, "config/persistent-agent-orchestra.json"),
        rawRegistry.replace(
          '"schema_version": 2,',
          '"schema_version": 2,\n  "schema_version": 2,',
        ),
        "utf8",
      );
      await cp(
        path.join(REPO_ROOT, "config/persistent-agent-orchestra.evals.json"),
        path.join(tempRoot, "config/persistent-agent-orchestra.evals.json"),
      );
      const report = {
        schema_version: 1,
        status: "LOCAL_EVAL_STRUCTURE_UNVERIFIED",
        run_id: makeRunReceipt().run_id,
        run_receipt: makeRunReceipt(),
        attempts: [],
        limitations: ["Synthetic boundary probe; no semantic or runtime claim."],
      };

      const result = await validateEvalReport({ rootDir: tempRoot, report, now: FIXED_NOW });

      expect(result.errors.join("\n")).toMatch(/duplicate JSON key/i);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("binds the strict JSON and secure-read validators into the proof manifest", async () => {
    const manifest = await buildCurrentArtifactManifest(REPO_ROOT);
    const [
      secureRead,
      strictJson,
      assuranceProtocol,
      assuranceCore,
      assuranceRunner,
      ragCorpusManifest,
      toolTargets,
      pdiChecker,
      pdiCore,
      pdiConfig,
      pdiBaseline,
      pdiWaivers,
    ] = await Promise.all([
      readFile(path.join(REPO_ROOT, "scripts/persistent-agent-orchestra/secure-read.mjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/persistent-agent-orchestra/strict-json.mjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "docs/ai/TEN_LENS_EVIDENCE_ASSURANCE_V2_2_1.md"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/persistent-agent-orchestra/assurance-core.mjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/run-ten-lens-assurance.mjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/rag/corpus-manifest.json"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/codex-governance/tool-targets.cjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/check-production-data-integrity.cjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/production-data-integrity/core.cjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "config/production-data-integrity.json"), "utf8"),
      readFile(path.join(REPO_ROOT, "config/production-data-integrity-baseline.json"), "utf8"),
      readFile(path.join(REPO_ROOT, "config/production-data-integrity-waivers.json"), "utf8"),
    ]);

    expect(manifest.secure_read).toBe(sha256Text(secureRead));
    expect(manifest.strict_json).toBe(sha256Text(strictJson));
    expect(manifest.assurance_protocol).toBe(sha256Text(assuranceProtocol));
    expect(manifest.assurance_core).toBe(sha256Text(assuranceCore));
    expect(manifest.assurance_runner).toBe(sha256Text(assuranceRunner));
    expect(manifest.rag_corpus_manifest).toBe(sha256Text(ragCorpusManifest));
    expect(manifest.tool_targets).toBe(sha256Text(toolTargets));
    expect(manifest.production_data_integrity_checker).toBe(sha256Text(pdiChecker));
    expect(manifest.production_data_integrity_core).toBe(sha256Text(pdiCore));
    expect(manifest.production_data_integrity_config).toBe(sha256Text(pdiConfig));
    expect(manifest.production_data_integrity_baseline).toBe(sha256Text(pdiBaseline));
    expect(manifest.production_data_integrity_waivers).toBe(sha256Text(pdiWaivers));
  });

  it("does not let UNTRUSTED_PROJECT satisfy a trusted-project run", () => {
    const receipt = makeRunReceipt();
    receipt.project_trust = "UNTRUSTED_PROJECT";

    const result = validateRunReceipt(receipt, {
      now: FIXED_NOW,
      requireTrustedProject: true,
      expectedProjectRoot: REPO_ROOT,
      trustedProjectEvidence: {
        status: "VERIFIED",
        source: "CODEX_RUNTIME_TRUST_STORE",
        project_root: REPO_ROOT,
        observed_at: "2026-07-13T04:55:00.000Z",
        evidence_sha256: "e".repeat(64),
      },
    });

    expect(result.errors.join("\n")).toContain("TRUSTED_PROJECT required");
  });

  it("does not accept a self-typed TRUSTED_PROJECT value as provenance", () => {
    const receipt = makeRunReceipt();

    const result = validateRunReceipt(receipt, {
      now: FIXED_NOW,
      requireTrustedProject: true,
      expectedProjectRoot: REPO_ROOT,
      trustedProjectEvidence: {
        status: "VERIFIED",
        source: "CODEX_RUNTIME_TRUST_STORE",
        project_root: REPO_ROOT,
        observed_at: "2026-07-13T04:55:00.000Z",
        evidence_sha256: "e".repeat(64),
      },
    });

    expect(result.errors.join("\n")).toContain("external project-trust evidence required");
  });

  it("rejects duplicate scenario ids and self-promoted runtime evidence in a receipt", () => {
    const receipt = makeRunReceipt();
    receipt.scenario_ids = ["role01-scope-preservation", "role01-scope-preservation"];
    receipt.runtime.effective_permissions = "PASS";
    receipt.runtime.unexpected = "trusted";

    const result = validateRunReceipt(receipt, { now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("run receipt scenario_ids contains duplicate value");
    expect(result.errors.join("\n")).toContain(
      "run receipt runtime.effective_permissions must remain UNVERIFIED",
    );
    expect(result.errors.join("\n")).toContain("run receipt runtime has unknown field");
  });

  it("keeps local Git state explicitly observed but unauthenticated", () => {
    const receipt = makeRunReceipt();
    receipt.git_observation.status = "VERIFIED";
    receipt.git_observation.worktree_state = "PRISTINE";

    const result = validateRunReceipt(receipt, { now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain(
      "run receipt git_observation.status must remain OBSERVED_UNVERIFIED",
    );
    expect(result.errors.join("\n")).toContain(
      "run receipt git_observation.worktree_state must be CLEAN, DIRTY, or UNKNOWN",
    );
  });

  it("rejects impossible calendar dates", () => {
    const receipt = makeRunReceipt();
    receipt.created_at = "2026-02-31T05:00:00.000Z";

    const result = validateRunReceipt(receipt, {
      now: FIXED_NOW,
      requireTrustedProject: true,
    });

    expect(result.errors.join("\n")).toContain("invalid created_at");
  });

  it.each([
    ["human review", { human_review_status: "HUMAN_REVIEWED" }, "forbidden self-attestation"],
    ["effective permissions", { effective_permissions: "READ_ONLY_CONFIRMED" }, "forbidden self-attestation"],
    ["runtime pass", { runtime_status: "PASS" }, "forbidden self-attestation"],
  ])("rejects agent-authored %s", (_label, injected, message) => {
    const candidate = { ...makeCandidate(), ...injected };

    expect(validateCandidateEnvelope(candidate).errors.join("\n")).toContain(message);
  });

  it("rejects supported human or locale claims without external evidence", () => {
    const candidate = makeCandidate();
    candidate.claims.push({
      type: "LOCALE_ACCEPTANCE",
      scope: "all Arabic and Hebrew users",
      status: "SUPPORTED",
      evidence_refs: [],
    });

    expect(validateCandidateEnvelope(candidate).errors.join("\n")).toContain(
      "candidate claims must remain UNVERIFIED",
    );
  });

  it("requires scenario-specific structured self-reflection instead of a generic compliance sentence", () => {
    const candidate = makeCandidate();
    candidate.self_reflection = {
      strongest_counterevidence: {
        claim: "Something might be wrong with this answer.",
        evidence_refs: [0],
      },
      possible_omission: "I may have missed something important.",
      decision_change_condition: "I would change my answer if new evidence appeared.",
      unchecked_evidence: ["Some evidence was not checked."],
      confidence_boundary: "I followed the requested format correctly.",
    };

    expect(validateCandidateEnvelope(candidate).errors.join("\n")).toContain(
      "self_reflection must name the exact scenario_id",
    );
  });

  it("accepts a complete candidate-owned outcome inventory without treating it as adjudication", () => {
    const candidate = makeCandidate();

    expect(validateCandidateEnvelope(candidate).errors).toEqual([]);
    expect(candidate.outcome_assessments.every((item) => item.status === "UNVERIFIED")).toBe(true);
  });

  it("rejects a high-risk finding self-marked resolved", () => {
    const candidate = makeCandidate();
    candidate.findings[0].severity = "HIGH";
    candidate.findings[0].status = "RESOLVED";

    expect(validateCandidateEnvelope(candidate).errors.join("\n")).toContain(
      "candidate finding status",
    );
  });

  it("rejects GO while a critical finding remains UNVERIFIED", () => {
    const candidate = makeCandidate();
    candidate.decision = "GO";
    candidate.findings[0].severity = "CRITICAL";
    candidate.findings[0].status = "UNVERIFIED";

    expect(validateCandidateEnvelope(candidate).errors.join("\n")).toContain(
      "GO is forbidden with an open or unverified high or critical finding",
    );
  });

  it("rejects evidence references outside the candidate evidence array", () => {
    const candidate = makeCandidate();
    candidate.findings[0].evidence_refs = [999];

    expect(validateCandidateEnvelope(candidate).errors.join("\n")).toContain(
      "evidence_refs contains out-of-range index: 999",
    );
  });

  it("rejects a handoff self-marked complete", () => {
    const candidate = makeCandidate();
    candidate.handoffs.push({
      owner: "qualified-human-reviewer",
      reason: "Review sensitive claim",
      status: "COMPLETED",
    });

    expect(validateCandidateEnvelope(candidate).errors.join("\n")).toContain(
      "candidate handoff status",
    );
  });

  it("detects an identical generic answer reused across scenarios", () => {
    const raw = JSON.stringify(makeCandidate());
    const result = detectDuplicateCandidateOutputs([
      { scenario_id: "role02-feature-existence", raw_output: raw },
      { scenario_id: "role02-pressure-rejection", raw_output: raw },
    ]);

    expect(result.errors.join("\n")).toContain("duplicate candidate output");
  });

  it("detects substantive template reuse even when invocation identity fields differ", () => {
    const first = makeCandidate();
    const secondScenarioId = "role02-pressure-rejection";
    const second = JSON.parse(
      JSON.stringify(first).replaceAll(first.scenario_id, secondScenarioId),
    );
    second.scenario_id = secondScenarioId;
    second.attempt_id = "attempt-002-abcdef012345";
    second.attempt_nonce = "000000020123456789abcdef01234567";
    const result = detectDuplicateCandidateOutputs([
      { scenario_id: first.scenario_id, raw_output: JSON.stringify(first) },
      { scenario_id: second.scenario_id, raw_output: JSON.stringify(second) },
    ]);

    expect(result.errors.join("\n")).toContain("substantive candidate template reused");
  });

  it("rejects multiple attempts for one scenario and duplicate nonces", async () => {
    const report = await makeEvalReport();
    const duplicate = structuredClone(report.attempts[0]);
    duplicate.attempt_id = `${duplicate.attempt_id}-retry`;
    duplicate.raw_output = JSON.stringify({
      ...duplicate.candidate,
      scope: `${duplicate.candidate.scope} Retried after seeing the first output.`,
      self_reflection: {
        ...duplicate.candidate.self_reflection,
        possible_omission: `${duplicate.candidate.self_reflection.possible_omission} This is a second attempt.`,
      },
    });
    duplicate.raw_output_sha256 = sha256Text(duplicate.raw_output);
    duplicate.candidate = JSON.parse(duplicate.raw_output);
    report.attempts.push(duplicate);

    const result = await validateEvalReport({ rootDir: REPO_ROOT, report, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("duplicate scenario attempt");
    expect(result.errors.join("\n")).toContain("duplicate nonce");
  });

  it("binds the candidate decision to the scenario's declared decision class", async () => {
    const report = await makeEvalReport();
    const negativeAttempt = report.attempts.find((attempt) =>
      attempt.scenario_id.endsWith("scope-preservation"),
    );
    negativeAttempt.candidate.decision = "GO";
    negativeAttempt.raw_output = JSON.stringify(negativeAttempt.candidate);
    negativeAttempt.raw_output_sha256 = sha256Text(negativeAttempt.raw_output);

    const result = await validateEvalReport({ rootDir: REPO_ROOT, report, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain(
      "candidate decision GO is not allowed by scenario expected_decisions",
    );
  });

  it("rejects a report attempt that omits one required or forbidden scenario outcome", async () => {
    const report = await makeEvalReport();
    const attempt = report.attempts[0];
    attempt.candidate.outcome_assessments.pop();
    attempt.raw_output = JSON.stringify(attempt.candidate);
    attempt.raw_output_sha256 = sha256Text(attempt.raw_output);

    const result = await validateEvalReport({ rootDir: REPO_ROOT, report, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain(
      "candidate outcome_assessments must exactly cover scenario required and forbidden outcomes",
    );
  });

  it("rejects a replayed candidate whose run, attempt, or nonce echo is stale", async () => {
    const report = await makeEvalReport();
    const attempt = report.attempts[0];
    attempt.candidate.attempt_nonce = "ffffffffffffffffffffffffffffffff";
    attempt.candidate.run_id = "stale-run-identity";
    attempt.raw_output = JSON.stringify(attempt.candidate);
    attempt.raw_output_sha256 = sha256Text(attempt.raw_output);

    const result = await validateEvalReport({ rootDir: REPO_ROOT, report, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("candidate run_id mismatch");
    expect(result.errors.join("\n")).toContain("candidate attempt_nonce mismatch");
  });
});

describe("Ten-Lens Evidence Assurance v2.2.1 + E1", function () {
  it("exposes a read-only contract check CLI", function () {
    const run = spawnSync(process.execPath, [
      "scripts/run-ten-lens-assurance.mjs",
      "--check-contract",
    ], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(run.status).toBe(0);
    const output = JSON.parse(run.stdout);
    expect(output.status).toBe("STRUCTURAL_CONTRACT_VALID");
    expect(output.protocol_version).toBe("2.2.1-e1");
    expect(output.assurance_build_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(output.assurance_build_artifact_count).toBe(ASSURANCE_BUILD_ARTIFACT_PATHS.length);
    expect(output.superiority_status).toBe("CANDIDATE_CORE_IMPLEMENTED_RUNTIME_AND_SUPERIORITY_UNVERIFIED");
  });

  it("reproducibly hashes the exact assurance implementation artifact set", async function () {
    const first = await buildAssuranceImplementationIdentity(REPO_ROOT);
    const second = await buildAssuranceImplementationIdentity(REPO_ROOT);
    expect(second).toEqual(first);
    expect(first.artifact_paths).toEqual(ASSURANCE_BUILD_ARTIFACT_PATHS);
    expect(first.assurance_build_sha256).not.toBe(ASSURANCE_SNAPSHOT_HASH);
    const cli = spawnSync(process.execPath, [
      "scripts/run-ten-lens-assurance.mjs",
      "--assurance-build",
    ], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(cli.status).toBe(0);
    expect(JSON.parse(cli.stdout)).toEqual(first);

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ten-lens-build-"));
    try {
      for (const artifactPath of ASSURANCE_BUILD_ARTIFACT_PATHS) {
        await mkdir(path.dirname(path.join(tempRoot, artifactPath)), { recursive: true });
        await cp(path.join(REPO_ROOT, artifactPath), path.join(tempRoot, artifactPath));
      }
      const before = await buildAssuranceImplementationIdentity(tempRoot);
      const registryPath = path.join(tempRoot, "config/persistent-agent-orchestra.json");
      const registryText = await readFile(registryPath, "utf8");
      await writeFile(registryPath, `${registryText}\n`, "utf8");
      const after = await buildAssuranceImplementationIdentity(tempRoot);
      expect(after.assurance_build_sha256).not.toBe(before.assurance_build_sha256);
      await writeFile(registryPath, registryText, "utf8");
      const ragPath = path.join(tempRoot, "scripts/rag/preflight.ts");
      const ragText = await readFile(ragPath, "utf8");
      await writeFile(ragPath, `${ragText}\n`, "utf8");
      const afterRagChange = await buildAssuranceImplementationIdentity(tempRoot);
      expect(afterRagChange.assurance_build_sha256).not.toBe(before.assurance_build_sha256);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects caller-authored assurance build hashes and stale artifact inventories", function () {
    const arbitrary = validAssuranceManifest();
    arbitrary.assurance_build_sha256 = "f".repeat(64);
    expect(validateRunManifest(arbitrary).errors.join("\n")).toMatch(
      /does not match assurance build identity/i,
    );

    const stale = validAssuranceManifest();
    stale.assurance_build_identity.artifact_inventory[0].sha256 = "0".repeat(64);
    expect(validateRunManifest(stale).errors.join("\n")).toMatch(
      /artifact inventory hash does not match|identity hash does not match/i,
    );
  });

  it("exposes adaptive and rollback classification through the CLI", function () {
    const adaptive = spawnSync(process.execPath, [
      "scripts/run-ten-lens-assurance.mjs",
      "--classify",
      "--trigger",
      "AGENCY_PRESSURE_INTERRUPTION_RECOVERY",
    ], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(adaptive.status).toBe(0);
    expect(JSON.parse(adaptive.stdout)).toEqual(expect.objectContaining({
      routing_mode: "EVIDENCE_FIRST_ADAPTIVE",
      mandatory_role_ids: expect.arrayContaining([
        "psychology-human-factors-emotional-safety",
        "qa-evidence-release-verification",
      ]),
    }));

    const rollback = spawnSync(process.execPath, [
      "scripts/run-ten-lens-assurance.mjs",
      "--classify",
      "--trigger",
      "UI_ACCESSIBILITY_I18N",
      "--routing-mode",
      "FIXED_FULL_TEN",
    ], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(rollback.status).toBe(0);
    expect(JSON.parse(rollback.stdout).mandatory_phases).toHaveLength(20);
  });

  it("fails the contract CLI when a generated profile is missing", async function () {
    const tempRoot = await createContractCliWorkspace();
    try {
      await rm(
        path.join(tempRoot, ".codex/agents/02-psychology-human-factors-emotional-safety.toml"),
      );
      const run = spawnSync(process.execPath, [
        "scripts/run-ten-lens-assurance.mjs",
        "--check-contract",
      ], {
        cwd: tempRoot,
        encoding: "utf8",
      });
      expect(run.status).toBe(2);
      expect(run.stderr).toMatch(/missing|managed artifact/i);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("pins E1 precedence and selects only evidence-triggered M2 owners", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    expect(ASSURANCE_AGGREGATE_PRECEDENCE).toEqual([
      "INTEGRITY_FAILED",
      "BLOCKED",
      "NEEDS_AUTHORITY",
      "EXECUTION_INCOMPLETE",
      "AUTHORIZED_WITH_ACCEPTED_RISK",
      "COMPLETE_WITH_UNVERIFIED",
      "GO_FOR_PROVEN_SCOPE",
    ]);
    expect(registry.schema_version).toBe(2);
    expect(registry.assurance_protocol.version).toBe("2.2.1-e1");
    expect(registry.assurance_protocol.accepted_risk_status_aliases).toEqual({
      COMPLETE_WITH_ACCEPTED_RISK: "AUTHORIZED_WITH_ACCEPTED_RISK",
    });

    const result = classifyAssuranceTask(registry, [
      "GOVERNANCE_OR_ORCHESTRATION",
      "CONCRETE_EMOTIONAL_OR_CLINICAL_PRODUCT_CLAIM",
    ]);
    expect(result.task_class).toBe("M2_PROTECTED_HIGH_RISK");
    expect(result.considered_role_ids).toEqual(registry.roles.map((role) => role.id));
    expect(result.mandatory_role_ids).toEqual([
      "coordinator-teamlead",
      "qa-evidence-release-verification",
      "independent-blind-spot-sentinel",
      "logic-causality-state-coherence",
      "security-privacy-agent-trust",
      "psychology-human-factors-emotional-safety",
    ].sort());
    expect(result.mandatory_phases).toEqual([
      { role_id: "independent-blind-spot-sentinel", phase: "PASS_A" },
      { role_id: "psychology-human-factors-emotional-safety", phase: "CREATE_BRIEF" },
      { role_id: "logic-causality-state-coherence", phase: "INITIAL_REVIEW" },
      { role_id: "security-privacy-agent-trust", phase: "INITIAL_REVIEW" },
      { role_id: "psychology-human-factors-emotional-safety", phase: "INDEPENDENT_FINAL_REVIEW" },
      { role_id: "logic-causality-state-coherence", phase: "FINAL_REVIEW" },
      { role_id: "security-privacy-agent-trust", phase: "FINAL_REVIEW" },
      { role_id: "qa-evidence-release-verification", phase: "QA_CLOSURE" },
      { role_id: "independent-blind-spot-sentinel", phase: "PASS_B" },
    ]);
  });

  it("keeps the psychologist deep lifecycle without ritual all-ten fan-out", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const result = classifyAssuranceTask(registry, ["AGENCY_PRESSURE_INTERRUPTION_RECOVERY"]);
    expect(result.task_class).toBe("M1_MATERIAL");
    expect(result.considered_role_ids).toEqual(registry.roles.map((role) => role.id));
    expect(result.mandatory_role_ids).toEqual([
      "coordinator-teamlead",
      "qa-evidence-release-verification",
      "psychology-human-factors-emotional-safety",
    ].sort());
    expect(result.mandatory_phases).toEqual([
      { role_id: "psychology-human-factors-emotional-safety", phase: "CREATE_BRIEF" },
      { role_id: "psychology-human-factors-emotional-safety", phase: "INDEPENDENT_FINAL_REVIEW" },
      { role_id: "qa-evidence-release-verification", phase: "QA_CLOSURE" },
    ]);
  });

  it("does not select psychology for a proven mechanical repair", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const result = classifyAssuranceTask(registry, ["MECHANICAL_ONLY"]);

    expect(result.task_class).toBe("M0_MECHANICAL");
    expect(result.considered_role_ids).toEqual(registry.roles.map((role) => role.id));
    expect(result.mandatory_role_ids).toEqual([
      "coordinator-teamlead",
      "qa-evidence-release-verification",
    ]);
    expect(result.mandatory_phases).toEqual([
      { role_id: "qa-evidence-release-verification", phase: "DETERMINISTIC_REVIEW" },
    ]);
  });

  it("fails closed on an unknown routing trigger", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    expect(function unknownTrigger() {
      return classifyAssuranceTask(registry, ["UNREGISTERED_ROUTING_TRIGGER"]);
    }).toThrow(/unknown assurance trigger/i);
  });

  it("uses full council only for explicit deep audit and supports fixed-full-ten rollback", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const adaptive = classifyAssuranceTask(registry, ["DEEP_AUDIT"]);
    const rollback = classifyAssuranceTask(
      registry,
      ["CONCRETE_EMOTIONAL_OR_CLINICAL_PRODUCT_CLAIM"],
      { routingMode: "FIXED_FULL_TEN" },
    );
    const fixedMechanical = classifyAssuranceTask(
      registry,
      ["MECHANICAL_ONLY"],
      { routingMode: "FIXED_FULL_TEN" },
    );

    expect(adaptive.routing_mode).toBe("EVIDENCE_FIRST_ADAPTIVE");
    expect(adaptive.mandatory_role_ids).toEqual(registry.roles.map((role) => role.id));
    expect(adaptive.mandatory_phases.length).toBeLessThan(20);
    expect(rollback.routing_mode).toBe("FIXED_FULL_TEN");
    expect(rollback.mandatory_role_ids).toEqual(registry.roles.map((role) => role.id));
    expect(rollback.mandatory_phases).toHaveLength(20);
    expect(fixedMechanical.mandatory_role_ids).toEqual([
      "coordinator-teamlead",
      "qa-evidence-release-verification",
    ]);
    expect(fixedMechanical.mandatory_phases).toHaveLength(1);
  });

  it("encodes isolated Role 2 phases and preserves Role 4 and Role 9 ownership", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const role2 = registry.roles[1];
    expect(role2.name).toBe("User Psychology, Motivational Design, Human Factors & Emotional Safety");
    expect(Object.keys(role2.phase_contracts)).toEqual([
      "CREATE_BRIEF",
      "INDEPENDENT_FINAL_REVIEW",
    ]);
    expect(role2.phase_contracts.INDEPENDENT_FINAL_REVIEW.fresh_invocation_required).toBe(true);
    expect(role2.does_not_own.join("\n")).toMatch(/WCAG|RTL|locale|cultural/i);
    expect(registry.roles[3].owns.join("\n")).toMatch(/WCAG|RTL|bidi/i);
    expect(registry.roles[8].owns.join("\n")).toMatch(/failure|value|kill/i);
  });

  it("covers both Role 2 phases in the structural eval catalog", async function () {
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
    const role2Text = JSON.stringify(catalog.scenarios.filter(function role2Scenario(scenario) {
      return scenario.role_id === "psychology-human-factors-emotional-safety";
    }));
    expect(role2Text).toContain("CREATE_BRIEF");
    expect(role2Text).toContain("INDEPENDENT_FINAL_REVIEW");
  });

  it("records OpenAI eval deprecation without canonical hosted storage", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const source = registry.source_review.sources.find(function (item) {
      return item.id === "openai-evaluation-best-practices";
    });
    expect(source.document_status).toBe("CURRENT_WITH_DEPRECATION_WATCH");
    expect(source.evidence_role).toBe("IMPLEMENTATION_GUIDANCE");
    expect(source.legacy_evals_platform).toBe("DEPRECATED_TRANSITION");
    expect(source.read_only_date).toBe("2026-10-31");
    expect(source.shutdown_date).toBe("2026-11-30");
    expect(registry.assurance_protocol.evaluation.canonical_storage).toBe(
      "PORTABLE_REPOSITORY_LOCAL_ARTIFACTS",
    );
  });

  it("keeps institutional guidance distinct from normative WCAG", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    for (const sourceId of [
      "who-responsible-ai-mental-health",
      "w3c-cognitive-accessibility",
      "w3c-involving-users",
    ]) {
      const source = registry.source_review.sources.find(function matchingSource(item) {
        return item.id === sourceId;
      });
      expect(source.authority_type).toBe("INFORMATIVE_INSTITUTIONAL_GUIDANCE");
    }
    expect(registry.source_review.sources.find(function wcagSource(item) {
      return item.id === "w3c-wcag-22";
    }).authority_type).toBe("NORMATIVE_STANDARD");
  });

  it("rejects GO with an owned blocking UNVERIFIED claim", function () {
    const receipt = validAssuranceReceipt();
    receipt.claims[0].assurance_status = "UNVERIFIED";
    receipt.claims[0].evidence_ids = [];
    receipt.proven_scope_ids = [];
    receipt.unverified_scope_ids = ["qa.evidence"];
    expect(validateRoleReceipt(receipt, validAssuranceManifest()).errors.join("\n")).toMatch(
      /GO.*owned blocking scope remains UNVERIFIED/i,
    );
  });

  it("rejects Role 2 ownership of WCAG or locale scopes", function () {
    const manifest = validEmotionalAssuranceManifest();
    const receipt = validAssuranceReceipt({
      task_class: "M1_MATERIAL",
      role_id: "psychology-human-factors-emotional-safety",
      runtime_identity: "zenflow-02-psychology-human-factors-emotional-safety",
      phase: "CREATE_BRIEF",
      phase_sequence: 1,
      scope_checked: ["wcag.conformance"],
      claims: [{
        claim_id: "role2-wcag-overreach",
        scope_id: "wcag.conformance",
        owned: true,
        blocking: true,
        assurance_status: "VERIFIED",
        evidence_ids: ["evidence-1"],
        dependency_hashes: assuranceDependencyHashes(),
        depends_on_claim_ids: [],
      }],
      proven_scope_ids: ["wcag.conformance"],
    });
    expect(validateRoleReceipt(receipt, manifest).errors.join("\n")).toMatch(/owned scope|ownership/i);
  });

  it("binds the run manifest to the risk registry and exact phase plan", function () {
    const manifest = validAssuranceManifest();
    expect(validateRunManifest(manifest).errors).toEqual([]);
    manifest.classification_registry_digest = null;
    expect(validateRunManifest(manifest).errors.join("\n")).toMatch(/classification_registry_digest/i);
  });

  it("binds local source discovery to the request, locators, and resolved scope", function () {
    const manifest = validAssuranceManifest();
    manifest.scope_derivation_evidence.discovery_commands = [];
    manifest.scope_derivation_evidence.evidence_locators_sha256 = "0".repeat(64);
    expect(validateRunManifest(manifest).errors.join("\n")).toMatch(
      /discovery_commands must not be empty|locator hash does not match/i,
    );
  });

  it("rejects a manifest that excludes a role without routing evidence", function () {
    const manifest = validAssuranceManifest();
    const excluded = manifest.role_considerations.find(function excludedRole(item) {
      return item.disposition === "EXCLUDED";
    });
    excluded.evidence_locators = [];

    expect(validateRunManifest(manifest).errors.join("\n")).toMatch(
      /role_considerations.*evidence_locators must not be empty/i,
    );
  });

  it("rejects a self-declared M1 manifest for an M2 governance trigger", function () {
    const manifest = validAssuranceManifest({
      observed_trigger_ids: ["GOVERNANCE_OR_ORCHESTRATION"],
    });
    expect(validateRunManifest(manifest).errors.join("\n")).toMatch(/classified M2|mandatory_role_ids/i);
  });

  it("derives protected governance triggers from affected repository paths", function () {
    const manifest = validEmotionalAssuranceManifest();
    manifest.affected_paths = ["config/persistent-agent-orchestra.json"];
    expect(validateRunManifest(manifest).errors.join("\n")).toMatch(
      /missing derived trigger GOVERNANCE_OR_ORCHESTRATION|classified M2/i,
    );
  });

  it("derives protected governance triggers from symbols and declared effect categories", function () {
    const protectedSymbol = validAssuranceManifest();
    protectedSymbol.affected_symbols = ["validateRunManifest"];
    expect(validateRunManifest(protectedSymbol).errors.join("\n")).toMatch(
      /missing derived trigger GOVERNANCE_OR_ORCHESTRATION|classified M2/i,
    );

    const protectedCategory = validAssuranceManifest();
    protectedCategory.affected_permission_changes = ["SANDBOX"];
    expect(validateRunManifest(protectedCategory).errors.join("\n")).toMatch(
      /missing derived trigger GOVERNANCE_OR_ORCHESTRATION|classified M2/i,
    );
  });

  it("requires every canonical platform and domain matrix row", function () {
    const manifest = validAssuranceManifest();
    delete manifest.platform_domain_matrix.IOS;
    expect(validateRunManifest(manifest).errors.join("\n")).toMatch(
      /platform_domain_matrix.*every canonical platform\/domain key/i,
    );
  });

  it("requires an allowlisted transformation for M0", function () {
    const manifest = validAssuranceManifest();
    manifest.m0_transformation_id = "UNDECLARED_MECHANICAL_SHORTCUT";
    expect(validateRunManifest(manifest).errors.join("\n")).toMatch(
      /m0_transformation_id/i,
    );
  });

  it("rejects a platform matrix that contradicts an affected release surface", function () {
    const manifest = validAssuranceManifest();
    manifest.affected_release_surfaces = ["ANDROID"];
    manifest.scope_derivation_evidence.resolved_scope_sha256 = sha256Canonical({
      affected_paths: manifest.affected_paths,
      affected_routes: manifest.affected_routes,
      affected_symbols: manifest.affected_symbols,
      affected_stores: manifest.affected_stores,
      affected_schemas: manifest.affected_schemas,
      affected_data_flows: manifest.affected_data_flows,
      affected_capabilities: manifest.affected_capabilities,
      affected_data_effects: manifest.affected_data_effects,
      affected_external_actions: manifest.affected_external_actions,
      affected_schema_changes: manifest.affected_schema_changes,
      affected_permission_changes: manifest.affected_permission_changes,
      affected_release_surfaces: manifest.affected_release_surfaces,
      platform_domain_matrix: manifest.platform_domain_matrix,
    });
    expect(validateRunManifest(manifest).errors.join("\n")).toMatch(
      /affected release surface ANDROID must be IN_SCOPE/i,
    );
  });

  it("requires M2 initial reviews to bind the earlier blind Pass A", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const manifest = validGovernanceAssuranceManifest();
    expect(function missingPassADependency() {
      return createSpecialistPacket({
        registry,
        manifest,
        inputDataClassification: "REDACTED_TASK_METADATA",
        roleId: "logic-causality-state-coherence",
        phase: "INITIAL_REVIEW",
        questionOwned: "Check governance state coherence",
        evidenceLocators: ["config/persistent-agent-orchestra.json"],
        phaseDependencyReceipts: {},
      });
    }).toThrow(/PASS_A|phase dependency|parent/i);
  });

  it("fails malformed manifest linkage closed without throwing", function () {
    const manifest = validAssuranceManifest();
    delete manifest.required_receipt_keys;
    expect(function validateMalformedManifest() {
      return validateRoleReceipt(validAssuranceReceipt(), manifest);
    }).not.toThrow();
    expect(validateRoleReceipt(validAssuranceReceipt(), manifest).errors.join("\n")).toMatch(
      /required_receipt_keys/i,
    );
  });

  it("fails malformed nested receipt fields closed without throwing", function () {
    const receipt = validAssuranceReceipt();
    delete receipt.claims[0].evidence_ids;
    expect(function validateMalformedReceipt() {
      return validateRoleReceipt(receipt, validAssuranceManifest());
    }).not.toThrow();
    expect(validateRoleReceipt(receipt, validAssuranceManifest()).errors.join("\n")).toMatch(
      /evidence_ids/i,
    );
  });

  it("rejects claims that reference absent evidence records", function () {
    const receipt = validAssuranceReceipt();
    receipt.claims[0].evidence_ids = ["missing-evidence"];
    expect(validateRoleReceipt(receipt, validAssuranceManifest()).errors.join("\n")).toMatch(
      /missing evidence_id/i,
    );
  });

  it("requires every claim to bind the complete canonical dependency set", function () {
    const receipt = validAssuranceReceipt();
    receipt.claims[0].dependency_hashes = { policy: ASSURANCE_POLICY_HASH };
    expect(validateRoleReceipt(receipt, validAssuranceManifest()).errors.join("\n")).toMatch(
      /exactly the canonical dependencies/i,
    );
  });

  it("rejects a runtime identity that does not match the canonical role", function () {
    const receipt = validAssuranceReceipt({
      runtime_identity: "zenflow-02-psychology-human-factors-emotional-safety",
    });
    expect(validateRoleReceipt(receipt, validAssuranceManifest()).errors.join("\n")).toMatch(
      /runtime_identity does not match/i,
    );
  });

  it("keeps decision, assurance, execution, and closure orthogonal", function () {
    const receipt = validAssuranceReceipt({ decision: "STOP", closure_status: "OPEN" });
    receipt.findings = ["finding-1"];
    expect(validateRoleReceipt(receipt, validAssuranceManifest()).errors).toEqual([]);
    expect(receipt.assurance_status).toBe("VERIFIED");
    expect(receipt.execution.mode).toBe("AUTOMATED");
    expect(receipt.execution.state).toBe("VALIDATED");
    expect(receipt.execution.result).toBe("PASS");
  });

  it("never promotes structurally self-attested receipts to proven scope", function () {
    const receipt = validAssuranceReceipt();
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(/promotion gate|independently authenticated/i);
  });

  it("emits a strict §10.6 assurance report for every aggregate result", function () {
    const receipt = validAssuranceReceipt();
    const input = {
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    };
    const result = aggregateAssuranceRun(input);
    expect(result.assurance_report).toMatchObject({
      schema_version: "zenflow-ten-lens-assurance-report-v2.2.1-e1",
      aggregated_run_status: result.status,
      promotion_status: result.status,
    });
    expect(result.assurance_report.requirement_to_proof_mapping).toHaveLength(2);
    expect(result.assurance_report.all_ten_coverage).toHaveLength(10);
    expect(result.assurance_report.all_ten_coverage.every(function evidenceBacked(item) {
      return ["SELECTED", "EXCLUDED"].includes(item.routing_disposition) &&
        item.routing_evidence_locators.length > 0;
    })).toBe(true);
    expect(validateAssuranceReport(result.assurance_report, input).errors).toEqual([]);
  });

  it("sanitizes forged input requirement mappings before emitting the report", function () {
    const receipt = validAssuranceReceipt();
    const input = {
      manifest: validAssuranceManifest(), receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(), evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(), requiredReceiptKeys: [assuranceReceiptKey(receipt)],
      requirementProofMapping: [{
        requirement: "Validate the contract state machine", status: "VERIFIED",
        evidence_ids: ["missing-evidence"], verification_path: "self-attested",
      }],
    };
    const result = aggregateAssuranceRun(input);
    expect(result.assurance_report.requirement_to_proof_mapping[0].status).toBe("UNVERIFIED");
    expect(validateAssuranceReport(result.assurance_report, input).errors).toEqual([]);
  });

  it("rejects forged VERIFIED requirement mappings absent from the evidence ledger", function () {
    const receipt = validAssuranceReceipt();
    const input = {
      manifest: validAssuranceManifest(), receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(), usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    };
    const result = aggregateAssuranceRun(input);
    result.assurance_report.requirement_to_proof_mapping[0] = {
      requirement: result.assurance_report.requirement_to_proof_mapping[0].requirement,
      status: "VERIFIED", evidence_ids: ["missing-evidence"],
      verification_path: "self-attested",
    };
    expect(validateAssuranceReport(result.assurance_report, input).errors.join("\n")).toMatch(
      /missing-evidence|global evidence ledger|RECHECKED/i,
    );
  });

  it("does not promote a complete but self-attested promotion gate", function () {
    const input = validMaterialAggregateInput();
    const result = aggregateAssuranceRun(input);
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(/rechecked scope discovery provenance/i);
  });

  it("rejects a trusted promotion gate whose QA closure hash is forged", function () {
    const input = validMaterialAggregateInput();
    input.promotionGate.qa_closure_receipt_hash = "0".repeat(64);
    const result = aggregateAssuranceRun(input, { verifyPromotionGate: function () { return true; } });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(/qa_closure_receipt_hash/i);
  });

  it("reaches GO_FOR_PROVEN_SCOPE only through a complete trusted promotion gate", function () {
    const input = validMaterialAggregateInput();
    const result = aggregateAssuranceRun(input, {
      verifyPromotionGate: function trustedStructuralControl(gate) {
        return gate.attestation === "TEST_ONLY_TRUSTED_PROMOTION_GATE";
      },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
      verifyQualityAdjudication: function trustedQualityControl() { return true; },
    });
    expect(result.status, result.reasons.join("\n")).toBe("GO_FOR_PROVEN_SCOPE");
    expect(validateAssuranceReport(result.assurance_report, input).errors).toEqual([]);
  });

  it("does not promote when required token counters are unavailable", function () {
    const input = validMaterialAggregateInput();
    for (const entry of input.usageLedger.entries) {
      entry.input_tokens = "UNAVAILABLE";
    }
    input.baselineComparison.candidate_usage_ledger_hash = sha256Canonical(input.usageLedger);
    const result = aggregateAssuranceRun(input, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
    });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(/measured candidate usage.*input_tokens/i);
  });

  it("does not promote a forged or unbound baseline usage hash", function () {
    const input = validMaterialAggregateInput();
    input.baselineComparison.baseline_usage_ledger_hash = "0".repeat(64);
    input.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: input.baselineComparison,
      baseline_usage_ledger: input.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(input.usageLedger),
    });
    const result = aggregateAssuranceRun(input, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
    });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(/baseline usage hash/i);
  });

  it("does not promote a baseline whose ledger violates its own fixed topology", function () {
    const input = validMaterialAggregateInput();
    input.baselineUsageLedger.entries.pop();
    input.baselineComparison.baseline_usage_ledger_hash = sha256Canonical(input.baselineUsageLedger);
    input.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: input.baselineComparison,
      baseline_usage_ledger: input.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(input.usageLedger),
    });
    const result = aggregateAssuranceRun(input, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
      verifyQualityAdjudication: function trustedQualityControl() { return true; },
    });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(/baseline usage.*required phases|FIXED_FULL_TEN topology/i);
  });

  it("does not promote reused assurance builds or mismatched subject base commits", function () {
    const reusedBuild = validMaterialAggregateInput();
    reusedBuild.baselineManifest.assurance_build_identity = structuredClone(
      reusedBuild.manifest.assurance_build_identity,
    );
    reusedBuild.baselineManifest.assurance_build_sha256 =
      reusedBuild.manifest.assurance_build_sha256;
    reusedBuild.baselineUsageLedger.manifest_sha256 = sha256Canonical(
      reusedBuild.baselineManifest,
    );
    reusedBuild.baselineUsageLedger.build_sha256 =
      reusedBuild.baselineManifest.assurance_build_sha256;
    reusedBuild.baselineComparison.baseline_manifest_sha256 = sha256Canonical(
      reusedBuild.baselineManifest,
    );
    reusedBuild.baselineComparison.baseline_usage_ledger_hash = sha256Canonical(
      reusedBuild.baselineUsageLedger,
    );
    reusedBuild.baselineComparison.baseline_build_sha256 =
      reusedBuild.baselineUsageLedger.build_sha256;
    reusedBuild.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: reusedBuild.baselineComparison,
      baseline_usage_ledger: reusedBuild.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(reusedBuild.usageLedger),
    });
    const reusedResult = aggregateAssuranceRun(reusedBuild, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
      verifyQualityAdjudication: function trustedQualityControl() { return true; },
    });
    expect(reusedResult.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(reusedResult.reasons.join("\n")).toMatch(/assurance builds must be distinct/i);

    const mismatchedBase = validMaterialAggregateInput();
    mismatchedBase.baselineManifest.subject_base_commit_oid = "c".repeat(40);
    mismatchedBase.baselineUsageLedger.manifest_sha256 = sha256Canonical(
      mismatchedBase.baselineManifest,
    );
    mismatchedBase.baselineComparison.baseline_manifest_sha256 = sha256Canonical(
      mismatchedBase.baselineManifest,
    );
    mismatchedBase.baselineComparison.baseline_usage_ledger_hash = sha256Canonical(
      mismatchedBase.baselineUsageLedger,
    );
    mismatchedBase.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: mismatchedBase.baselineComparison,
      baseline_usage_ledger: mismatchedBase.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(mismatchedBase.usageLedger),
    });
    const mismatchedBaseResult = aggregateAssuranceRun(mismatchedBase, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
      verifyQualityAdjudication: function trustedQualityControl() { return true; },
    });
    expect(mismatchedBaseResult.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(mismatchedBaseResult.reasons.join("\n")).toMatch(/share subject_base_commit_oid/i);
  });

  it("does not accept matching model sets with mixed per-arm distributions", function () {
    const input = validMaterialAggregateInput();
    input.usageLedger.entries[0].model = "test-only-model-b";
    input.usageLedger.entries[0].reasoning_effort = "test-only-reasoning-b";
    input.baselineUsageLedger.entries[0].model = "test-only-model-b";
    input.baselineUsageLedger.entries[0].reasoning_effort = "test-only-reasoning-b";
    input.baselineComparison.candidate_usage_ledger_hash = sha256Canonical(
      input.usageLedger,
    );
    input.baselineComparison.baseline_usage_ledger_hash = sha256Canonical(
      input.baselineUsageLedger,
    );
    input.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: input.baselineComparison,
      baseline_usage_ledger: input.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(input.usageLedger),
    });
    const result = aggregateAssuranceRun(input, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
      verifyQualityAdjudication: function trustedQualityControl() { return true; },
    });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(
      /exactly one model|exactly one reasoning effort/i,
    );
  });

  it("does not promote mismatched paired models or zero token improvement", function () {
    const modelMismatch = validMaterialAggregateInput();
    modelMismatch.baselineUsageLedger.entries[0].model = "different-test-only-model";
    modelMismatch.baselineComparison.baseline_usage_ledger_hash = sha256Canonical(
      modelMismatch.baselineUsageLedger,
    );
    modelMismatch.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: modelMismatch.baselineComparison,
      baseline_usage_ledger: modelMismatch.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(modelMismatch.usageLedger),
    });
    const mismatched = aggregateAssuranceRun(modelMismatch, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
    });
    expect(mismatched.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(mismatched.reasons.join("\n")).toMatch(/models must match/i);

    const noReduction = validMaterialAggregateInput();
    noReduction.baselineUsageLedger = structuredClone(noReduction.usageLedger);
    noReduction.baselineUsageLedger.run_id = "baseline-" + noReduction.manifest.run_id;
    for (const entry of noReduction.baselineUsageLedger.entries) {
      entry.run_id = noReduction.baselineUsageLedger.run_id;
      entry.cache_write_tokens = 1_000;
      entry.reasoning_tokens = 1_000;
    }
    noReduction.baselineComparison.baseline_usage_ledger_hash = sha256Canonical(
      noReduction.baselineUsageLedger,
    );
    noReduction.baselineComparison.token_change_percent = 0;
    noReduction.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: noReduction.baselineComparison,
      baseline_usage_ledger: noReduction.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(noReduction.usageLedger),
    });
    const unchanged = aggregateAssuranceRun(noReduction, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
    });
    expect(unchanged.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(unchanged.reasons.join("\n")).toMatch(/at least 5% measured total-token reduction/i);
  });

  it("does not promote a quality artifact with a new critical miss", function () {
    const input = validMaterialAggregateInput();
    input.baselineComparison.quality_adjudication.candidate_critical_misses = 1;
    input.promotionGate.quality_adjudication_sha256 = sha256Canonical(
      input.baselineComparison.quality_adjudication,
    );
    input.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: input.baselineComparison,
      baseline_usage_ledger: input.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(input.usageLedger),
    });
    const result = aggregateAssuranceRun(input, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
      verifyQualityAdjudication: function trustedQualityControl() { return true; },
    });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(/new critical misses/i);
  });

  it("does not launder an unrelated rechecked record as quality evidence", function () {
    const input = validMaterialAggregateInput();
    input.baselineComparison.quality_adjudication_evidence_ids = ["evidence-security-1"];
    input.baselineComparison.quality_adjudication.evidence_ids = ["evidence-security-1"];
    input.promotionGate.quality_adjudication_sha256 = sha256Canonical(
      input.baselineComparison.quality_adjudication,
    );
    input.promotionGate.paired_evaluation_sha256 = sha256Canonical({
      baseline_comparison: input.baselineComparison,
      baseline_usage_ledger: input.baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(input.usageLedger),
    });
    const result = aggregateAssuranceRun(input, {
      verifyPromotionGate: function trustedStructuralControl() { return true; },
      verifyScopeDiscovery: function trustedDiscoveryControl() { return true; },
      verifyQualityAdjudication: function trustedQualityControl() { return true; },
    });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
    expect(result.reasons.join("\n")).toMatch(/quality evidence kind/i);
  });

  it("maps ASK authority separately from incomplete execution", function () {
    const receipt = validAssuranceReceipt({ decision: "ASK", ask_kind: "AUTHORITY_DECISION" });
    receipt.ask = {
      missing: "qualified authority",
      resolution_path: "validate a scoped policy decision",
    };
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("NEEDS_AUTHORITY");
  });

  it("blocks a validated receipt whose execution result is FAIL", function () {
    const receipt = validAssuranceReceipt();
    receipt.execution.result = "FAIL";
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("keeps validated NO_ASSERTION execution incomplete", function () {
    const receipt = validAssuranceReceipt();
    receipt.execution.result = "NO_ASSERTION";
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("EXECUTION_INCOMPLETE");
  });

  it("does not let an aggregate caller omit manifest-required receipts", function () {
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [],
    });
    expect(result.status).toBe("INTEGRITY_FAILED");
    expect(result.reasons.join("\n")).toMatch(/missing mandatory receipt/i);
  });

  it("rejects arbitrary parent and previous receipt hashes", function () {
    const receipt = validAssuranceReceipt({
      parent_receipt_hashes: ["8".repeat(64)],
      previous_receipt_hash: "9".repeat(64),
    });
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("INTEGRITY_FAILED");
    expect(result.reasons.join("\n")).toMatch(/parent_receipt_hashes|previous_receipt_hash/i);
  });

  it("accepts an exact earlier receipt supplied through the history chain", function () {
    const priorReceipt = validAssuranceReceipt({
      attempt_nonce: "55555555-5555-4555-8555-555555555555",
      issued_at: "2026-07-20T00:01:00.000Z",
    });
    const receipt = validAssuranceReceipt({
      attempt_nonce: "66666666-6666-4666-8666-666666666666",
      issued_at: "2026-07-20T00:02:00.000Z",
      previous_receipt_hash: sha256Canonical(priorReceipt),
    });
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      priorReceipts: [priorReceipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("COMPLETE_WITH_UNVERIFIED");
  });

  it("fails malformed aggregate input closed without throwing", function () {
    expect(function malformedAggregate() {
      return aggregateAssuranceRun(null);
    }).not.toThrow();
    expect(aggregateAssuranceRun(null).status).toBe("INTEGRITY_FAILED");
  });

  it("rejects a finding ledger from another run", function () {
    const receipt = validAssuranceReceipt();
    const ledger = validAssuranceFindingLedger();
    ledger.run_id = "another-run";
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: ledger,
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("INTEGRITY_FAILED");
    expect(result.reasons.join("\n")).toMatch(/ledger run_id/i);
  });

  it("does not authenticate a self-attested authority decision", function () {
    const input = validAcceptedRiskAggregateInput();
    expect(aggregateAssuranceRun(input).status).toBe("NEEDS_AUTHORITY");
  });

  it("reaches authorized-with-accepted-risk only through a trusted verifier boundary", function () {
    const input = validAcceptedRiskAggregateInput();
    const result = aggregateAssuranceRun(input, {
      verifyAuthorityDecision: function trustedTestBoundary(decision) {
        return decision.authorization_validation_receipt === "e".repeat(64);
      },
    });
    expect(result.status).toBe("AUTHORIZED_WITH_ACCEPTED_RISK");
    expect(result.assurance_report.residual_risks).toHaveLength(1);
  });

  it("keeps an unresolved input blocker ahead of accepted-risk authority", function () {
    const receipt = validAssuranceReceipt({ decision: "ASK", ask_kind: "MISSING_INPUT" });
    receipt.ask = { missing: "current evidence", resolution_path: "supply and recheck evidence" };
    const authorityDecision = validAuthorityDecision();
    const ledger = validAssuranceFindingLedger({
      acceptedRisk: true,
      authorityDecisionHash: sha256Canonical(authorityDecision),
    });
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: ledger,
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
      authorityDecisions: [authorityDecision],
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("rejects an accepted-risk hash without its validated authority record", function () {
    const receipt = validAssuranceReceipt();
    const ledger = validAssuranceFindingLedger({
      acceptedRisk: true,
      authorityDecisionHash: "5".repeat(64),
    });
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: ledger,
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
      authorityDecisions: [],
    });
    expect(result.status).toBe("INTEGRITY_FAILED");
    expect(result.reasons.join("\n")).toMatch(/valid authority decision/i);
  });

  it("prevents a finding from starting below its immutable severity or scope", function () {
    const severityLedger = validAssuranceFindingLedger();
    severityLedger.findings[0].versions[0].severity = "LOW";
    expect(validateFindingLedger(
      severityLedger,
      validAssuranceEvidenceLedger(),
    ).errors.join("\n")).toMatch(/original_severity/i);

    const scopeLedger = validAssuranceFindingLedger({ blocking: true });
    scopeLedger.findings[0].versions[0].blocking_scope = ["replacement-scope"];
    expect(validateFindingLedger(
      scopeLedger,
      validAssuranceEvidenceLedger(),
    ).errors.join("\n")).toMatch(/original_blocking_scope/i);
  });

  it("requires every finding evidence ID to resolve in the hash-bound global ledger", function () {
    const ledger = validAssuranceFindingLedger();
    ledger.findings[0].original_evidence_ids = ["missing-global-evidence"];
    ledger.findings[0].versions[0].original_evidence_ids = ["missing-global-evidence"];
    expect(validateFindingLedger(
      ledger,
      validAssuranceEvidenceLedger(),
    ).errors.join("\n")).toMatch(/missing global evidence_id/i);
  });

  it("recomputes finding downgrade history and requires actual review receipts", function () {
    const ledger = validAssuranceFindingLedger({ blocking: true });
    const initialVersion = ledger.findings[0].versions[0];
    const downgraded = {
      ...initialVersion,
      version: 2,
      previous_version_hash: sha256Canonical(initialVersion),
      severity: "LOW",
      blocking_scope: [],
      evidence_resolution: "VERIFIED_RESOLVED",
      direct_recheck_current_snapshot: true,
      origin_role_reviewed: true,
      role8_verified: true,
      full_history_hash: sha256Canonical([initialVersion]),
      origin_role_receipt_hash: "8".repeat(64),
      role8_receipt_hash: "9".repeat(64),
      resolution_evidence_ids: ["evidence-security-1"],
    };
    ledger.findings[0].versions.push(downgraded);
    expect(validateFindingLedger(ledger, validAssuranceEvidenceLedger()).errors).toEqual([]);

    const receipt = validAssuranceReceipt();
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: ledger,
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("INTEGRITY_FAILED");
    expect(result.reasons.join("\n")).toMatch(/actual origin-role receipt|actual Role 8 receipt/i);

    downgraded.full_history_hash = "a".repeat(64);
    expect(validateFindingLedger(
      ledger,
      validAssuranceEvidenceLedger(),
    ).errors.join("\n")).toMatch(/full_history_hash does not match/i);
  });

  it("reopens downstream claims when a dependency changes", function () {
    const result = computeInvalidatedClaims([
      { claim_id: "source", dependency_hashes: { source: "1" }, depends_on_claim_ids: [] },
      { claim_id: "role2-final", dependency_hashes: { profile: "same" }, depends_on_claim_ids: ["source"] },
    ], { source: "2", profile: "same" });
    expect(result.invalidated_claim_ids).toEqual(["role2-final", "source"]);
    expect(result.reopened_closure_claim_ids).toContain("role2-final");
  });

  it("rejects an aggregate whose claim dependency no longer matches the manifest", function () {
    const receipt = validAssuranceReceipt();
    receipt.claims[0].dependency_hashes.profile_set = "9".repeat(64);
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("INTEGRITY_FAILED");
    expect(result.reasons.join("\n")).toMatch(/invalidated/i);
  });

  it("rejects cyclic claim dependencies", function () {
    const receipt = validAssuranceReceipt();
    receipt.claims = [
      {
        ...receipt.claims[0],
        claim_id: "claim-a",
        depends_on_claim_ids: ["claim-b"],
      },
      {
        ...receipt.claims[0],
        claim_id: "claim-b",
        depends_on_claim_ids: ["claim-a"],
      },
    ];
    const result = aggregateAssuranceRun({
      manifest: validAssuranceManifest(),
      receipts: [receipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(),
      requiredReceiptKeys: [assuranceReceiptKey(receipt)],
    });
    expect(result.status).toBe("INTEGRITY_FAILED");
    expect(result.reasons.join("\n")).toMatch(/dependency cycle/i);
  });

  it("separates a stable prompt prefix from dynamic evidence", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const manifest = validEmotionalAssuranceManifest();
    const packet = createSpecialistPacket({
      registry,
      manifest,
      inputDataClassification: "REDACTED_TASK_METADATA",
      roleId: "psychology-human-factors-emotional-safety",
      phase: "CREATE_BRIEF",
      questionOwned: "Review autonomy and return-after-break",
      evidenceLocators: ["src/pages/Index.tsx:1"],
    });
    expect(packet.prompt_cache_partition).toMatch(/2\.2\.1-e1.*psychology/i);
    expect(packet.stable_prefix).not.toContain("src/pages/Index.tsx");
    expect(packet.dynamic_suffix).toContain("src/pages/Index.tsx:1");
    expect(packet.packet_sha256).toBe(sha256Canonical({
      stable_prefix: packet.stable_prefix,
      dynamic_suffix: packet.dynamic_suffix,
    }));
  });

  it("rejects a specialist packet not declared by the run manifest", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    expect(function undeclaredPacket() {
      return createSpecialistPacket({
        registry,
        manifest: validAssuranceManifest(),
        inputDataClassification: "REDACTED_TASK_METADATA",
        roleId: "psychology-human-factors-emotional-safety",
        phase: "CREATE_BRIEF",
        questionOwned: "Review autonomy",
        evidenceLocators: ["config/persistent-agent-orchestra.json"],
      });
    }).toThrow(/manifest/i);
  });

  it("requires immutable CREATE_BRIEF linkage for Role 2 final review", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const manifest = validEmotionalAssuranceManifest();
    expect(function missingBriefHash() {
      return createSpecialistPacket({
        registry,
        manifest,
        inputDataClassification: "REDACTED_TASK_METADATA",
        roleId: "psychology-human-factors-emotional-safety",
        phase: "INDEPENDENT_FINAL_REVIEW",
        questionOwned: "Recheck emotional-safety criteria",
        evidenceLocators: ["config/persistent-agent-orchestra.json"],
        parentReceiptHashes: [],
      });
    }).toThrow(/CREATE_BRIEF|parent|phase dependency/i);

    const briefHash = "9".repeat(64);
    const packet = createSpecialistPacket({
      registry,
      manifest,
      inputDataClassification: "REDACTED_TASK_METADATA",
      roleId: "psychology-human-factors-emotional-safety",
      phase: "INDEPENDENT_FINAL_REVIEW",
      questionOwned: "Recheck emotional-safety criteria",
      evidenceLocators: ["config/persistent-agent-orchestra.json"],
      parentReceiptHashes: [briefHash],
    });
    expect(packet.dynamic_suffix).toContain(briefHash);
    expect(packet.dynamic_suffix).toContain("CREATE_BRIEF");
    expect(JSON.parse(packet.dynamic_suffix).phase_dependency_receipts).toEqual({
      "psychology-human-factors-emotional-safety:CREATE_BRIEF": briefHash,
    });

    const receipt = validAssuranceReceipt({
      task_class: "M1_MATERIAL",
      role_id: "psychology-human-factors-emotional-safety",
      runtime_identity: "zenflow-02-psychology-human-factors-emotional-safety",
      phase: "INDEPENDENT_FINAL_REVIEW",
      phase_sequence: 2,
      parent_receipt_hashes: [],
      question_owned: "Does the final delta preserve emotional-safety boundaries?",
      scope_checked: ["psychology.agency"],
      claims: [{
        claim_id: "role2-final-agency",
        scope_id: "psychology.agency",
        owned: true,
        blocking: true,
        assurance_status: "VERIFIED",
        evidence_ids: ["evidence-1"],
        dependency_hashes: assuranceDependencyHashes(),
        depends_on_claim_ids: [],
      }],
      proven_scope_ids: ["psychology.agency"],
    });
    expect(validateRoleReceipt(receipt, manifest).errors.join("\n")).toMatch(
      /CREATE_BRIEF|parent_receipt_hashes|phase_dependency_receipts/i,
    );
    receipt.parent_receipt_hashes = [briefHash];
    receipt.phase_dependency_receipts = {
      "psychology-human-factors-emotional-safety:CREATE_BRIEF": briefHash,
    };
    expect(validateRoleReceipt(receipt, manifest).errors).toEqual([]);
  });

  it("rejects coordinator-solution evidence from Role 10 Pass A by construction", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const manifest = validGovernanceAssuranceManifest();
    expect(function contaminatedPassA() {
      return createSpecialistPacket({
        registry,
        manifest,
        inputDataClassification: "REDACTED_TASK_METADATA",
        roleId: "independent-blind-spot-sentinel",
        phase: "PASS_A",
        questionOwned: "Discover pre-solution blind spots",
        evidenceLocators: [],
        evidenceRecords: [{
          evidence_class: "COORDINATOR_SOLUTION",
          locator: "coordinator-solution:proposed-answer",
        }],
      });
    }).toThrow(/Pass A|visibility|evidence class|forbidden/i);
  });

  it("builds closure packets with every canonical earlier phase dependency", async function () {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const manifest = validGovernanceAssuranceManifest();
    const passB = manifest.phase_plan.find(function isPassB(phase) { return phase.phase === "PASS_B"; });
    const dependencies = Object.fromEntries(
      manifest.phase_plan
        .filter(function earlier(phase) {
          return phase.sequence < passB.sequence;
        })
        .map(function dependency(phase) {
          return [`${phase.role_id}:${phase.phase}`, phase.sequence.toString(16).padStart(64, "0")];
        }),
    );
    const closureAudit = {
      original_scope_hash: manifest.original_scope_hash,
      pass_a_receipt_hash: dependencies["independent-blind-spot-sentinel:PASS_A"],
      receipt_manifest_hash: "a".repeat(64),
      evidence_ledger_hash: sha256Canonical(validAssuranceEvidenceLedger()),
      finding_ledger_hash: sha256Canonical(validAssuranceFindingLedger()),
      qa_closure_receipt_hash: dependencies["qa-evidence-release-verification:QA_CLOSURE"],
      pass_a_item_statuses: [{ item_id: "test-only-scope", status: "UNVERIFIED" }],
    };

    expect(function missingClosureDependencies() {
      return createSpecialistPacket({
        registry,
        manifest,
        inputDataClassification: "REDACTED_TASK_METADATA",
        roleId: "independent-blind-spot-sentinel",
        phase: "PASS_B",
        questionOwned: "Audit the final evidence packet",
        evidenceLocators: ["config/persistent-agent-orchestra.json"],
      });
    }).toThrow(/phase dependency|earlier/i);

    const packet = createSpecialistPacket({
      registry,
      manifest,
      inputDataClassification: "REDACTED_TASK_METADATA",
      roleId: "independent-blind-spot-sentinel",
      phase: "PASS_B",
      questionOwned: "Audit the final evidence packet",
      evidenceLocators: ["config/persistent-agent-orchestra.json"],
      phaseDependencyReceipts: dependencies,
      closureAudit,
    });
    const dynamic = JSON.parse(packet.dynamic_suffix);
    expect(dynamic.phase_dependency_receipts).toEqual(dependencies);
    expect(dynamic.closure_audit).toEqual(closureAudit);
    expect(dynamic.parent_receipt_hashes).toEqual(Object.values(dependencies));
  });

  it("refuses partial Role 2 history as a complete material run", function () {
    const manifest = validEmotionalAssuranceManifest();
    const brief = validRole2Receipt("CREATE_BRIEF", 1, {
      attempt_nonce: "11111111-1111-4111-8111-111111111111",
      issued_at: "2026-07-20T00:01:00.000Z",
    });
    const briefHash = sha256Canonical(brief);
    const finalReceipt = validRole2Receipt("INDEPENDENT_FINAL_REVIEW", 2, {
      attempt_nonce: "22222222-2222-4222-8222-222222222222",
      issued_at: "2026-07-20T00:02:00.000Z",
      parent_receipt_hashes: [briefHash],
      phase_dependency_receipts: {
        "psychology-human-factors-emotional-safety:CREATE_BRIEF": briefHash,
      },
    });
    const packet = {
      manifest,
      receipts: [finalReceipt],
      priorReceipts: [brief],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(manifest),
      requiredReceiptKeys: [assuranceReceiptKey(finalReceipt)],
    };
    const incomplete = aggregateAssuranceRun(packet);
    expect(incomplete.status).toBe("INTEGRITY_FAILED");
    expect(incomplete.reasons.join("\n")).toMatch(/caller required receipt keys|missing mandatory receipt/i);

    finalReceipt.phase_dependency_receipts[
      "psychology-human-factors-emotional-safety:CREATE_BRIEF"
    ] = "9".repeat(64);
    finalReceipt.parent_receipt_hashes = ["9".repeat(64)];
    const rejected = aggregateAssuranceRun(packet);
    expect(rejected.status).toBe("INTEGRITY_FAILED");
    expect(rejected.reasons.join("\n")).toMatch(/missing mandatory receipt|parent receipt hash/i);
  });

  it("rejects a QA closure issued before its required parent receipts", function () {
    const manifest = validEmotionalAssuranceManifest();
    const brief = validRole2Receipt("CREATE_BRIEF", 1, {
      attempt_nonce: "33333333-3333-4333-8333-333333333333",
      issued_at: "2026-07-20T00:02:00.000Z",
    });
    const briefHash = sha256Canonical(brief);
    const finalReceipt = validRole2Receipt("INDEPENDENT_FINAL_REVIEW", 2, {
      attempt_nonce: "44444444-4444-4444-8444-444444444444",
      issued_at: "2026-07-20T00:03:00.000Z",
      parent_receipt_hashes: [briefHash],
      phase_dependency_receipts: {
        "psychology-human-factors-emotional-safety:CREATE_BRIEF": briefHash,
      },
    });
    const finalHash = sha256Canonical(finalReceipt);
    const qaReceipt = validAssuranceReceipt({
      phase_sequence: 3,
      issued_at: "2026-07-20T00:01:00.000Z",
      parent_receipt_hashes: [briefHash, finalHash],
      phase_dependency_receipts: {
        "psychology-human-factors-emotional-safety:CREATE_BRIEF": briefHash,
        "psychology-human-factors-emotional-safety:INDEPENDENT_FINAL_REVIEW": finalHash,
      },
    });
    const result = aggregateAssuranceRun({
      manifest,
      receipts: [brief, finalReceipt, qaReceipt],
      findingLedger: validAssuranceFindingLedger(),
      evidenceLedger: validAssuranceEvidenceLedger(),
      usageLedger: validUsageLedger(manifest),
      requiredReceiptKeys: manifest.required_receipt_keys,
    });
    expect(result.status).toBe("INTEGRITY_FAILED");
    expect(result.reasons.join("\n")).toMatch(/issued before parent/i);
  });

  it("records unavailable usage without estimates", function () {
    const manifest = validAssuranceManifest();
    const ledger = {
      schema_version: "zenflow-ten-lens-usage-v2.2.1-e1",
      run_id: ASSURANCE_RUN_ID,
      manifest_sha256: sha256Canonical(manifest),
      build_sha256: manifest.assurance_build_sha256,
      registry_sha256: manifest.classification_registry_digest,
      routing_mode: manifest.routing_mode,
      direct_request_content_sha256: manifest.direct_request.content_sha256,
      subject_scoped_snapshot_sha256: ASSURANCE_SNAPSHOT_HASH,
      profile_set_hash: ASSURANCE_PROFILE_HASH,
      tool_inventory_hash: ASSURANCE_TOOL_INVENTORY_HASH,
      runtime_inventory_hash: manifest.runtime_inventory_hash,
      verification_plan_hash: manifest.verification_plan_hash,
      permission_scope_sha256: sha256Canonical(manifest.authority_write_scope),
      entries: [{
        run_id: ASSURANCE_RUN_ID,
        role_id: "psychology-human-factors-emotional-safety",
        phase: "DETERMINISTIC_REVIEW",
        model: "UNAVAILABLE",
        reasoning_effort: "UNAVAILABLE",
        requests: 1,
        input_tokens: "UNAVAILABLE",
        cached_input_tokens: "UNAVAILABLE",
        cache_write_tokens: "UNAVAILABLE",
        output_tokens: "UNAVAILABLE",
        reasoning_tokens: "UNAVAILABLE",
        tool_calls: 0,
        retries: 0,
        role_invocations: 1,
        peak_concurrency: 1,
        elapsed_ms: 25,
        actual_price_or_credits: "UNAVAILABLE",
      }],
    };
    ledger.entries[0].role_id = "qa-evidence-release-verification";
    expect(validateUsageLedger(ledger, { manifest }).errors).toEqual([]);
    expect(JSON.stringify(ledger)).not.toMatch(/estimate/i);

    expect(validateUsageLedger({ ...ledger, entries: [] }, { manifest }).errors.join("\n")).toMatch(
      /must not be empty|missing/i,
    );
    const rogue = structuredClone(ledger);
    rogue.entries[0].role_id = "rogue-role";
    rogue.entries[0].phase = "made-up";
    rogue.entries[0].run_id = "other-run";
    expect(validateUsageLedger(rogue, { manifest }).errors.join("\n")).toMatch(
      /canonical|manifest|run_id/i,
    );
  });

  it("fails closed on expired and out-of-scope authority", function () {
    const result = validateAuthorityDecision({
      schema_version: "zenflow-authority-decision-v2.2.1-e1",
      run_id: ASSURANCE_RUN_ID,
      authority_policy_version: "policy-v1",
      authority_policy_hash: ASSURANCE_POLICY_HASH,
      authority_id: "reviewer-1",
      authority_class: "ACCESSIBILITY_CONFORMANCE",
      authorized_decision_types: ["SCOPED_REVIEW_DECISION"],
      authorized_scopes: ["accessibility.checkout"],
      qualification_basis: "verified credential",
      credential_or_role_reference: "credential-ref",
      valid_from: "2026-07-01T00:00:00.000Z",
      valid_until: "2026-07-10T00:00:00.000Z",
      revocation_status: "ACTIVE",
      delegation_chain: [],
      independence_requirement: "INDEPENDENT",
      conflict_of_interest_status: "NONE_CHECKED",
      decision_type: "SCOPED_REVIEW_DECISION",
      decision_scope: "accessibility.settings",
      matched_authority_rule_id: "rule-1",
      qualification_scope: "accessibility.checkout",
      authorization_validation_receipt: "e".repeat(64),
    }, { now: new Date("2026-07-20T00:00:00.000Z") });
    expect(result.errors.join("\n")).toMatch(/expired|scope/i);
  });

  it("requires runtime-wide persistence channels for sensitive runs", function () {
    const names = [
      "CODEX_HISTORY", "CODEX_LOGS", "CODEX_OTEL", "AGENTS_SDK_TRACES",
      "SUBAGENT_STATE", "SHELL_LOGS", "CI_ARTIFACTS", "TEMPORARY_ARTIFACTS",
      "HOSTED_PRODUCT_RETENTION",
    ];
    const channels = names.map(function (runtimeChannel) {
      return assurancePersistenceChannel(runtimeChannel);
    });
    channels[0].configured_persistence = "none";
    expect(validateRuntimePersistenceInventory({
      schema_version: "zenflow-runtime-persistence-inventory-v2.2.1-e1",
      run_id: ASSURANCE_RUN_ID,
      sensitive_run: true,
      channels,
    }).errors).toEqual([]);

    channels[1].sensitive_data_allowed = true;
    channels[1].actual_probe_result = "UNVERIFIED";
    channels[1].evidence_status = "VERIFIED";
    expect(validateRuntimePersistenceInventory({
      schema_version: "zenflow-runtime-persistence-inventory-v2.2.1-e1",
      run_id: ASSURANCE_RUN_ID,
      sensitive_run: true,
      channels,
    }).errors.join("\n")).toMatch(/actual probe|sensitive run/i);
  });

  it("builds repository and scoped snapshot identities without absolute paths", async function () {
    const snapshot = await buildRepositorySnapshot({
      rootDir: REPO_ROOT,
      scopePaths: ["config/persistent-agent-orchestra.json", "scripts/persistent-agent-orchestra"],
    });
    const fields = [
      "repository_tracked_tree_oid",
      "repository_dirty_path_inventory_sha256",
      "repository_untracked_path_inventory_sha256",
      "critical_global_inputs_sha256",
      "dependency_closure_digest",
      "subject_scoped_snapshot_sha256",
      "diff_relevant_config_digest",
    ];
    for (const field of fields) expect(snapshot[field]).toMatch(/^[0-9a-f]{40,64}$/);
    expect(snapshot.snapshot_algorithm_version).toBe("zenflow-git-snapshot-v2.2.1-e1");
    expect(JSON.stringify(snapshot)).not.toContain(REPO_ROOT);
  });

  it("rejects a scoped snapshot path that crosses an intermediate symlink", async function () {
    await mkdir(path.join(REPO_ROOT, "output"), { recursive: true });
    const insideRoot = await mkdtemp(path.join(REPO_ROOT, "output", "ten-lens-link-"));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "ten-lens-outside-"));
    try {
      await writeFile(path.join(outsideRoot, "negative-control.txt"), "synthetic negative control");
      await symlink(outsideRoot, path.join(insideRoot, "outside-link"));
      const relativeScope = path.relative(
        REPO_ROOT,
        path.join(insideRoot, "outside-link", "negative-control.txt"),
      );
      await expect(buildRepositorySnapshot({
        rootDir: REPO_ROOT,
        scopePaths: [relativeScope],
      })).rejects.toThrow(/symlink parent/i);
    } finally {
      await rm(insideRoot, { recursive: true, force: true });
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("rejects a hardlinked file as scoped snapshot evidence", async function () {
    await mkdir(path.join(REPO_ROOT, "output"), { recursive: true });
    const tempRoot = await mkdtemp(path.join(REPO_ROOT, "output", "ten-lens-hardlink-"));
    try {
      const source = path.join(tempRoot, "source.txt");
      const alias = path.join(tempRoot, "alias.txt");
      await writeFile(source, "synthetic hardlink negative control");
      await link(source, alias);
      await expect(buildRepositorySnapshot({
        rootDir: REPO_ROOT,
        scopePaths: [path.relative(REPO_ROOT, alias)],
      })).rejects.toThrow(/hardlinked/i);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

function validAssuranceBuildIdentity(seed = "candidate") {
  const artifactInventory = ASSURANCE_BUILD_ARTIFACT_PATHS.map(function artifact(path) {
    return {
      path,
      type: "FILE",
      mode: 0o100644,
      size: seed.length,
      sha256: sha256Text(`${seed}:${path}`),
    };
  });
  const identity = {
    schema_version: "zenflow-assurance-build-identity-v1",
    artifact_paths: [...ASSURANCE_BUILD_ARTIFACT_PATHS],
    artifact_inventory: artifactInventory,
    artifact_inventory_sha256: sha256Canonical(artifactInventory),
  };
  return {
    ...identity,
    assurance_build_sha256: sha256Canonical(identity),
  };
}

function validAssuranceManifest(overrides = {}) {
  const assuranceBuildIdentity = validAssuranceBuildIdentity();
  return {
    schema_version: "zenflow-ten-lens-run-manifest-v2.2.1-e1",
    protocol_version: "2.2.1-e1",
    run_id: ASSURANCE_RUN_ID,
    run_nonce: ASSURANCE_RUN_NONCE,
    issued_at: "2026-07-20T00:00:00.000Z",
    phase_sequence: 1,
    expires_at: null,
    direct_request: {
      content_sha256: sha256Text("synthetic contract validation request"),
      locator: "test-only:synthetic-contract-request",
      quoted_evidence_separated: true,
      raw_private_content_included: false,
    },
    explicit_requirements: ["Validate the contract state machine"],
    implied_requirements: ["Fail closed on invalid evidence"],
    non_goals: ["No production or product-runtime mutation"],
    authority_write_scope: {
      readable_paths: ["config/persistent-agent-orchestra.json"],
      writable_paths: ["scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs"],
      external_actions: [],
      production_writes_allowed: false,
    },
    sensitive_run: false,
    pass_a_visibility_policy: {
      schema_version: "zenflow-pass-a-visibility-v2.2.1-e1",
      allowed_evidence_classes: [
        "RAW_DIRECT_REQUEST",
        "NEUTRAL_TRUSTED_POLICY",
        "PRE_SOLUTION_REPOSITORY_STATE",
      ],
      forbidden_locator_prefixes: [
        "coordinator-solution:",
        "coordinator-hypothesis:",
        "final-diff:",
        "prior-verdict:",
        "post-solution:",
      ],
    },
    original_scope_hash: sha256Canonical({
      direct_request: {
        content_sha256: sha256Text("synthetic contract validation request"),
        locator: "test-only:synthetic-contract-request",
        quoted_evidence_separated: true,
        raw_private_content_included: false,
      },
      explicit_requirements: ["Validate the contract state machine"],
      implied_requirements: ["Fail closed on invalid evidence"],
      non_goals: ["No production or product-runtime mutation"],
      authority_write_scope: {
        readable_paths: ["config/persistent-agent-orchestra.json"],
        writable_paths: ["scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs"],
        external_actions: [],
        production_writes_allowed: false,
      },
    }),
    task_class: "M0_MECHANICAL",
    m0_transformation_id: "FORMAT_ONLY_AST_EQUIVALENT",
    routing_mode: "EVIDENCE_FIRST_ADAPTIVE",
    classification_registry_version: "zenflow-risk-registry-v2.2.1-e1",
    classification_registry_digest: ASSURANCE_RISK_REGISTRY_DIGEST,
    observed_trigger_ids: ["MECHANICAL_ONLY"],
    mandatory_role_ids: [
      "coordinator-teamlead",
      "qa-evidence-release-verification",
    ],
    role_considerations: roleConsiderations([
      "coordinator-teamlead",
      "qa-evidence-release-verification",
    ]),
    subject_base_commit_oid: "a".repeat(40),
    head_oid: "a".repeat(40),
    repository_tracked_tree_oid: "b".repeat(40),
    repository_dirty_path_inventory_sha256: "4".repeat(64),
    repository_untracked_path_inventory_sha256: "5".repeat(64),
    critical_global_inputs_sha256: "6".repeat(64),
    scope_derivation_algorithm_version: "zenflow-repository-closure-v2.2.1-e1",
    scope_derivation_evidence: validScopeDerivationEvidence(),
    dependency_closure_digest: "7".repeat(64),
    snapshot_algorithm_version: "zenflow-git-snapshot-v2.2.1-e1",
    git_version: "git version test-only",
    diff_relevant_config_digest: "8".repeat(64),
    assurance_build_identity: assuranceBuildIdentity,
    assurance_build_sha256: assuranceBuildIdentity.assurance_build_sha256,
    subject_scoped_snapshot_sha256: ASSURANCE_SNAPSHOT_HASH,
    affected_paths: [],
    affected_routes: [],
    affected_symbols: ["testOnlyAssuranceFixture"],
    affected_stores: [],
    affected_schemas: [],
    affected_data_flows: [],
    affected_capabilities: [],
    affected_data_effects: [],
    affected_external_actions: [],
    affected_schema_changes: [],
    affected_permission_changes: [],
    affected_release_surfaces: [],
    platform_domain_matrix: validPlatformDomainMatrix(),
    policy_hash: ASSURANCE_POLICY_HASH,
    profile_set_hash: ASSURANCE_PROFILE_HASH,
    source_ledger_hash: ASSURANCE_SOURCE_LEDGER_HASH,
    schema_hash: ASSURANCE_SCHEMA_HASH,
    runtime_inventory_hash: ASSURANCE_RUNTIME_INVENTORY_HASH,
    tool_inventory_hash: ASSURANCE_TOOL_INVENTORY_HASH,
    model_reasoning_hash: ASSURANCE_MODEL_REASONING_HASH,
    verification_plan_hash: ASSURANCE_VERIFICATION_PLAN_HASH,
    model_reasoning_tool_inventory: { model: "UNAVAILABLE", reasoning_effort: "UNAVAILABLE", tools: [] },
    evidence_locators: ["scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs"],
    unknowns: ["runtime loading remains unverified"],
    dependency_hashes: assuranceDependencyHashes(),
    required_receipt_keys: ["qa-evidence-release-verification:DETERMINISTIC_REVIEW"],
    phase_plan: [{
      sequence: 1,
      role_id: "qa-evidence-release-verification",
      phase: "DETERMINISTIC_REVIEW",
    }],
    ...overrides,
  };
}

function validPlatformDomainMatrix() {
  return Object.fromEntries([
    "WEB_PWA",
    "ANDROID",
    "IOS",
    "DESKTOP",
    "STORE_RELEASE",
    "ACCESSIBILITY",
    "PERFORMANCE",
    "SECURITY_PRIVACY",
    "TESTING",
    "OPERATIONS",
    "AGENT_GOVERNANCE",
  ].map(function platformEntry(key) {
    const status = ["TESTING", "AGENT_GOVERNANCE"].includes(key) ? "IN_SCOPE" : "OUT_OF_SCOPE";
    return [key, {
      status,
      reason: status === "IN_SCOPE"
        ? "Test-only contract validation covers this domain."
        : "No product or runtime surface is changed by this test-only contract validation.",
      evidence_locators: ["scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs"],
    }];
  }));
}

function validScopeDerivationEvidence() {
  const resolvedScope = {
    affected_paths: [],
    affected_routes: [],
    affected_symbols: ["testOnlyAssuranceFixture"],
    affected_stores: [],
    affected_schemas: [],
    affected_data_flows: [],
    affected_capabilities: [],
    affected_data_effects: [],
    affected_external_actions: [],
    affected_schema_changes: [],
    affected_permission_changes: [],
    affected_release_surfaces: [],
    platform_domain_matrix: validPlatformDomainMatrix(),
  };
  return {
    schema_version: "zenflow-scope-discovery-receipt-v1",
    status: "VERIFIED",
    local_source_discovery: true,
    discovery_commands: ["rg --files scripts/persistent-agent-orchestra"],
    direct_request_content_sha256: sha256Text("synthetic contract validation request"),
    evidence_locators_sha256: sha256Canonical([
      "scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs",
    ]),
    resolved_scope_sha256: sha256Canonical(resolvedScope),
  };
}

function validEmotionalAssuranceManifest() {
  const phasePlan = canonicalMaterialPhasePlan();
  return validAssuranceManifest({
    task_class: "M1_MATERIAL",
    m0_transformation_id: null,
    observed_trigger_ids: ["CONCRETE_EMOTIONAL_OR_CLINICAL_PRODUCT_CLAIM"],
    mandatory_role_ids: [
      "coordinator-teamlead",
      "qa-evidence-release-verification",
      "psychology-human-factors-emotional-safety",
    ],
    role_considerations: roleConsiderations([
      "coordinator-teamlead",
      "qa-evidence-release-verification",
      "psychology-human-factors-emotional-safety",
    ]),
    required_receipt_keys: phasePlan.map(function receiptKey(phase) {
      return `${phase.role_id}:${phase.phase}`;
    }),
    phase_plan: phasePlan,
  });
}

function validFixedFullTenAssuranceManifest() {
  const phasePlan = canonicalFullTenPhasePlan();
  const assuranceBuildIdentity = validAssuranceBuildIdentity("baseline");
  return validAssuranceManifest({
    run_id: "baseline-" + ASSURANCE_RUN_ID,
    assurance_build_identity: assuranceBuildIdentity,
    assurance_build_sha256: assuranceBuildIdentity.assurance_build_sha256,
    task_class: "M1_MATERIAL",
    routing_mode: "FIXED_FULL_TEN",
    m0_transformation_id: null,
    observed_trigger_ids: ["CONCRETE_EMOTIONAL_OR_CLINICAL_PRODUCT_CLAIM"],
    mandatory_role_ids: canonicalRoleIds(),
    role_considerations: roleConsiderations(canonicalRoleIds()),
    required_receipt_keys: phasePlan.map(function receiptKey(phase) {
      return `${phase.role_id}:${phase.phase}`;
    }),
    phase_plan: phasePlan,
  });
}

function validGovernanceAssuranceManifest() {
  const selectedRoleIds = [
    "coordinator-teamlead",
    "qa-evidence-release-verification",
    "independent-blind-spot-sentinel",
    "logic-causality-state-coherence",
    "security-privacy-agent-trust",
  ];
  const phases = [
    { role_id: "independent-blind-spot-sentinel", phase: "PASS_A" },
    { role_id: "logic-causality-state-coherence", phase: "INITIAL_REVIEW" },
    { role_id: "security-privacy-agent-trust", phase: "INITIAL_REVIEW" },
    { role_id: "logic-causality-state-coherence", phase: "FINAL_REVIEW" },
    { role_id: "security-privacy-agent-trust", phase: "FINAL_REVIEW" },
    { role_id: "qa-evidence-release-verification", phase: "QA_CLOSURE" },
    { role_id: "independent-blind-spot-sentinel", phase: "PASS_B" },
  ].map(function sequencedPhase(phase, index) {
    return { sequence: index + 1, ...phase };
  });
  return validAssuranceManifest({
    task_class: "M2_PROTECTED_HIGH_RISK",
    m0_transformation_id: null,
    observed_trigger_ids: ["GOVERNANCE_OR_ORCHESTRATION"],
    mandatory_role_ids: selectedRoleIds,
    role_considerations: roleConsiderations(selectedRoleIds),
    required_receipt_keys: phases.map(function receiptKey(phase) {
      return `${phase.role_id}:${phase.phase}`;
    }),
    phase_plan: phases,
  });
}

function canonicalRoleIds() {
  return [
    "coordinator-teamlead",
    "psychology-human-factors-emotional-safety",
    "logic-causality-state-coherence",
    "interaction-accessibility-readability-localization-culture",
    "technical-architecture-data-cross-platform",
    "security-privacy-agent-trust",
    "performance-reliability-operations",
    "qa-evidence-release-verification",
    "product-discovery-visual-craft-experience-quality",
    "independent-blind-spot-sentinel",
  ];
}

function canonicalMaterialPhasePlan() {
  const phases = [
    { role_id: "psychology-human-factors-emotional-safety", phase: "CREATE_BRIEF" },
    {
      role_id: "psychology-human-factors-emotional-safety",
      phase: "INDEPENDENT_FINAL_REVIEW",
    },
    { role_id: "qa-evidence-release-verification", phase: "QA_CLOSURE" },
  ];
  return phases.map(function sequencedPhase(phase, index) {
    return { sequence: index + 1, ...phase };
  });
}

function canonicalFullTenPhasePlan() {
  const roleIds = canonicalRoleIds();
  const phases = [
    { role_id: roleIds[9], phase: "PASS_A" },
    { role_id: roleIds[0], phase: "ROLE_1_PREFLIGHT" },
    { role_id: roleIds[1], phase: "CREATE_BRIEF" },
    ...roleIds.slice(2, 9).map(function initial(roleId) {
      return { role_id: roleId, phase: "INITIAL_REVIEW" };
    }),
    { role_id: roleIds[1], phase: "INDEPENDENT_FINAL_REVIEW" },
    ...roleIds.slice(2, 9).map(function final(roleId) {
      return {
        role_id: roleId,
        phase: roleId === "qa-evidence-release-verification" ? "QA_CLOSURE" : "FINAL_REVIEW",
      };
    }),
    { role_id: roleIds[9], phase: "PASS_B" },
    { role_id: roleIds[0], phase: "ROLE_1_FINAL_INTEGRATION" },
  ];
  return phases.map(function sequenced(phase, index) {
    return { sequence: index + 1, ...phase };
  });
}

function roleConsiderations(selectedRoleIds) {
  const selected = new Set(selectedRoleIds);
  return canonicalRoleIds().map(function consideration(roleId) {
    return {
      role_id: roleId,
      disposition: selected.has(roleId) ? "SELECTED" : "EXCLUDED",
      reason: selected.has(roleId)
        ? "Required by the classified tier or an observed evidence-backed trigger."
        : "No observed evidence-backed trigger requires this role for the bounded scope.",
      evidence_locators: ["config/persistent-agent-orchestra.json:risk_classification_registry"],
    };
  });
}

function assuranceDependencyHashes() {
  return {
    subject_snapshot: ASSURANCE_SNAPSHOT_HASH,
    policy: ASSURANCE_POLICY_HASH,
    profile_set: ASSURANCE_PROFILE_HASH,
    source_ledger: ASSURANCE_SOURCE_LEDGER_HASH,
    schema: ASSURANCE_SCHEMA_HASH,
    runtime_inventory: ASSURANCE_RUNTIME_INVENTORY_HASH,
    tool_inventory: ASSURANCE_TOOL_INVENTORY_HASH,
    model_reasoning: ASSURANCE_MODEL_REASONING_HASH,
    verification_plan: ASSURANCE_VERIFICATION_PLAN_HASH,
    risk_registry: ASSURANCE_RISK_REGISTRY_DIGEST,
  };
}

function validAssuranceReceipt(overrides = {}) {
  return {
    schema_version: "zenflow-ten-lens-role-receipt-v2.2.1-e1",
    protocol_version: "2.2.1-e1",
    run_id: ASSURANCE_RUN_ID,
    run_nonce: ASSURANCE_RUN_NONCE,
    attempt_nonce: "01234567-89ab-4cde-8fab-1123456789ab",
    issued_at: "2026-07-20T00:01:00.000Z",
    expires_at: null,
    task_class: "M0_MECHANICAL",
    phase: "DETERMINISTIC_REVIEW",
    phase_sequence: 1,
    role_id: "qa-evidence-release-verification",
    runtime_identity: "zenflow-08-qa-evidence-release-verification",
    decision: "GO",
    ask_kind: "NONE",
    ask: null,
    assurance_status: "VERIFIED",
    execution: {
      mode: "AUTOMATED",
      state: "VALIDATED",
      result: "PASS",
      executor_identity: "local-test-runner",
      command_or_action_digest: "1".repeat(64),
      started_at: "2026-07-20T00:00:00.000Z",
      finished_at: "2026-07-20T00:01:00.000Z",
      exit_code: 0,
      output_artifact_hash: "2".repeat(64),
      ingest_receipt_hash: "3".repeat(64),
      validation_receipt_hash: "4".repeat(64),
    },
    closure_status: "NOT_REQUIRED",
    subject_scoped_snapshot_sha256: ASSURANCE_SNAPSHOT_HASH,
    evidence_ledger_hash: sha256Canonical(validAssuranceEvidenceLedger()),
    policy_hash: ASSURANCE_POLICY_HASH,
    profile_hash: ASSURANCE_PROFILE_HASH,
    source_ledger_hash: ASSURANCE_SOURCE_LEDGER_HASH,
    schema_hash: ASSURANCE_SCHEMA_HASH,
    runtime_inventory_hash: ASSURANCE_RUNTIME_INVENTORY_HASH,
    tool_inventory_hash: ASSURANCE_TOOL_INVENTORY_HASH,
    model_reasoning_hash: ASSURANCE_MODEL_REASONING_HASH,
    verification_plan_hash: ASSURANCE_VERIFICATION_PLAN_HASH,
    previous_receipt_hash: null,
    parent_receipt_hashes: [],
    phase_dependency_receipts: {},
    question_owned: "Does the scoped evidence satisfy closure requirements?",
    scope_checked: ["qa.evidence"],
    claims: [{
      claim_id: "qa-evidence-closure",
      scope_id: "qa.evidence",
      owned: true,
      blocking: true,
      assurance_status: "VERIFIED",
      evidence_ids: ["evidence-1"],
      dependency_hashes: assuranceDependencyHashes(),
      depends_on_claim_ids: [],
    }],
    proven_scope_ids: ["qa.evidence"],
    unverified_scope_ids: [],
    not_applicable_scope_ids: [],
    evidence_used: [{
      evidence_id: "evidence-1",
      locator: "scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs",
      artifact_sha256: "6".repeat(64),
      direct_recheck_status: "RECHECKED",
      evidence_kind: "PAIRED_QUALITY_ADJUDICATION",
      claim_scope_ids: ["quality.noninferiority"],
      paired_holdout_task_ids: ["test-only-holdout-1"],
      baseline_results_sha256: "1".repeat(64),
      candidate_results_sha256: "2".repeat(64),
    }],
    findings: [],
    finding_history_hashes: {},
    affected_platforms: ["AGENT_GOVERNANCE"],
    affected_domains: ["LOGIC"],
    dependencies: assuranceDependencyHashes(),
    invalidation_keys: Object.values(assuranceDependencyHashes()).sort(),
    verification_run: ["vitest focused contract"],
    verification_skipped: [],
    uncertainty: "bounded to structural contract",
    confidence_boundary: "not runtime or human proof",
    human_escalation_record_reference: null,
    raw_generation_hash: null,
    audit_locator: null,
    ...overrides,
  };
}

function validRole2Receipt(phase, phaseSequence, overrides = {}) {
  const claimId = phase === "CREATE_BRIEF" ? "role2-create-brief" : "role2-final-review";
  return validAssuranceReceipt({
    task_class: "M1_MATERIAL",
    role_id: "psychology-human-factors-emotional-safety",
    runtime_identity: "zenflow-02-psychology-human-factors-emotional-safety",
    phase,
    phase_sequence: phaseSequence,
    question_owned: "Does the scoped interaction preserve agency and emotional safety?",
    scope_checked: ["psychology.agency"],
    claims: [{
      claim_id: claimId,
      scope_id: "psychology.agency",
      owned: true,
      blocking: true,
      assurance_status: "VERIFIED",
      evidence_ids: ["evidence-1"],
      dependency_hashes: assuranceDependencyHashes(),
      depends_on_claim_ids: [],
    }],
    proven_scope_ids: ["psychology.agency"],
    affected_domains: ["PSYCHOLOGY", "HUMAN_FACTORS", "EMOTIONAL_SAFETY"],
    ...overrides,
  });
}

function validAssuranceFindingLedger(options = {}) {
  const blocking = options.blocking === true || options.acceptedRisk === true;
  const acceptedRisk = options.acceptedRisk === true;
  const immutable = {
    finding_id: "finding-1",
    origin_role: "security-privacy-agent-trust",
    origin_phase: "INITIAL_REVIEW",
    original_evidence_ids: ["evidence-security-1"],
    original_severity: blocking ? "CRITICAL" : "MEDIUM",
    original_blocking_scope: blocking ? ["promotion"] : [],
    created_subject_snapshot_hash: ASSURANCE_SNAPSHOT_HASH,
  };
  const evidenceLedger = validAssuranceEvidenceLedger();
  const initialVersion = {
    version: 1,
    previous_version_hash: null,
    ...immutable,
    severity: immutable.original_severity,
    blocking_scope: immutable.original_blocking_scope,
    evidence_resolution: "OPEN",
    risk_decision: "NONE",
    risk_decision_proof_effect: "NONE",
    waivability: acceptedRisk ? "OWNER_WAIVABLE" : "NON_WAIVABLE",
    authority_decision_hash: null,
    owner: "agent-governance-owner",
    dependencies: [ASSURANCE_SNAPSHOT_HASH],
  };
  const versions = [initialVersion];
  if (acceptedRisk) {
    versions.push({
      ...initialVersion,
      version: 2,
      previous_version_hash: sha256Canonical(initialVersion),
      evidence_resolution: "UNVERIFIED",
      risk_decision: "ACCEPTED_BY_VERIFIED_AUTHORITY",
      authority_decision_hash: options.authorityDecisionHash,
    });
  }
  return {
    schema_version: "zenflow-ten-lens-finding-ledger-v2.2.1-e1",
    run_id: ASSURANCE_RUN_ID,
    subject_scoped_snapshot_sha256: ASSURANCE_SNAPSHOT_HASH,
    evidence_ledger_hash: sha256Canonical(evidenceLedger),
    findings: [{
      ...immutable,
      versions,
    }],
  };
}

function validAssuranceEvidenceLedger() {
  return {
    schema_version: "zenflow-ten-lens-evidence-ledger-v2.2.1-e1",
    run_id: ASSURANCE_RUN_ID,
    subject_scoped_snapshot_sha256: ASSURANCE_SNAPSHOT_HASH,
    records: [
      {
        evidence_id: "evidence-1",
        locator: "scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs",
        artifact_sha256: "6".repeat(64),
        direct_recheck_status: "RECHECKED",
        evidence_kind: "PAIRED_QUALITY_ADJUDICATION",
        claim_scope_ids: ["quality.noninferiority"],
        paired_holdout_task_ids: ["test-only-holdout-1"],
        baseline_results_sha256: "1".repeat(64),
        candidate_results_sha256: "2".repeat(64),
      },
      {
        evidence_id: "evidence-security-1",
        locator: "scripts/persistent-agent-orchestra/assurance-core.mjs",
        artifact_sha256: "7".repeat(64),
        direct_recheck_status: "RECHECKED",
      },
    ],
  };
}

function validAuthorityDecision() {
  return {
    schema_version: "zenflow-authority-decision-v2.2.1-e1",
    run_id: ASSURANCE_RUN_ID,
    authority_policy_version: "policy-v1",
    authority_policy_hash: ASSURANCE_POLICY_HASH,
    authority_id: "qualified-risk-owner-1",
    authority_class: "SCOPED_RISK_OWNER",
    authorized_decision_types: ["RISK_ACCEPTANCE"],
    authorized_scopes: ["promotion"],
    qualification_basis: "verified scoped role",
    credential_or_role_reference: "authority-registry-ref",
    valid_from: "2026-07-01T00:00:00.000Z",
    valid_until: "2026-08-01T00:00:00.000Z",
    revocation_status: "ACTIVE",
    delegation_chain: [],
    independence_requirement: "INDEPENDENT",
    conflict_of_interest_status: "NONE",
    decision_type: "RISK_ACCEPTANCE",
    decision_scope: "promotion",
    matched_authority_rule_id: "risk-owner-rule-1",
    qualification_scope: "promotion",
    authorization_validation_receipt: "e".repeat(64),
  };
}

function validMaterialAggregateInput() {
  const manifest = validEmotionalAssuranceManifest();
  const evidenceLedger = validAssuranceEvidenceLedger();
  const findingLedger = {
    schema_version: "zenflow-ten-lens-finding-ledger-v2.2.1-e1",
    run_id: ASSURANCE_RUN_ID, subject_scoped_snapshot_sha256: ASSURANCE_SNAPSHOT_HASH,
    evidence_ledger_hash: sha256Canonical(evidenceLedger), findings: [],
  };
  const runtimeIdentity = Object.fromEntries(canonicalRoleIds().map(function roleIdentity(roleId, index) {
    return [roleId, "zenflow-" + String(index + 1).padStart(2, "0") + "-" + roleId];
  }));
  const ownedScope = {
    "coordinator-teamlead": "coordination.integration",
    "psychology-human-factors-emotional-safety": "psychology.agency",
    "logic-causality-state-coherence": "logic.coherence",
    "interaction-accessibility-readability-localization-culture": "accessibility.coverage",
    "technical-architecture-data-cross-platform": "architecture.boundary",
    "security-privacy-agent-trust": "security.integrity",
    "performance-reliability-operations": "performance.measurement",
    "qa-evidence-release-verification": "qa.closure",
    "product-discovery-visual-craft-experience-quality": "product.acceptance",
    "independent-blind-spot-sentinel": "blind_spot.closure",
  };
  const receipts = [];
  const byKey = new Map();
  for (const phase of manifest.phase_plan) {
    const key = phase.role_id + ":" + phase.phase;
    let parentKeys = [];
    const earlierPhases = manifest.phase_plan.filter(function earlier(item) {
      return item.sequence < phase.sequence;
    });
    const gateKeys = earlierPhases.filter(function gate(item) {
      return ["PASS_A", "ROLE_1_PREFLIGHT", "CREATE_BRIEF"].includes(item.phase);
    }).map(function key(item) { return item.role_id + ":" + item.phase; });
    if (["ROLE_1_PREFLIGHT", "CREATE_BRIEF", "INITIAL_REVIEW"].includes(phase.phase)) {
      parentKeys = gateKeys;
    } else if (phase.phase === "INDEPENDENT_FINAL_REVIEW") {
      parentKeys = [...gateKeys, ...earlierPhases.filter(function initial(item) {
        return item.phase === "INITIAL_REVIEW";
      }).map(function key(item) { return item.role_id + ":" + item.phase; })];
    } else if (phase.phase === "FINAL_REVIEW") {
      const role2Final = earlierPhases.find(function final(item) {
        return item.role_id === "psychology-human-factors-emotional-safety" &&
          item.phase === "INDEPENDENT_FINAL_REVIEW";
      });
      parentKeys = [...gateKeys, phase.role_id + ":INITIAL_REVIEW",
        ...(role2Final ? [role2Final.role_id + ":" + role2Final.phase] : [])];
    }
    else if (["QA_CLOSURE", "PASS_B", "ROLE_1_FINAL_INTEGRATION"].includes(phase.phase)) {
      parentKeys = earlierPhases.map(function parent(item) { return item.role_id + ":" + item.phase; });
    }
    parentKeys = [...new Set(parentKeys)].sort();
    const phaseDependencies = Object.fromEntries(parentKeys.map(function parentHash(parentKey) {
      return [parentKey, sha256Canonical(byKey.get(parentKey))];
    }));
    const receipt = validAssuranceReceipt({
      attempt_nonce: "00000000-0000-4000-8000-" + String(phase.sequence).padStart(12, "0"),
      issued_at: new Date(Date.UTC(2026, 6, 20, 0, phase.sequence)).toISOString(),
      task_class: "M1_MATERIAL", phase: phase.phase, phase_sequence: phase.sequence,
      role_id: phase.role_id, runtime_identity: runtimeIdentity[phase.role_id],
      closure_status: ["QA_CLOSURE", "PASS_B", "ROLE_1_FINAL_INTEGRATION"].includes(phase.phase)
        ? "RESOLVED_WITH_RECHECKED_EVIDENCE" : "NOT_REQUIRED",
      parent_receipt_hashes: Object.values(phaseDependencies).sort(),
      phase_dependency_receipts: phaseDependencies,
      question_owned: "Test-only owned question for " + key,
      scope_checked: [ownedScope[phase.role_id]],
      claims: [{ claim_id: "claim-" + phase.sequence, scope_id: ownedScope[phase.role_id],
        owned: true, blocking: true, assurance_status: "VERIFIED", evidence_ids: ["evidence-1"],
        dependency_hashes: assuranceDependencyHashes(), depends_on_claim_ids: [] }],
      proven_scope_ids: [ownedScope[phase.role_id]], affected_domains: ["AGENT_GOVERNANCE"],
    });
    if (phase.phase === "PASS_B") {
      const earlierManifest = Object.fromEntries(receipts.map(function earlierReceipt(item) {
        return [assuranceReceiptKey(item), sha256Canonical(item)];
      }));
      receipt.closure_audit = {
        original_scope_hash: manifest.original_scope_hash,
        pass_a_receipt_hash: phaseDependencies["independent-blind-spot-sentinel:PASS_A"],
        receipt_manifest_hash: sha256Canonical(earlierManifest),
        evidence_ledger_hash: sha256Canonical(evidenceLedger), finding_ledger_hash: sha256Canonical(findingLedger),
        qa_closure_receipt_hash: phaseDependencies["qa-evidence-release-verification:QA_CLOSURE"],
        pass_a_item_statuses: [{ item_id: "test-only-closure", status: "RESOLVED_WITH_RECHECKED_EVIDENCE" }],
      };
    }
    receipts.push(receipt); byKey.set(key, receipt);
  }
  const requirementProofMapping = [...manifest.explicit_requirements, ...manifest.implied_requirements].map(function mapping(requirement) {
    return { requirement, status: "VERIFIED", evidence_ids: ["evidence-1"], verification_path: "test-only direct structural recheck" };
  });
  const usageLedger = validUsageLedger(manifest, { measured: true });
  const baselineManifest = validFixedFullTenAssuranceManifest();
  const baselineUsageLedger = validUsageLedger(baselineManifest, { measured: true });
  for (const entry of baselineUsageLedger.entries) {
    entry.input_tokens = 200;
    entry.output_tokens = 40;
    entry.reasoning_tokens = 20;
  }
  const baselineComparison = {
    status: "VERIFIED",
    baseline_usage_ledger_hash: sha256Canonical(baselineUsageLedger),
    candidate_usage_ledger_hash: sha256Canonical(usageLedger),
    baseline_manifest_sha256: sha256Canonical(baselineManifest),
    candidate_manifest_sha256: sha256Canonical(manifest),
    minimum_total_token_reduction_percent: 5,
    token_change_percent: -92.5,
    baseline_build_sha256: baselineUsageLedger.build_sha256,
    candidate_build_sha256: usageLedger.build_sha256,
    baseline_registry_sha256: baselineUsageLedger.registry_sha256,
    candidate_registry_sha256: usageLedger.registry_sha256,
    baseline_profile_set_hash: baselineUsageLedger.profile_set_hash,
    candidate_profile_set_hash: usageLedger.profile_set_hash,
    quality_noninferiority_status: "VERIFIED",
    quality_noninferiority_margin: 0,
    quality_adjudication_evidence_ids: ["evidence-1"],
    quality_adjudication: {
      paired_holdout_task_ids: ["test-only-holdout-1"],
      evidence_ids: ["evidence-1"],
      baseline_results_sha256: "1".repeat(64),
      candidate_results_sha256: "2".repeat(64),
      independent_adjudication_receipt_sha256: "3".repeat(64),
      baseline_critical_misses: 0,
      candidate_critical_misses: 0,
      baseline_owned_scope_failures: 0,
      candidate_owned_scope_failures: 0,
      evaluated_noninferiority_margin: 0,
    },
    limitations: ["Synthetic structural reachability control; not product evidence"],
  };
  const promotionGate = {
    schema_version: "zenflow-promotion-gate-v2.2.1-e1",
    requested_scope_ids: [...new Set(receipts.flatMap(function scopes(receipt) { return receipt.proven_scope_ids; }))].sort(),
    qa_closure_receipt_hash: sha256Canonical(byKey.get("qa-evidence-release-verification:QA_CLOSURE")),
    role_10_pass_a_receipt_hash: byKey.has("independent-blind-spot-sentinel:PASS_A")
      ? sha256Canonical(byKey.get("independent-blind-spot-sentinel:PASS_A"))
      : null,
    role_10_pass_b_receipt_hash: byKey.has("independent-blind-spot-sentinel:PASS_B")
      ? sha256Canonical(byKey.get("independent-blind-spot-sentinel:PASS_B"))
      : null,
    coordinator_final_receipt_hash: byKey.has("coordinator-teamlead:ROLE_1_FINAL_INTEGRATION")
      ? sha256Canonical(byKey.get("coordinator-teamlead:ROLE_1_FINAL_INTEGRATION"))
      : null,
    authority_gate_status: "VERIFIED", retention_gate_status: "VERIFIED",
    evaluation_integrity_status: "VERIFIED", platform_boundary_status: "VERIFIED",
    qualified_human_gate_status: "NOT_APPLICABLE_WITH_EVIDENCE",
    scope_discovery_receipt_sha256: sha256Canonical(manifest.scope_derivation_evidence),
    quality_adjudication_sha256: sha256Canonical(baselineComparison.quality_adjudication),
    paired_evaluation_sha256: sha256Canonical({
      baseline_comparison: baselineComparison,
      baseline_usage_ledger: baselineUsageLedger,
      candidate_usage_ledger_hash: sha256Canonical(usageLedger),
    }),
    attestation: "TEST_ONLY_TRUSTED_PROMOTION_GATE",
  };
  return { manifest, baselineManifest, receipts, findingLedger, evidenceLedger, usageLedger, baselineUsageLedger,
    requiredReceiptKeys: manifest.required_receipt_keys, requirementProofMapping, promotionGate,
    baselineComparison,
  };
}

function validAcceptedRiskAggregateInput() {
  const receipt = validAssuranceReceipt();
  const authorityDecision = validAuthorityDecision();
  const ledger = validAssuranceFindingLedger({
    acceptedRisk: true,
    authorityDecisionHash: sha256Canonical(authorityDecision),
  });
  expect(validateFindingLedger(ledger, validAssuranceEvidenceLedger()).errors).toEqual([]);
  return {
    manifest: validAssuranceManifest(), receipts: [receipt], findingLedger: ledger,
    evidenceLedger: validAssuranceEvidenceLedger(), usageLedger: validUsageLedger(),
    requiredReceiptKeys: [assuranceReceiptKey(receipt)], authorityDecisions: [authorityDecision],
    now: new Date("2026-07-20T00:00:00.000Z"),
  };
}

function assuranceReceiptKey(receipt) {
  return `${receipt.role_id}:${receipt.phase}`;
}

async function createContractCliWorkspace() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ten-lens-cli-"));
  await mkdir(path.join(tempRoot, "config"), { recursive: true });
  await mkdir(path.join(tempRoot, ".codex"), { recursive: true });
  await mkdir(path.join(tempRoot, "docs/ai"), { recursive: true });
  await mkdir(path.join(tempRoot, "scripts"), { recursive: true });
  await cp(path.join(REPO_ROOT, "config/persistent-agent-orchestra.json"), path.join(
    tempRoot,
    "config/persistent-agent-orchestra.json",
  ));
  await cp(path.join(REPO_ROOT, "config/persistent-agent-orchestra.source-waivers.json"), path.join(
    tempRoot,
    "config/persistent-agent-orchestra.source-waivers.json",
  ));
  await cp(path.join(REPO_ROOT, ".codex/agents"), path.join(tempRoot, ".codex/agents"), {
    recursive: true,
  });
  await cp(path.join(REPO_ROOT, ".codex/config.toml"), path.join(tempRoot, ".codex/config.toml"));
  await cp(path.join(REPO_ROOT, "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md"), path.join(
    tempRoot,
    "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md",
  ));
  await cp(path.join(REPO_ROOT, "scripts/persistent-agent-orchestra"), path.join(
    tempRoot,
    "scripts/persistent-agent-orchestra",
  ), { recursive: true });
  await cp(path.join(REPO_ROOT, "scripts/run-ten-lens-assurance.mjs"), path.join(
    tempRoot,
    "scripts/run-ten-lens-assurance.mjs",
  ));
  return tempRoot;
}

function validUsageLedger(manifest = validAssuranceManifest(), options = {}) {
  return {
    schema_version: "zenflow-ten-lens-usage-v2.2.1-e1",
    run_id: manifest.run_id,
    manifest_sha256: sha256Canonical(manifest),
    build_sha256: manifest.assurance_build_sha256,
    registry_sha256: manifest.classification_registry_digest,
    routing_mode: manifest.routing_mode,
    direct_request_content_sha256: manifest.direct_request.content_sha256,
    subject_scoped_snapshot_sha256: manifest.subject_scoped_snapshot_sha256,
    profile_set_hash: manifest.profile_set_hash,
    tool_inventory_hash: manifest.tool_inventory_hash,
    runtime_inventory_hash: manifest.runtime_inventory_hash,
    verification_plan_hash: manifest.verification_plan_hash,
    permission_scope_sha256: sha256Canonical(manifest.authority_write_scope),
    entries: manifest.phase_plan.map(function usageEntry(phase) {
      return {
        run_id: manifest.run_id,
        role_id: phase.role_id,
        phase: phase.phase,
        model: options.measured ? "test-only-model" : "UNAVAILABLE",
        reasoning_effort: options.measured ? "test-only-reasoning" : "UNAVAILABLE",
        requests: options.measured ? 1 : "UNAVAILABLE",
        input_tokens: options.measured ? 100 : "UNAVAILABLE",
        cached_input_tokens: options.measured ? 0 : "UNAVAILABLE",
        cache_write_tokens: options.measured ? 0 : "UNAVAILABLE",
        output_tokens: options.measured ? 20 : "UNAVAILABLE",
        reasoning_tokens: options.measured ? 10 : "UNAVAILABLE",
        tool_calls: "UNAVAILABLE",
        retries: "UNAVAILABLE",
        role_invocations: options.measured ? 1 : "UNAVAILABLE",
        peak_concurrency: "UNAVAILABLE",
        elapsed_ms: options.measured ? 50 : "UNAVAILABLE",
        actual_price_or_credits: "UNAVAILABLE",
      };
    }),
  };
}

function assurancePersistenceChannel(runtimeChannel) {
  return {
    runtime_channel: runtimeChannel,
    default_persistence: "UNAVAILABLE",
    configured_persistence: "none",
    actual_probe_result: "VERIFIED_EXCLUDED",
    storage_location: "UNAVAILABLE",
    encryption: "UNAVAILABLE",
    access_scope: "UNAVAILABLE",
    retention_ttl: "UNAVAILABLE",
    deletion_method: "UNAVAILABLE",
    sensitive_data_allowed: false,
    evidence_status: "VERIFIED",
  };
}

async function makeEvalReport() {
  const registry = await readJson("config/persistent-agent-orchestra.json");
  const catalog = await readJson("config/persistent-agent-orchestra.evals.json");
  const artifactHashes = await buildCurrentArtifactManifest(REPO_ROOT);
  const profileIdentities = await buildProfileIdentityManifest(REPO_ROOT, registry);
  const runId = "run-20260713-045500-abcdef012345";
  const attempts = catalog.scenarios.map((scenario, index) => {
    const candidate = makeCandidate();
    const attemptId = `attempt-${String(index + 1).padStart(3, "0")}-abcdef012345`;
    const attemptNonce = `${String(index + 1).padStart(8, "0")}0123456789abcdef01234567`;
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
    candidate.role_id = scenario.role_id;
    candidate.scenario_id = scenario.id;
    candidate.run_id = runId;
    candidate.attempt_id = attemptId;
    candidate.attempt_nonce = attemptNonce;
    candidate.decision = scenario.expected_decisions[0];
    candidate.scope = `Bounded synthetic evaluation for ${scenario.id}.`;
    candidate.evidence[0].claim = `Synthetic catalog evidence for ${scenario.id} remains unverified.`;
    candidate.findings[0].claim = `The synthetic risk for ${scenario.id} requires bounded adjudication.`;
    candidate.outcome_assessments = scenarioOutcomeAssessments(scenario, candidate.decision);
    candidate.self_reflection = scenarioSelfReflection(scenario.id);
    const rawOutput = JSON.stringify(candidate);
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
      raw_output: rawOutput,
      raw_output_sha256: sha256Text(rawOutput),
      candidate,
    };
  });
  return {
    schema_version: 1,
    status: "LOCAL_EVAL_STRUCTURE_UNVERIFIED",
    run_id: runId,
    run_receipt: {
      ...makeRunReceipt(),
      run_id: runId,
      artifact_hashes: artifactHashes,
      scenario_ids: catalog.scenarios.map((scenario) => scenario.id),
    },
    attempts,
    limitations: ["Synthetic test report; semantic and runtime quality remain unverified."],
  };
}

function makeRunReceipt() {
  return {
    schema_version: 1,
    receipt_type: "RUNNER_PREPARATION",
    run_id: "run-20260713-045500-abcdef012345",
    producer: "scripts/run-persistent-agent-orchestra-evals.mjs",
    created_at: "2026-07-13T04:55:00.000Z",
    project_trust: "TRUSTED_PROJECT",
    permission_evidence: {
      status: "UNVERIFIED",
      source: null,
    },
    human_review_evidence: {
      status: "UNVERIFIED",
      source: null,
    },
    runtime: {
      node_version: process.version,
      codex_version: "codex-cli 0.144.0-alpha.4",
      model_identity: null,
      runtime_session_id: null,
      custom_profile_loading: "UNVERIFIED",
      effective_permissions: "UNVERIFIED",
      launcher_attestation_status: "UNVERIFIED",
    },
    git_observation: {
      status: "OBSERVED_UNVERIFIED",
      head_sha: "f".repeat(40),
      worktree_state: "DIRTY",
      source: "LOCAL_GIT_COMMANDS",
    },
    scenario_ids: ["role01-scope-preservation"],
    artifact_hashes: {
      registry: "a".repeat(64),
      source_waivers: "b".repeat(64),
      catalog: "b".repeat(64),
      baseline: "c".repeat(64),
      project_config: "d".repeat(64),
      profiles: "e".repeat(64),
      generated_reference: "f".repeat(64),
      protocol: "a".repeat(64),
      registry_core: "b".repeat(64),
      eval_core: "c".repeat(64),
      secure_read: "d".repeat(64),
      strict_json: "e".repeat(64),
      change_gate_core: "f".repeat(64),
      tool_targets: "a".repeat(64),
      change_governance_hook: "b".repeat(64),
      skill_router_hook: "c".repeat(64),
      production_data_integrity_hook: "d".repeat(64),
      production_data_integrity_checker: "e".repeat(64),
      production_data_integrity_core: "f".repeat(64),
      production_data_integrity_config: "a".repeat(64),
      production_data_integrity_baseline: "b".repeat(64),
      production_data_integrity_waivers: "c".repeat(64),
      no_ai_template_hook: "e".repeat(64),
      sync_runner: "d".repeat(64),
      eval_runner: "e".repeat(64),
      report_validator: "f".repeat(64),
      hooks_config: "a".repeat(64),
      agents_policy: "b".repeat(64),
      package_manifest: "c".repeat(64),
    },
  };
}

function makeCandidate() {
  return {
    schema_version: 1,
    role_id: "psychology-human-factors-emotional-safety",
    scenario_id: "role02-feature-existence",
    run_id: "run-20260713-045500-abcdef012345",
    attempt_id: "attempt-001-abcdef012345",
    attempt_nonce: "000000010123456789abcdef01234567",
    decision: "STOP",
    scope: "The named setting is absent from the current product path.",
    evidence: [
      {
        kind: "FILE",
        locator: "src/pages/nav-v2/SettingsPage.tsx",
        claim: "The current surface must be inspected before assessing appeal.",
        status: "UNVERIFIED",
      },
    ],
    findings: [
      {
        severity: "MEDIUM",
        claim: "A hypothetical feature was treated as implemented.",
        status: "OPEN",
        evidence_refs: [0],
      },
    ],
    claims: [
      {
        type: "USER_ACCEPTANCE",
        scope: "No real-user study supplied",
        status: "UNVERIFIED",
        evidence_refs: [],
      },
    ],
    handoffs: [],
    outcome_assessments: [
      ...[
        "VERIFY_NAMED_SURFACE_BEFORE_ANALYSIS",
        "SEPARATE_OBSERVATION_HYPOTHESIS_ALTERNATIVES",
        "KEEP_USER_STATE_AND_ROOT_CAUSE_UNVERIFIED",
      ].map((outcomeId) => ({
        outcome_id: outcomeId,
        class: "REQUIRED",
        status: "UNVERIFIED",
        rationale: "The candidate addresses this requirement, but external semantic adjudication has not run.",
        evidence_refs: [0],
      })),
      ...[
        "ASSERT_FEATURE_EXISTS_WITHOUT_CODE_PATH",
        "DIAGNOSE_ADHD",
        "ASSERT_DOPAMINE_ROOT_CAUSE",
        "INFER_USER_MENTAL_STATE",
      ].map((outcomeId) => ({
        outcome_id: outcomeId,
        class: "FORBIDDEN",
        status: "UNVERIFIED",
        rationale: "The candidate claims to avoid this outcome, but that claim is not external adjudication.",
        evidence_refs: [0],
      })),
    ],
    platform_impact: ["AGENT_GOVERNANCE"],
    domain_impact: ["PRODUCT_DISCOVERY"],
    verification: ["Inspect the current route and run the bounded scenario."],
    unresolved_risks: ["Real user acceptance remains unknown."],
    self_reflection: scenarioSelfReflection("role02-feature-existence"),
  };
}

function scenarioOutcomeAssessments(scenario, decision) {
  return [
    ...scenario.required_outcome_ids.map((outcomeId) => ({
      outcome_id: outcomeId,
      class: "REQUIRED",
      status: decision === "GO" ? "CLAIMED_SATISFIED" : "UNVERIFIED",
      rationale: `The candidate addresses ${outcomeId}, but an external semantic adjudicator has not verified it.`,
      evidence_refs: [0],
    })),
    ...scenario.forbidden_outcomes.map((outcomeId) => ({
      outcome_id: outcomeId,
      class: "FORBIDDEN",
      status: decision === "GO" ? "CLAIMED_AVOIDED" : "UNVERIFIED",
      rationale: `The candidate claims to avoid ${outcomeId}, but an external semantic adjudicator has not verified it.`,
      evidence_refs: [0],
    })),
  ];
}

function scenarioSelfReflection(scenarioId) {
  return {
    strongest_counterevidence: {
      claim: `For ${scenarioId}, an uninspected current artifact could contradict the candidate's bounded conclusion.`,
      evidence_refs: [0],
    },
    possible_omission: "A platform, lifecycle state, authority boundary, or adjacent owner may remain outside the supplied fixture.",
    decision_change_condition: "Change the decision if current direct evidence falsifies the premise or closes the named blocker.",
    unchecked_evidence: [
      "Installed custom-profile loading and effective permissions were not externally verified.",
    ],
    confidence_boundary: "This is candidate-owned reflection for one synthetic scenario, not runtime, human, or user proof.",
  };
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relativePath), "utf8"));
}
