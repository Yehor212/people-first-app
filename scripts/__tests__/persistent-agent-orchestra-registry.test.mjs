import {
  chmod,
  link,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { sha256Canonical } from "../persistent-agent-orchestra/assurance-core.mjs";

import {
  checkWorkspace,
  computeRoleSemanticContractHash,
  isExactIsoDate,
  syncWorkspace,
  validateRegistry,
  validateRoleSelectionRecord,
} from "../persistent-agent-orchestra/registry-core.mjs";

const REPO_ROOT = process.cwd();
const FIXED_NOW = new Date("2026-07-20T23:00:00.000Z");
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })),
  );
});

describe("persistent agent orchestra registry", () => {
  it("accepts the canonical exact-ten registry", async () => {
    const registry = await readCanonicalRegistry();
    const waivers = await readCanonicalWaivers();

    expect(validateRegistry(registry, { now: FIXED_NOW, waivers })).toEqual({
      errors: [],
      warnings: [],
    });
    expect(registry.roles).toHaveLength(10);
    expect(registry.roles.map((role) => role.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(registry.roles[9].activation.mandatory).toBe(true);
  });

  it("pins the primary evidence used for multi-agent evaluation and debate claims", async () => {
    const registry = await readCanonicalRegistry();
    const sources = new Map(
      registry.source_review.sources.map((source) => [source.id, source]),
    );
    for (const source of sources.values()) {
      expect(source).toEqual(expect.objectContaining({
        authority_type: expect.any(String),
        document_status: expect.any(String),
        evidence_role: expect.any(String),
        applicability_strength: expect.any(String),
        observed_canonical_url: source.url,
        retrieved_at: expect.any(String),
        document_version_or_date: expect.any(String),
        supersedes: expect.any(Array),
        content_slice_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        affected_platforms: expect.any(Array),
        does_not_prove: expect.any(String),
        event_driven_review_triggers: expect.any(Array),
      }));
    }
    expect(sources.get("nist-ai-rmf")).toEqual(expect.objectContaining({
      authority_type: "INFORMATIVE_INSTITUTIONAL_GUIDANCE",
      document_status: "CURRENT_WITH_REVISION_WATCH",
      evidence_role: "IMPLEMENTATION_GUIDANCE",
      applicability_strength: "RECOMMENDED",
    }));

    expect(sources.get("openai-evaluation-best-practices")?.url).toBe(
      "https://developers.openai.com/api/docs/guides/evaluation-best-practices",
    );
    expect(sources.get("acl-multi-agent-judge-bias-amplification")?.url).toBe(
      "https://aclanthology.org/2025.findings-emnlp.941/",
    );
    expect(sources.get("acl-mad-diversity-confidence")?.url).toBe(
      "https://aclanthology.org/2026.findings-acl.1694/",
    );

    const role1 = registry.roles.find((role) => role.slot === 1);
    const role8 = registry.roles.find((role) => role.slot === 8);
    const role10 = registry.roles.find((role) => role.slot === 10);
    expect(role1.source_ids).toEqual(
      expect.arrayContaining([
        "acl-multi-agent-judge-bias-amplification",
        "acl-mad-diversity-confidence",
      ]),
    );
    expect(role8.source_ids).toContain("openai-evaluation-best-practices");
    expect(role8.source_ids).toContain("acl-multi-agent-judge-bias-amplification");
    expect(role10.source_ids).toEqual(
      expect.arrayContaining([
        "acl-multi-agent-judge-bias-amplification",
        "acl-mad-diversity-confidence",
      ]),
    );
    expect(sources.get("acl-mad-diversity-confidence")?.applicability).toMatch(
      /does not prove|does not establish/i,
    );
  });

  it("requires source applicability and role source_ids to be exact reverse mappings", async () => {
    const registry = await readCanonicalRegistry();
    const source = registry.source_review.sources.find(
      (item) => item.id === "openai-evaluation-best-practices",
    );
    source.roles.push("technical-architecture-data-cross-platform");

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "source openai-evaluation-best-practices declares role technical-architecture-data-cross-platform but that role does not reference the source",
    );
  });

  it.each([
    ["nine roles", (registry) => registry.roles.pop(), "exactly 10"],
    ["eleven roles", (registry) => registry.roles.push({ ...registry.roles[8], slot: 11 }), "exactly 10"],
    ["duplicate slot", (registry) => { registry.roles[1].slot = 1; }, "duplicate role slot"],
    ["duplicate id", (registry) => { registry.roles[1].id = registry.roles[0].id; }, "duplicate role id"],
    ["duplicate runtime name", (registry) => { registry.roles[1].runtime_name = registry.roles[0].runtime_name; }, "duplicate runtime_name"],
    ["missing blind pass A", (registry) => { delete registry.roles[9].review_protocol.pass_a; }, "role 10 pass_a"],
    ["missing blind pass B", (registry) => { delete registry.roles[9].review_protocol.pass_b; }, "role 10 pass_b"],
    ["optional role 10", (registry) => { registry.roles[9].activation.mandatory = false; }, "role 10 activation.mandatory"],
    ["unstructured blind pass A", (registry) => { registry.roles[9].review_protocol.pass_a = "present"; }, "role 10 pass_a"],
    ["unstructured blind pass B", (registry) => { registry.roles[9].review_protocol.pass_b = { x: "y" }; }, "role 10 pass_b"],
  ])("rejects %s", async (_label, mutate, expectedMessage) => {
    const registry = await readCanonicalRegistry();
    mutate(registry);

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(expectedMessage);
  });

  it("requires a structured tier-to-mandatory-role routing invariant", async () => {
    const registry = await readCanonicalRegistry();
    registry.activation_policy.mandatory_role_ids_by_tier = {
      L0: ["coordinator-teamlead"],
      L1: ["coordinator-teamlead", "qa-evidence-release-verification"],
      L2: ["coordinator-teamlead", "qa-evidence-release-verification"],
      L3: [
        "coordinator-teamlead",
        "qa-evidence-release-verification",
        "independent-blind-spot-sentinel",
      ],
      L4: ["coordinator-teamlead"],
    };

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "activation_policy mandatory_role_ids_by_tier.L4",
    );
  });

  it("keeps mandatory role metadata consistent with the structured tier map", async () => {
    const registry = await readCanonicalRegistry();
    const role8 = registry.roles.find((role) => role.slot === 8);
    role8.activation.mandatory = false;

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "role 8 activation.mandatory must equal true",
    );
  });

  it.each([
    ["CONCRETE_EMOTIONAL_OR_CLINICAL_PRODUCT_CLAIM", "psychology-human-factors-emotional-safety"],
    ["UI_ACCESSIBILITY_I18N", "interaction-accessibility-readability-localization-culture"],
    ["ARCHITECTURE_PERSISTENCE_SYNC_MIGRATION", "technical-architecture-data-cross-platform"],
    ["SECURITY_PRIVACY_AUTH_EXTERNAL_WRITE", "security-privacy-agent-trust"],
    ["BEST_PRACTICES_OR_COMPLETENESS", "independent-blind-spot-sentinel"],
  ])("rejects a selection record that omits the matched owner for %s", async (triggerId, ownerId) => {
    const registry = await readCanonicalRegistry();
    const record = selectionRecord(registry, {
      riskTier: "L2",
      triggerIds: [triggerId],
      selectedRoleIds: ["coordinator-teamlead", "qa-evidence-release-verification"],
    });

    const result = validateRoleSelectionRecord(registry, record);

    expect(result.errors.join("\n")).toContain(`matched trigger ${triggerId} requires role ${ownerId}`);
  });

  it("accepts the smallest selection that includes every tier and matched-domain owner", async () => {
    const registry = await readCanonicalRegistry();
    const selectedRoleIds = [
      "coordinator-teamlead",
      "qa-evidence-release-verification",
      "technical-architecture-data-cross-platform",
      "security-privacy-agent-trust",
    ];
    const record = selectionRecord(registry, {
      riskTier: "L2",
      triggerIds: [
        "ARCHITECTURE_PERSISTENCE_SYNC_MIGRATION",
        "SECURITY_PRIVACY_AUTH_EXTERNAL_WRITE",
      ],
      selectedRoleIds,
    });

    expect(validateRoleSelectionRecord(registry, record)).toEqual({ errors: [], warnings: [] });
  });

  it("rejects governance routing that omits the M2 sentinel", async () => {
    const registry = await readCanonicalRegistry();
    const record = selectionRecord(registry, {
      riskTier: "L2",
      triggerIds: ["GOVERNANCE_OR_ORCHESTRATION"],
      selectedRoleIds: [
        "coordinator-teamlead",
        "qa-evidence-release-verification",
        "logic-causality-state-coherence",
        "security-privacy-agent-trust",
      ],
    });

    expect(validateRoleSelectionRecord(registry, record).errors.join("\n")).toContain(
      "selection record requires role independent-blind-spot-sentinel",
    );
  });

  it("rejects a tier that understates the observed assurance class", async () => {
    const registry = await readCanonicalRegistry();
    const record = selectionRecord(registry, {
      riskTier: "L2",
      triggerIds: ["GOVERNANCE_OR_ORCHESTRATION"],
      selectedRoleIds: [
        "coordinator-teamlead",
        "qa-evidence-release-verification",
        "logic-causality-state-coherence",
        "security-privacy-agent-trust",
        "independent-blind-spot-sentinel",
      ],
    });

    expect(validateRoleSelectionRecord(registry, record).errors.join("\n")).toContain(
      "risk_tier L2 is inconsistent with M2_PROTECTED_HIGH_RISK",
    );
  });

  it("requires every role for an explicit deep audit", async () => {
    const registry = await readCanonicalRegistry();
    const record = selectionRecord(registry, {
      riskTier: "L2",
      triggerIds: ["DEEP_AUDIT"],
      selectedRoleIds: [
        "coordinator-teamlead",
        "qa-evidence-release-verification",
        "independent-blind-spot-sentinel",
      ],
    });

    expect(validateRoleSelectionRecord(registry, record).errors).toContain(
      "selection record requires role psychology-human-factors-emotional-safety",
    );
  });

  it("rejects ritual over-selection without a trigger or rollback mode", async () => {
    const registry = await readCanonicalRegistry();
    const record = selectionRecord(registry, {
      riskTier: "L2",
      triggerIds: [],
      selectedRoleIds: registry.roles.map((role) => role.id),
    });

    expect(validateRoleSelectionRecord(registry, record).errors.join("\n")).toContain(
      "selection record selected unrelated role",
    );
  });

  it("rejects selected or skipped roles without evidence locators", async () => {
    const registry = await readCanonicalRegistry();
    const record = selectionRecord(registry, {
      riskTier: "L2",
      triggerIds: ["ARCHITECTURE_PERSISTENCE_SYNC_MIGRATION"],
      selectedRoleIds: [
        "coordinator-teamlead",
        "qa-evidence-release-verification",
        "technical-architecture-data-cross-platform",
      ],
    });
    delete record.skipped_roles[0].evidence_locators;

    expect(validateRoleSelectionRecord(registry, record).errors.join("\n")).toContain(
      "skipped_roles[0] evidence_locators",
    );
  });

  it("rejects accidental semantic flattening even when list shapes stay valid", async () => {
    const registry = await readCanonicalRegistry();
    for (const role of registry.roles) {
      role.checks = ["Check the task carefully and report anything important with evidence."];
      role.outputs = ["Return a useful report for the coordinator."];
      role.counter_hypotheses = ["The first idea might not be correct."];
    }

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.filter((message) => message.includes("semantic_contract_sha256 mismatch"))).toHaveLength(10);
  });

  it("requires the stable semantic invariant IDs even if a checksum is recomputed", async () => {
    const registry = await readCanonicalRegistry();
    const role2 = registry.roles[1];
    role2.semantic_invariant_ids.shift();
    role2.semantic_contract_sha256 = computeRoleSemanticContractHash(role2);

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain("role 2 semantic_invariant_ids");
  });

  it("requires matched-domain roles to be mandatory only when their trigger is observed", async () => {
    const registry = await readCanonicalRegistry();
    const role6 = registry.roles[5];
    role6.activation.mandatory_on_trigger = false;
    role6.semantic_contract_sha256 = computeRoleSemanticContractHash(role6);

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain("role 6 activation.mandatory_on_trigger must equal true");
  });

  it("keeps the no-AI-template grounding rule inside every generated profile contract", async () => {
    const registry = await readCanonicalRegistry();
    delete registry.universal_output_contract.grounding_rule;

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain("universal_output_contract grounding_rule");
  });

  it("requires every protected human-escalation category exactly once", async () => {
    const registry = await readCanonicalRegistry();
    registry.human_escalation_policy.categories = [{ x: "y" }];

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "human_escalation_policy categories must contain the exact protected category set",
    );
  });

  it("requires hash-bound Pass A isolation and Pass B closure controls", async () => {
    const registry = await readCanonicalRegistry();
    registry.roles[9].review_protocol.pass_a.context_manifest_sha256_required = false;
    registry.roles[9].review_protocol.pass_b.recompute_hashes_required = false;

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "role 10 pass_a.context_manifest_sha256_required must equal true",
    );
    expect(result.errors.join("\n")).toContain(
      "role 10 pass_b.recompute_hashes_required must equal true",
    );
  });

  it("fails closed when the structured private-data boundary is weakened", async () => {
    const registry = await readCanonicalRegistry();
    registry.trust_envelope.private_data_policy = {
      raw_sensitive_content: "ALLOWED",
      minimization_required: false,
      synthetic_fixtures: "ALLOWED_IN_PRODUCTION",
    };

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "trust_envelope private_data_policy.raw_sensitive_content must equal FORBIDDEN",
    );
  });

  it("requires non-overridable denied capability IDs for every role", async () => {
    const registry = await readCanonicalRegistry();
    registry.roles[5].tool_policy.inherits_global_denials = false;
    registry.roles[5].tool_policy.denied_capabilities = ["No capabilities are denied."];

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "role at index 5 tool_policy.inherits_global_denials must equal true",
    );
  });

  it("requires one canonical eval-only output adapter matching the candidate envelope", async () => {
    const registry = await readCanonicalRegistry();
    registry.evaluation_adapter.required_keys = ["ROLE", "VERDICT"];

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "evaluation_adapter required_keys must equal schema_version, role_id, scenario_id, run_id, attempt_id, attempt_nonce",
    );
  });

  it("requires role 10 to route every specialist-owned blocker instead of self-resolving", async () => {
    const registry = await readCanonicalRegistry();
    delete registry.roles[9].review_protocol.domain_routing.performance_reliability_operations;

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(
      "role 10 domain_routing must contain the exact canonical owner map",
    );
  });

  it("validates calendar dates without Date.parse normalization", () => {
    expect(isExactIsoDate("2026-02-28")).toBe(true);
    expect(isExactIsoDate("2026-02-29")).toBe(false);
    expect(isExactIsoDate("2024-02-29")).toBe(true);
    expect(isExactIsoDate("2026-02-31")).toBe(false);
    expect(isExactIsoDate("2026-2-03")).toBe(false);
  });

  it("rejects generated prompts that exceed the declared byte budget", async () => {
    const registry = await readCanonicalRegistry();
    registry.prompt_budgets.max_generated_profile_bytes = 1_000;

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain("generated profile byte budget");
  });

  it("pins the reviewed profile compaction baseline and threshold", async () => {
    const waivers = await readCanonicalWaivers();
    const inflated = await readCanonicalRegistry();
    inflated.prompt_budgets.profile_compaction.baseline_total_bytes = 999_999_999;
    inflated.prompt_budgets.profile_compaction.minimum_structural_reduction_percent = 0;
    expect(validateRegistry(inflated, { now: FIXED_NOW, waivers }).errors.join("\n")).toMatch(
      /baseline_total_bytes|minimum_structural_reduction_percent/i,
    );

    const missing = await readCanonicalRegistry();
    delete missing.prompt_budgets.profile_compaction.baseline_total_bytes;
    delete missing.prompt_budgets.profile_compaction.minimum_structural_reduction_percent;
    expect(validateRegistry(missing, { now: FIXED_NOW, waivers }).errors.join("\n")).toMatch(
      /baseline_total_bytes|minimum_structural_reduction_percent/i,
    );
  });

  it("fails a stale operational source without a valid external waiver", async () => {
    const registry = await readCanonicalRegistry();
    registry.source_review.sources[0].reviewed_on = "2020-01-01";
    refreshSourceRecordHash(registry.source_review.sources[0]);

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain("stale source");
  });

  it("rejects a source URL moved to an untrusted origin", async () => {
    const registry = await readCanonicalRegistry();
    registry.source_review.sources[0].url = "https://attacker.example/codex/subagents";

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain("must use its canonical authoritative URL");
  });

  it("does not let typed approver text turn an unauthenticated waiver into authority", async () => {
    const registry = await readCanonicalRegistry();
    const staleSource = registry.source_review.sources[0];
    staleSource.reviewed_on = "2020-01-01";
    refreshSourceRecordHash(staleSource);
    const waivers = await readCanonicalWaivers();
    waivers.waivers.push({
      source_id: staleSource.id,
      reason: "The source could not be refreshed during this bounded test window.",
      affected_roles: [...staleSource.roles],
      tracking_reference: "FAKE-123",
      human_approver: "Jane Smith",
      expires_on: "2026-07-20",
      removal_condition: "Refresh the authoritative source and remove this waiver.",
    });

    const result = validateRegistry(registry, { now: FIXED_NOW, waivers });

    expect(result.errors.join("\n")).toContain("stale source");
    expect(result.warnings.join("\n")).toContain("approver provenance remains UNVERIFIED");
  });

  it("writes and checks a complete deterministic workspace", async () => {
    const rootDir = await createWorkspace();

    await syncWorkspace({ rootDir, mode: "write", now: FIXED_NOW });
    const result = await checkWorkspace({ rootDir, now: FIXED_NOW });

    expect(result.errors).toEqual([]);
    expect(result.profilePaths).toHaveLength(10);
  });

  it("rejects duplicate canonical JSON keys instead of accepting the last value", async () => {
    const rootDir = await createWorkspace();
    const registryPath = path.join(rootDir, "config/persistent-agent-orchestra.json");
    const registry = (await readFile(registryPath, "utf8")).trimEnd();
    const duplicate = registry.replace(
      /\n}\s*$/,
      ',\n  "hard_stop_policy": {"weakened_last_value": true}\n}\n',
    );
    await writeFile(registryPath, duplicate, "utf8");

    const result = await syncWorkspace({ rootDir, mode: "write", now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("duplicate JSON key: hard_stop_policy");
    expect(result.writtenPaths).toEqual([]);
  });

  it("rejects hardlinked canonical inputs and generated profiles", async () => {
    const inputRoot = await createWorkspace();
    const outsideRoot = await mkdtemp(path.join(tmpdir(), "zenflow-agent-orchestra-outside-"));
    temporaryRoots.push(outsideRoot);
    const registryPath = path.join(inputRoot, "config/persistent-agent-orchestra.json");
    const outsideRegistry = path.join(outsideRoot, "registry.json");
    await writeFile(outsideRegistry, await readFile(registryPath, "utf8"), "utf8");
    await unlink(registryPath);
    await link(outsideRegistry, registryPath);

    const inputResult = await syncWorkspace({ rootDir: inputRoot, mode: "write", now: FIXED_NOW });
    expect(inputResult.errors.join("\n")).toMatch(/multiple hard links|hardlink/i);

    const generatedRoot = await createGeneratedWorkspace();
    const profilePath = path.join(
      generatedRoot,
      ".codex/agents/01-coordinator-teamlead.toml",
    );
    const outsideProfile = path.join(outsideRoot, "profile.toml");
    await writeFile(outsideProfile, await readFile(profilePath, "utf8"), "utf8");
    await unlink(profilePath);
    await link(outsideProfile, profilePath);

    const generatedResult = await checkWorkspace({ rootDir: generatedRoot, now: FIXED_NOW });
    expect(generatedResult.errors.join("\n")).toMatch(/multiple hard links|hardlink/i);
  });

  it.runIf(process.platform !== "win32")("rolls back every managed artifact when a later write fails", async () => {
    const rootDir = await createWorkspace();
    await mkdir(path.join(rootDir, ".codex/agents"), { recursive: true });
    const configPath = path.join(rootDir, ".codex/config.toml");
    const original = "# stale config\n";
    await writeFile(configPath, original, "utf8");
    await chmod(path.join(rootDir, ".codex/agents"), 0o555);

    try {
      const result = await syncWorkspace({ rootDir, mode: "write", now: FIXED_NOW });

      expect(result.errors.join("\n")).toContain("unable to write managed artifact");
      expect(await readFile(configPath, "utf8")).toBe(original);
      expect(result.writtenPaths).toEqual([]);
    } finally {
      await chmod(path.join(rootDir, ".codex/agents"), 0o755);
    }
  });

  it("fails closed when a required generated profile is missing", async () => {
    const rootDir = await createGeneratedWorkspace();
    await unlink(path.join(rootDir, ".codex/agents/10-independent-blind-spot-sentinel.toml"));

    const result = await checkWorkspace({ rootDir, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("missing managed artifact");
  });

  it("rejects an undeclared project profile", async () => {
    const rootDir = await createGeneratedWorkspace();
    await writeFile(
      path.join(rootDir, ".codex/agents/11-generic-reviewer.toml"),
      'name = "zenflow-11-generic-reviewer"\n',
      "utf8",
    );

    const result = await checkWorkspace({ rootDir, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("undeclared project profile");
  });

  it("rejects byte drift in a generated profile", async () => {
    const rootDir = await createGeneratedWorkspace();
    const profilePath = path.join(rootDir, ".codex/agents/02-psychology-human-factors-emotional-safety.toml");
    const current = await readFile(profilePath, "utf8");
    await writeFile(profilePath, `${current}\n# hand edited\n`, "utf8");

    const result = await checkWorkspace({ rootDir, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("managed artifact drift");
  });
});

function selectionRecord(registry, { riskTier, triggerIds, selectedRoleIds }) {
  const selected = new Set(selectedRoleIds);
  return {
    risk_tier: riskTier,
    routing_mode: "EVIDENCE_FIRST_ADAPTIVE",
    observed_trigger_ids: triggerIds,
    selected_roles: registry.roles
      .filter((role) => selected.has(role.id))
      .map((role) => ({
        role_id: role.id,
        reason: `Selected for ${riskTier} tier or an observed domain trigger.`,
        evidence_locators: ["config/persistent-agent-orchestra.json:activation_policy"],
      })),
    skipped_roles: registry.roles
      .filter((role) => !selected.has(role.id))
      .map((role) => ({
        role_id: role.id,
        reason: "No observed trigger or tier rule requires this role for the bounded task.",
        evidence_locators: ["config/persistent-agent-orchestra.json:risk_classification_registry"],
      })),
  };
}

function refreshSourceRecordHash(source) {
  const record = { ...source };
  delete record.source_record_hash;
  source.source_record_hash = sha256Canonical(record);
}

async function readCanonicalRegistry() {
  return JSON.parse(
    await readFile(path.join(REPO_ROOT, "config/persistent-agent-orchestra.json"), "utf8"),
  );
}

async function readCanonicalWaivers() {
  return JSON.parse(
    await readFile(
      path.join(REPO_ROOT, "config/persistent-agent-orchestra.source-waivers.json"),
      "utf8",
    ),
  );
}

async function createWorkspace() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "zenflow-agent-orchestra-"));
  temporaryRoots.push(rootDir);
  await mkdir(path.join(rootDir, "config"), { recursive: true });
  await mkdir(path.join(rootDir, "docs/ai"), { recursive: true });
  await writeFile(
    path.join(rootDir, "config/persistent-agent-orchestra.json"),
    await readFile(path.join(REPO_ROOT, "config/persistent-agent-orchestra.json"), "utf8"),
    "utf8",
  );
  await writeFile(
    path.join(rootDir, "config/persistent-agent-orchestra.source-waivers.json"),
    await readFile(
      path.join(REPO_ROOT, "config/persistent-agent-orchestra.source-waivers.json"),
      "utf8",
    ),
    "utf8",
  );
  return rootDir;
}

async function createGeneratedWorkspace() {
  const rootDir = await createWorkspace();
  await syncWorkspace({ rootDir, mode: "write", now: FIXED_NOW });
  return rootDir;
}
