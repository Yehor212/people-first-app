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

const REPO_ROOT = process.cwd();
const FIXED_NOW = new Date("2026-07-13T05:00:00.000Z");

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
      await mkdir(path.join(tempRoot, "docs/ai"), { recursive: true });
      await Promise.all([
        cp(path.join(REPO_ROOT, ".codex"), path.join(tempRoot, ".codex"), { recursive: true }),
        cp(path.join(REPO_ROOT, "config"), path.join(tempRoot, "config"), { recursive: true }),
        cp(
          path.join(REPO_ROOT, "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md"),
          path.join(tempRoot, "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md"),
        ),
        cp(
          path.join(REPO_ROOT, "docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md"),
          path.join(tempRoot, "docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md"),
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
          '"schema_version": 1,',
          '"schema_version": 1,\n  "schema_version": 1,',
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
      toolTargets,
      pdiChecker,
      pdiCore,
      pdiConfig,
      pdiBaseline,
      pdiWaivers,
    ] = await Promise.all([
      readFile(path.join(REPO_ROOT, "scripts/persistent-agent-orchestra/secure-read.mjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/persistent-agent-orchestra/strict-json.mjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/codex-governance/tool-targets.cjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/check-production-data-integrity.cjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "scripts/production-data-integrity/core.cjs"), "utf8"),
      readFile(path.join(REPO_ROOT, "config/production-data-integrity.json"), "utf8"),
      readFile(path.join(REPO_ROOT, "config/production-data-integrity-baseline.json"), "utf8"),
      readFile(path.join(REPO_ROOT, "config/production-data-integrity-waivers.json"), "utf8"),
    ]);

    expect(manifest.secure_read).toBe(sha256Text(secureRead));
    expect(manifest.strict_json).toBe(sha256Text(strictJson));
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
