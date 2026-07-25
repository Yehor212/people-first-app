import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, open, readdir, readlink } from "node:fs/promises";
import path from "node:path";

export const ASSURANCE_AGGREGATE_PRECEDENCE = Object.freeze([
  "INTEGRITY_FAILED",
  "BLOCKED",
  "NEEDS_AUTHORITY",
  "EXECUTION_INCOMPLETE",
  "AUTHORIZED_WITH_ACCEPTED_RISK",
  "COMPLETE_WITH_UNVERIFIED",
  "GO_FOR_PROVEN_SCOPE",
]);
export const ASSURANCE_RISK_REGISTRY_DIGEST = "061aac41532f1c928cbcaca38f5b7c2e33f61a4e303e5382c6c04d0c05f9e88a";
export const ASSURANCE_SCOPE_OWNERSHIP_PREFIXES = Object.freeze({
  "coordinator-teamlead": ["coordination.", "routing.", "integration."],
  "psychology-human-factors-emotional-safety": ["psychology.", "human_factors.", "emotional_safety.", "motivation."],
  "logic-causality-state-coherence": ["logic.", "causality.", "state."],
  "interaction-accessibility-readability-localization-culture": [
    "accessibility.", "wcag.", "assistive_technology.", "readability.",
    "locale.", "rtl.", "bidi.", "culture.",
  ],
  "technical-architecture-data-cross-platform": [
    "architecture.", "data.", "storage.", "sync.", "platform.", "migration.",
  ],
  "security-privacy-agent-trust": ["security.", "privacy.", "auth.", "agent_trust."],
  "performance-reliability-operations": ["performance.", "reliability.", "operations.", "lifecycle."],
  "qa-evidence-release-verification": ["qa.", "evidence.", "release.", "verification."],
  "product-discovery-visual-craft-experience-quality": ["product.", "experience.", "visual_craft.", "value."],
  "independent-blind-spot-sentinel": ["blind_spot.", "closure_audit.", "integrity_audit."],
});
const ASSURANCE_RUNTIME_IDENTITIES = Object.freeze({
  "coordinator-teamlead": "zenflow-01-coordinator-teamlead",
  "psychology-human-factors-emotional-safety": "zenflow-02-psychology-human-factors-emotional-safety",
  "logic-causality-state-coherence": "zenflow-03-logic-causality-state-coherence",
  "interaction-accessibility-readability-localization-culture": "zenflow-04-interaction-accessibility-readability-localization-culture",
  "technical-architecture-data-cross-platform": "zenflow-05-technical-architecture-data-cross-platform",
  "security-privacy-agent-trust": "zenflow-06-security-privacy-agent-trust",
  "performance-reliability-operations": "zenflow-07-performance-reliability-operations",
  "qa-evidence-release-verification": "zenflow-08-qa-evidence-release-verification",
  "product-discovery-visual-craft-experience-quality": "zenflow-09-product-discovery-visual-craft-experience-quality",
  "independent-blind-spot-sentinel": "zenflow-10-independent-blind-spot-sentinel",
});
export const ASSURANCE_BUILD_ARTIFACT_PATHS = Object.freeze([
  "AGENTS.md",
  "package.json",
  ".codex/config.toml",
  "config/persistent-agent-orchestra.json",
  "config/persistent-agent-orchestra.evals.json",
  "config/persistent-agent-orchestra.source-waivers.json",
  "scripts/sync-persistent-agent-orchestra.mjs",
  "scripts/run-ten-lens-assurance.mjs",
  "scripts/validate-persistent-agent-orchestra-eval-report.mjs",
  "scripts/persistent-agent-orchestra/assurance-core.mjs",
  "scripts/persistent-agent-orchestra/eval-core.mjs",
  "scripts/persistent-agent-orchestra/registry-core.mjs",
  "scripts/persistent-agent-orchestra/secure-read.mjs",
  "scripts/persistent-agent-orchestra/strict-json.mjs",
  "scripts/rag/preflight.ts",
  "scripts/rag/corpus-manifest.json",
  "docs/ai/TEN_LENS_EVIDENCE_ASSURANCE_V2_2_1.md",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA_DESIGN.md",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md",
  "docs/ai/AGENT_CONTEXT_PERSISTENCE.md",
  "docs/ai/FREE_RAG_AND_COACH_LITE.md",
  "docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md",
  ".codex/agents/01-coordinator-teamlead.toml",
  ".codex/agents/02-psychology-human-factors-emotional-safety.toml",
  ".codex/agents/03-logic-causality-state-coherence.toml",
  ".codex/agents/04-interaction-accessibility-readability-localization-culture.toml",
  ".codex/agents/05-technical-architecture-data-cross-platform.toml",
  ".codex/agents/06-security-privacy-agent-trust.toml",
  ".codex/agents/07-performance-reliability-operations.toml",
  ".codex/agents/08-qa-evidence-release-verification.toml",
  ".codex/agents/09-product-discovery-visual-craft-experience-quality.toml",
  ".codex/agents/10-independent-blind-spot-sentinel.toml",
]);
export const ASSURANCE_CLASS_RULES = Object.freeze({
  M0_MECHANICAL: {
    all_ten_required: false,
    mandatory_role_ids: ["coordinator-teamlead", "qa-evidence-release-verification"],
  },
  M1_MATERIAL: {
    all_ten_required: false,
    mandatory_role_ids: ["coordinator-teamlead", "qa-evidence-release-verification"],
  },
  M2_PROTECTED_HIGH_RISK: {
    all_ten_required: false,
    mandatory_role_ids: [
      "coordinator-teamlead",
      "qa-evidence-release-verification",
      "independent-blind-spot-sentinel",
    ],
  },
});
export const ASSURANCE_TRIGGER_RULES = Object.freeze({
  MECHANICAL_ONLY: { task_class: "M0_MECHANICAL", role_ids: ["qa-evidence-release-verification"] },
  GOVERNANCE_OR_ORCHESTRATION: {
    task_class: "M2_PROTECTED_HIGH_RISK",
    role_ids: ["logic-causality-state-coherence", "security-privacy-agent-trust"],
  },
  PROTECTED_SURFACE: {
    task_class: "M2_PROTECTED_HIGH_RISK",
    role_ids: ["technical-architecture-data-cross-platform", "security-privacy-agent-trust"],
  },
  BEST_PRACTICES_OR_COMPLETENESS: {
    task_class: "M2_PROTECTED_HIGH_RISK",
    role_ids: ["independent-blind-spot-sentinel"],
  },
  DEEP_AUDIT: {
    task_class: "M2_PROTECTED_HIGH_RISK",
    role_ids: ["independent-blind-spot-sentinel"],
    full_council: true,
  },
  MATERIAL_AMBIGUITY: {
    task_class: "M1_MATERIAL",
    role_ids: ["logic-causality-state-coherence", "independent-blind-spot-sentinel"],
  },
  CONCRETE_EMOTIONAL_OR_CLINICAL_PRODUCT_CLAIM: {
    task_class: "M1_MATERIAL",
    role_ids: ["psychology-human-factors-emotional-safety"],
  },
  AGENCY_PRESSURE_INTERRUPTION_RECOVERY: {
    task_class: "M1_MATERIAL",
    role_ids: ["psychology-human-factors-emotional-safety"],
  },
  CAUSAL_STATE_OR_POLICY_COHERENCE: {
    task_class: "M1_MATERIAL",
    role_ids: ["logic-causality-state-coherence"],
  },
  UI_ACCESSIBILITY_I18N: {
    task_class: "M1_MATERIAL",
    role_ids: ["interaction-accessibility-readability-localization-culture"],
  },
  ARCHITECTURE_PERSISTENCE_SYNC_MIGRATION: {
    task_class: "M1_MATERIAL",
    role_ids: ["technical-architecture-data-cross-platform"],
  },
  SECURITY_PRIVACY_AUTH_EXTERNAL_WRITE: {
    task_class: "M1_MATERIAL",
    role_ids: ["security-privacy-agent-trust"],
  },
  PERFORMANCE_RELIABILITY_LIFECYCLE: {
    task_class: "M1_MATERIAL",
    role_ids: ["performance-reliability-operations"],
  },
  PRODUCT_DISCOVERY_VISUAL_ACCEPTANCE: {
    task_class: "M1_MATERIAL",
    role_ids: ["product-discovery-visual-craft-experience-quality"],
  },
});

const DECISIONS = new Set(["GO", "STOP", "ASK"]);
const ASK_KINDS = new Set([
  "NONE",
  "MISSING_INPUT",
  "AUTHORITY_DECISION",
  "CAPABILITY_UNAVAILABLE",
  "AMBIGUOUS_SCOPE",
  "BUDGET_EXHAUSTED",
]);
const ASSURANCE_STATUSES = new Set([
  "VERIFIED",
  "UNVERIFIED",
  "NOT_APPLICABLE_WITH_EVIDENCE",
]);
const EXECUTION_MODES = new Set([
  "AUTOMATED",
  "OPERATOR_ASSISTED",
  "DETERMINISTIC_ONLY",
  "NOT_APPLICABLE",
]);
const EXECUTION_STATES = new Set([
  "NOT_STARTED",
  "PREPARED",
  "RUNNING",
  "EXECUTED",
  "INGESTED",
  "VALIDATED",
  "FAILED",
  "TIMED_OUT",
  "CANCELLED",
  "DENIED",
]);
const EXECUTION_RESULTS = new Set(["PASS", "FAIL", "NO_ASSERTION"]);
const CLOSURE_STATUSES = new Set([
  "NOT_REQUIRED",
  "OPEN",
  "RESOLVED_WITH_RECHECKED_EVIDENCE",
  "REJECTED_WITH_RECHECKED_EVIDENCE",
  "ESCALATION_PENDING",
  "ACCEPTED_RISK_BY_VERIFIED_AUTHORITY",
  "REJECTED_BY_VERIFIED_AUTHORITY",
]);
const EVIDENCE_RESOLUTIONS = new Set([
  "OPEN",
  "VERIFIED_RESOLVED",
  "VERIFIED_REJECTED",
  "UNVERIFIED",
]);
const RISK_DECISIONS = new Set([
  "NONE",
  "ACCEPTED_BY_VERIFIED_AUTHORITY",
  "REJECTED_BY_VERIFIED_AUTHORITY",
]);
const WAIVABILITY = new Set([
  "NON_WAIVABLE",
  "OWNER_WAIVABLE",
  "QUALIFIED_AUTHORITY_ONLY",
]);
const REQUIRED_RUNTIME_CHANNELS = Object.freeze([
  "CODEX_HISTORY",
  "CODEX_LOGS",
  "CODEX_OTEL",
  "AGENTS_SDK_TRACES",
  "SUBAGENT_STATE",
  "SHELL_LOGS",
  "CI_ARTIFACTS",
  "TEMPORARY_ARTIFACTS",
  "HOSTED_PRODUCT_RETENTION",
]);
const M2_REVIEW_ROLE_IDS = Object.freeze([
  "psychology-human-factors-emotional-safety",
  "logic-causality-state-coherence",
  "interaction-accessibility-readability-localization-culture",
  "technical-architecture-data-cross-platform",
  "security-privacy-agent-trust",
  "performance-reliability-operations",
  "qa-evidence-release-verification",
  "product-discovery-visual-craft-experience-quality",
]);
const M2_SENTINEL_ROLE_ID = "independent-blind-spot-sentinel";
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEVERITY_RANK = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });
const MANIFEST_DEPENDENCY_FIELDS = Object.freeze({
  subject_snapshot: "subject_scoped_snapshot_sha256",
  policy: "policy_hash",
  profile_set: "profile_set_hash",
  source_ledger: "source_ledger_hash",
  schema: "schema_hash",
  runtime_inventory: "runtime_inventory_hash",
  tool_inventory: "tool_inventory_hash",
  model_reasoning: "model_reasoning_hash",
  verification_plan: "verification_plan_hash",
  risk_registry: "classification_registry_digest",
});
const DIRECT_RECHECK_STATUSES = new Set([
  "RECHECKED",
  "UNVERIFIED",
  "NOT_APPLICABLE_WITH_EVIDENCE",
]);
const PASS_A_ALLOWED_EVIDENCE_CLASSES = Object.freeze([
  "RAW_DIRECT_REQUEST",
  "NEUTRAL_TRUSTED_POLICY",
  "PRE_SOLUTION_REPOSITORY_STATE",
]);
const PASS_A_FORBIDDEN_LOCATOR_PREFIXES = Object.freeze([
  "coordinator-solution:",
  "coordinator-hypothesis:",
  "final-diff:",
  "prior-verdict:",
  "post-solution:",
]);
const GOVERNANCE_PROTECTED_PATH_PATTERNS = Object.freeze([
  /(^|\/)AGENTS\.md$/,
  /(^|\/)package\.json$/,
  /(^|\/)\.codex\//,
  /(^|\/)docs\/ai\//,
  /(^|\/)config\/persistent-agent-orchestra(?:\.|\/)/,
  /(^|\/)scripts\//,
]);
const GOVERNANCE_PROTECTED_SYMBOLS = new Set([
  "assurance_protocol",
  "risk_classification_registry",
  "aggregateAssuranceRun",
  "validateRunManifest",
]);
const PROTECTED_MANIFEST_CATEGORY_FIELDS = Object.freeze([
  "affected_capabilities",
  "affected_data_effects",
  "affected_external_actions",
  "affected_schema_changes",
  "affected_permission_changes",
  "affected_release_surfaces",
]);
const REQUIRED_PLATFORM_DOMAIN_KEYS = Object.freeze([
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
]);
const PLATFORM_DOMAIN_STATUSES = new Set([
  "IN_SCOPE",
  "OUT_OF_SCOPE",
  "UNVERIFIED",
  "NOT_APPLICABLE_WITH_EVIDENCE",
]);
const M0_TRANSFORMATION_IDS = new Set([
  "DOC_TYPO_NO_SEMANTIC_DELTA",
  "CANONICAL_GENERATED_COUNT",
  "FORMAT_ONLY_AST_EQUIVALENT",
]);
const MINIMUM_TOTAL_TOKEN_REDUCTION_PERCENT = 5;
const MAX_GIT_CAPTURE_BYTES = 64 * 1024 * 1024;

export function sha256Canonical(value) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

export async function buildAssuranceImplementationIdentity(rootDir = process.cwd()) {
  const resolvedRoot = path.resolve(rootDir);
  const discoveredInventory = await inventoryPaths(
    resolvedRoot,
    ASSURANCE_BUILD_ARTIFACT_PATHS,
    false,
  );
  const inventoryByPath = new Map(discoveredInventory.map(function byPath(artifact) {
    return [artifact.path, artifact];
  }));
  const artifactInventory = ASSURANCE_BUILD_ARTIFACT_PATHS.map(function canonicalOrder(artifactPath) {
    return inventoryByPath.get(artifactPath);
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

export function classifyAssuranceTask(registry, observedTriggerIds, options = {}) {
  const protocol = registry && registry.assurance_protocol;
  const riskRegistry = protocol && protocol.risk_classification_registry;
  if (!isRecord(riskRegistry)) throw new Error("assurance risk classification registry is missing");
  const uniqueTriggers = uniqueStrings(observedTriggerIds);
  const triggerMap = new Map();
  for (const item of riskRegistry.triggers || []) triggerMap.set(item.id, item);
  const unknownTriggers = uniqueTriggers.filter(function unknownTrigger(triggerId) {
    return !triggerMap.has(triggerId);
  });
  if (unknownTriggers.length > 0) {
    throw new Error(`unknown assurance trigger: ${unknownTriggers.join(", ")}`);
  }
  const rank = { M0_MECHANICAL: 0, M1_MATERIAL: 1, M2_PROTECTED_HIGH_RISK: 2 };
  const matchedTriggers = uniqueTriggers.filter(function knownTrigger(triggerId) {
    return triggerMap.has(triggerId);
  });
  let taskClass = matchedTriggers.length === 1 && matchedTriggers[0] === "MECHANICAL_ONLY"
    ? "M0_MECHANICAL"
    : riskRegistry.default_task_class;
  for (const triggerId of matchedTriggers) {
    const candidate = triggerMap.get(triggerId);
    if (candidate && rank[taskClass] < rank[candidate.task_class]) taskClass = candidate.task_class;
  }
  const classPolicy = riskRegistry.classes[taskClass];
  if (!isRecord(classPolicy)) throw new Error(`unknown assurance task class: ${taskClass}`);
  const roleIds = registry.roles.map(function roleId(role) {
    return role.id;
  });
  const routingMode = options.routingMode || riskRegistry.routing_modes?.default || "EVIDENCE_FIRST_ADAPTIVE";
  if (!["EVIDENCE_FIRST_ADAPTIVE", "FIXED_FULL_TEN"].includes(routingMode)) {
    throw new Error(`unknown assurance routing mode: ${routingMode}`);
  }
  const fullCouncil = taskClass !== "M0_MECHANICAL" && (
    routingMode === "FIXED_FULL_TEN" ||
    matchedTriggers.some(function requiresFullCouncil(triggerId) {
      return triggerMap.get(triggerId)?.full_council === true;
    })
  );
  const mandatoryRoleIds = fullCouncil || classPolicy.all_ten_required === true
    ? roleIds
    : uniqueStrings([
      ...(classPolicy.mandatory_role_ids || []),
      ...matchedTriggers.flatMap(function triggeredRoles(triggerId) {
        const trigger = triggerMap.get(triggerId);
        return trigger ? trigger.role_ids || [] : [];
      }),
    ]);
  return {
    task_class: taskClass,
    routing_mode: routingMode,
    matched_triggers: matchedTriggers,
    considered_role_ids: roleIds,
    mandatory_role_ids: mandatoryRoleIds,
    mandatory_phases: buildMandatoryPhases(taskClass, roleIds, mandatoryRoleIds, routingMode),
    classification_registry_version: riskRegistry.version,
    classification_registry_digest: sha256Canonical(riskRegistry),
  };
}

function buildMandatoryPhases(taskClass, roleIds, mandatoryRoleIds, routingMode = "EVIDENCE_FIRST_ADAPTIVE") {
  if (taskClass === "M0_MECHANICAL") {
    return [{ role_id: "qa-evidence-release-verification", phase: "DETERMINISTIC_REVIEW" }];
  }
  if (routingMode === "FIXED_FULL_TEN") return buildLegacyFullTenPhases(roleIds);
  const selected = new Set(mandatoryRoleIds);
  const phases = [];
  if (selected.has(M2_SENTINEL_ROLE_ID)) {
    phases.push({ role_id: M2_SENTINEL_ROLE_ID, phase: "PASS_A" });
  }
  if (selected.has("psychology-human-factors-emotional-safety")) {
    phases.push({ role_id: "psychology-human-factors-emotional-safety", phase: "CREATE_BRIEF" });
  }
  const domainRoleIds = roleIds.slice(2, 9).filter(function selectedDomainRole(roleId) {
    return roleId !== "qa-evidence-release-verification" && selected.has(roleId);
  });
  for (const roleId of domainRoleIds) phases.push({ role_id: roleId, phase: "INITIAL_REVIEW" });
  if (selected.has("psychology-human-factors-emotional-safety")) {
    phases.push({
      role_id: "psychology-human-factors-emotional-safety",
      phase: "INDEPENDENT_FINAL_REVIEW",
    });
  }
  for (const roleId of domainRoleIds) phases.push({ role_id: roleId, phase: "FINAL_REVIEW" });
  if (selected.has("qa-evidence-release-verification")) {
    phases.push({ role_id: "qa-evidence-release-verification", phase: "QA_CLOSURE" });
  }
  if (selected.has(M2_SENTINEL_ROLE_ID)) {
    phases.push({ role_id: M2_SENTINEL_ROLE_ID, phase: "PASS_B" });
  }
  return phases;
}

function buildLegacyFullTenPhases(roleIds) {
  const phases = [{ role_id: roleIds[9], phase: "PASS_A" }];
  phases.push({ role_id: roleIds[0], phase: "ROLE_1_PREFLIGHT" });
  phases.push({ role_id: roleIds[1], phase: "CREATE_BRIEF" });
  for (let index = 2; index < 9; index += 1) {
    phases.push({ role_id: roleIds[index], phase: "INITIAL_REVIEW" });
  }
  phases.push({ role_id: roleIds[1], phase: "INDEPENDENT_FINAL_REVIEW" });
  for (let index = 2; index < 9; index += 1) {
    phases.push({
      role_id: roleIds[index],
      phase: roleIds[index] === "qa-evidence-release-verification"
        ? "QA_CLOSURE"
        : "FINAL_REVIEW",
    });
  }
  phases.push({ role_id: roleIds[9], phase: "PASS_B" });
  phases.push({ role_id: roleIds[0], phase: "ROLE_1_FINAL_INTEGRATION" });
  return phases;
}

export function validateRunManifest(manifest) {
  const errors = [];
  if (!isRecord(manifest)) return { errors: ["run manifest must be an object"] };
  requireExact(
    manifest.schema_version,
    "zenflow-ten-lens-run-manifest-v2.2.1-e1",
    "run manifest schema_version",
    errors,
  );
  requireExact(manifest.protocol_version, "2.2.1-e1", "run manifest protocol_version", errors);
  requireString(manifest.run_id, "run manifest run_id", errors);
  validateNonce(manifest.run_nonce, "run manifest run_nonce", errors);
  validateIso(manifest.issued_at, "run manifest issued_at", errors);
  if (!Number.isInteger(manifest.phase_sequence) || manifest.phase_sequence < 1) {
    errors.push("run manifest phase_sequence must be a positive integer");
  }
  requireEnum(
    manifest.task_class,
    new Set(["M0_MECHANICAL", "M1_MATERIAL", "M2_PROTECTED_HIGH_RISK"]),
    "run manifest task_class",
    errors,
  );
  requireEnum(
    manifest.routing_mode,
    new Set(["EVIDENCE_FIRST_ADAPTIVE", "FIXED_FULL_TEN"]),
    "run manifest routing_mode",
    errors,
  );
  requireExact(
    manifest.classification_registry_version,
    "zenflow-risk-registry-v2.2.1-e1",
    "run manifest classification_registry_version",
    errors,
  );
  validateStringArray(manifest.observed_trigger_ids, "run manifest observed_trigger_ids", errors);
  validateStringArray(manifest.mandatory_role_ids, "run manifest mandatory_role_ids", errors);
  const derivedTriggers = deriveManifestTriggers(manifest);
  for (const triggerId of derivedTriggers) {
    if (!manifest.observed_trigger_ids.includes(triggerId)) {
      errors.push(`run manifest is missing derived trigger ${triggerId}`);
    }
  }
  const effectiveTriggers = uniqueStrings([...manifest.observed_trigger_ids, ...derivedTriggers]);
  const expectedClassification = classifyManifestTriggers(
    effectiveTriggers,
    errors,
    manifest.routing_mode,
  );
  if (expectedClassification.task_class === "M0_MECHANICAL") {
    requireEnum(
      manifest.m0_transformation_id,
      M0_TRANSFORMATION_IDS,
      "run manifest m0_transformation_id",
      errors,
    );
  } else if (manifest.m0_transformation_id !== null) {
    errors.push("run manifest m0_transformation_id must be null outside M0");
  }
  if (manifest.task_class !== expectedClassification.task_class) {
    errors.push(`run manifest task_class must equal classified ${expectedClassification.task_class}`);
  }
  if (
    stableJson(uniqueStrings(manifest.mandatory_role_ids)) !==
    stableJson(uniqueStrings(expectedClassification.mandatory_role_ids))
  ) {
    errors.push("run manifest mandatory_role_ids must exactly match trigger classification");
  }
  validateRoleConsiderations(
    manifest.role_considerations,
    expectedClassification.mandatory_role_ids,
    errors,
  );
  if (!isRecord(manifest.direct_request)) {
    errors.push("run manifest direct_request must be an object");
  } else {
    validateHash(manifest.direct_request.content_sha256, "run manifest direct_request content_sha256", errors);
    requireString(manifest.direct_request.locator, "run manifest direct_request locator", errors);
    requireExact(manifest.direct_request.quoted_evidence_separated, true, "run manifest direct_request quoted_evidence_separated", errors);
    requireExact(manifest.direct_request.raw_private_content_included, false, "run manifest direct_request raw_private_content_included", errors);
  }
  for (const [field, requireNonEmpty] of [
    ["explicit_requirements", true],
    ["implied_requirements", true],
    ["non_goals", true],
    ["affected_paths", false],
    ["affected_routes", false],
    ["affected_symbols", false],
    ["affected_stores", false],
    ["affected_schemas", false],
    ["affected_data_flows", false],
    ["affected_capabilities", false],
    ["affected_data_effects", false],
    ["affected_external_actions", false],
    ["affected_schema_changes", false],
    ["affected_permission_changes", false],
    ["affected_release_surfaces", false],
    ["evidence_locators", true],
    ["unknowns", false],
  ]) {
    validateStringArray(manifest[field], `run manifest ${field}`, errors);
    if (requireNonEmpty && Array.isArray(manifest[field]) && manifest[field].length === 0) {
      errors.push(`run manifest ${field} must not be empty`);
    }
  }
  if (!isRecord(manifest.authority_write_scope)) {
    errors.push("run manifest authority_write_scope must be an object");
  } else {
    validateStringArray(manifest.authority_write_scope.readable_paths, "run manifest authority readable_paths", errors);
    validateStringArray(manifest.authority_write_scope.writable_paths, "run manifest authority writable_paths", errors);
    validateStringArray(manifest.authority_write_scope.external_actions, "run manifest authority external_actions", errors);
    requireExact(manifest.authority_write_scope.production_writes_allowed, false, "run manifest authority production_writes_allowed", errors);
  }
  if (manifest.sensitive_run !== true && manifest.sensitive_run !== false) {
    errors.push("run manifest sensitive_run must be boolean");
  }
  validatePassAVisibilityPolicy(manifest.pass_a_visibility_policy, errors);
  const expectedOriginalScopeHash = sha256Canonical({
    direct_request: manifest.direct_request,
    explicit_requirements: manifest.explicit_requirements,
    implied_requirements: manifest.implied_requirements,
    non_goals: manifest.non_goals,
    authority_write_scope: manifest.authority_write_scope,
  });
  if (manifest.original_scope_hash !== expectedOriginalScopeHash) {
    errors.push("run manifest original_scope_hash does not match bounded direct scope");
  }
  for (const oidField of ["subject_base_commit_oid", "head_oid", "repository_tracked_tree_oid"]) {
    if (typeof manifest[oidField] !== "string" || !/^[0-9a-f]{40,64}$/.test(manifest[oidField])) {
      errors.push(`run manifest ${oidField} must be a Git object ID`);
    }
  }
  for (const hashField of [
    "repository_dirty_path_inventory_sha256",
    "repository_untracked_path_inventory_sha256",
    "critical_global_inputs_sha256",
    "dependency_closure_digest",
    "diff_relevant_config_digest",
    "assurance_build_sha256",
  ]) validateHash(manifest[hashField], `run manifest ${hashField}`, errors);
  validateAssuranceBuildIdentity(
    manifest.assurance_build_identity,
    manifest.assurance_build_sha256,
    errors,
  );
  requireExact(manifest.scope_derivation_algorithm_version, "zenflow-repository-closure-v2.2.1-e1", "run manifest scope_derivation_algorithm_version", errors);
  requireExact(manifest.snapshot_algorithm_version, "zenflow-git-snapshot-v2.2.1-e1", "run manifest snapshot_algorithm_version", errors);
  requireString(manifest.git_version, "run manifest git_version", errors);
  validateScopeDerivationEvidence(manifest.scope_derivation_evidence, manifest, errors);
  validatePlatformDomainMatrix(manifest.platform_domain_matrix, manifest, errors);
  if (!isRecord(manifest.model_reasoning_tool_inventory)) {
    errors.push("run manifest model_reasoning_tool_inventory must be an object");
  }
  validateHashes(manifest, [
    "classification_registry_digest",
    "subject_scoped_snapshot_sha256",
    "policy_hash",
    "profile_set_hash",
    "source_ledger_hash",
    "schema_hash",
    "runtime_inventory_hash",
    "tool_inventory_hash",
    "model_reasoning_hash",
    "verification_plan_hash",
  ], "run manifest", errors);
  if (manifest.classification_registry_digest !== ASSURANCE_RISK_REGISTRY_DIGEST) {
    errors.push("run manifest classification_registry_digest does not match canonical risk registry");
  }
  validateManifestDependencyHashes(manifest, errors);
  validateStringArray(manifest.required_receipt_keys, "run manifest required_receipt_keys", errors);
  if (manifest.required_receipt_keys && manifest.required_receipt_keys.length === 0) {
    errors.push("run manifest required_receipt_keys must not be empty");
  }
  if (!Array.isArray(manifest.phase_plan) || manifest.phase_plan.length === 0) {
    errors.push("run manifest phase_plan must be a non-empty array");
    return { errors: uniqueStrings(errors) };
  }
  const phaseKeys = [];
  for (let index = 0; index < manifest.phase_plan.length; index += 1) {
    const phase = manifest.phase_plan[index];
    const label = `run manifest phase_plan ${index}`;
    if (!isRecord(phase)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (phase.sequence !== index + 1) errors.push(`${label} sequence must be contiguous`);
    requireString(phase.role_id, `${label} role_id`, errors);
    requireString(phase.phase, `${label} phase`, errors);
    phaseKeys.push(`${phase.role_id}:${phase.phase}`);
  }
  const expectedKeys = uniqueStrings(phaseKeys);
  if (stableJson(expectedKeys) !== stableJson(uniqueStrings(manifest.required_receipt_keys))) {
    errors.push("run manifest required_receipt_keys must exactly match phase_plan");
  }
  const canonicalRoleIds = Object.keys(ASSURANCE_RUNTIME_IDENTITIES);
  const expectedPhases = buildMandatoryPhases(
    expectedClassification.task_class,
    canonicalRoleIds,
    expectedClassification.mandatory_role_ids,
    manifest.routing_mode,
  );
  const expectedPhaseKeys = expectedPhases.map(function expectedPhaseKey(phase) {
    return `${phase.role_id}:${phase.phase}`;
  });
  if (stableJson(phaseKeys) !== stableJson(expectedPhaseKeys)) {
    errors.push("run manifest phase_plan does not match classified mandatory phases");
  }
  return { errors: uniqueStrings(errors) };
}

function validateAssuranceBuildIdentity(identity, expectedBuildHash, errors) {
  if (!isRecord(identity)) {
    errors.push("run manifest assurance_build_identity must be an object");
    return;
  }
  requireExact(
    identity.schema_version,
    "zenflow-assurance-build-identity-v1",
    "run manifest assurance build identity schema_version",
    errors,
  );
  validateStringArray(
    identity.artifact_paths,
    "run manifest assurance build artifact_paths",
    errors,
  );
  if (stableJson(identity.artifact_paths) !== stableJson(ASSURANCE_BUILD_ARTIFACT_PATHS)) {
    errors.push("run manifest assurance build artifact_paths must exactly match the canonical artifact set");
  }
  if (!Array.isArray(identity.artifact_inventory)) {
    errors.push("run manifest assurance build artifact_inventory must be an array");
    return;
  }
  const inventoryPaths = [];
  for (const [index, artifact] of identity.artifact_inventory.entries()) {
    if (!isRecord(artifact)) {
      errors.push(`run manifest assurance build artifact ${index} must be an object`);
      continue;
    }
    requireString(artifact.path, `run manifest assurance build artifact ${index} path`, errors);
    requireExact(
      artifact.type,
      "FILE",
      `run manifest assurance build artifact ${index} type`,
      errors,
    );
    if (!Number.isInteger(artifact.mode) || artifact.mode < 0) {
      errors.push(`run manifest assurance build artifact ${index} mode must be a nonnegative integer`);
    }
    if (!Number.isInteger(artifact.size) || artifact.size < 0) {
      errors.push(`run manifest assurance build artifact ${index} size must be a nonnegative integer`);
    }
    validateHash(artifact.sha256, `run manifest assurance build artifact ${index} sha256`, errors);
    inventoryPaths.push(artifact.path);
  }
  if (stableJson(inventoryPaths) !== stableJson(ASSURANCE_BUILD_ARTIFACT_PATHS)) {
    errors.push("run manifest assurance build inventory must exactly cover the canonical artifact set");
  }
  validateHash(
    identity.artifact_inventory_sha256,
    "run manifest assurance build artifact_inventory_sha256",
    errors,
  );
  if (identity.artifact_inventory_sha256 !== sha256Canonical(identity.artifact_inventory)) {
    errors.push("run manifest assurance build artifact inventory hash does not match");
  }
  validateHash(
    identity.assurance_build_sha256,
    "run manifest assurance build identity assurance_build_sha256",
    errors,
  );
  const identityPayload = {
    schema_version: identity.schema_version,
    artifact_paths: identity.artifact_paths,
    artifact_inventory: identity.artifact_inventory,
    artifact_inventory_sha256: identity.artifact_inventory_sha256,
  };
  if (identity.assurance_build_sha256 !== sha256Canonical(identityPayload)) {
    errors.push("run manifest assurance build identity hash does not match its artifacts");
  }
  if (expectedBuildHash !== identity.assurance_build_sha256) {
    errors.push("run manifest assurance_build_sha256 does not match assurance build identity");
  }
}

function validatePassAVisibilityPolicy(policy, errors) {
  if (!isRecord(policy)) {
    errors.push("run manifest pass_a_visibility_policy must be an object");
    return;
  }
  requireExact(policy.schema_version, "zenflow-pass-a-visibility-v2.2.1-e1", "run manifest Pass A visibility schema_version", errors);
  if (stableJson(policy.allowed_evidence_classes) !== stableJson(PASS_A_ALLOWED_EVIDENCE_CLASSES)) {
    errors.push("run manifest Pass A allowed evidence classes must match canonical policy");
  }
  if (stableJson(policy.forbidden_locator_prefixes) !== stableJson(PASS_A_FORBIDDEN_LOCATOR_PREFIXES)) {
    errors.push("run manifest Pass A forbidden locator prefixes must match canonical policy");
  }
}

function validateScopeDerivationEvidence(evidence, manifest, errors) {
  if (!isRecord(evidence)) {
    errors.push("run manifest scope_derivation_evidence must be an object");
    return;
  }
  requireExact(
    evidence.schema_version,
    "zenflow-scope-discovery-receipt-v1",
    "run manifest scope_derivation_evidence schema_version",
    errors,
  );
  requireExact(
    evidence.status,
    "VERIFIED",
    "run manifest scope_derivation_evidence status",
    errors,
  );
  requireExact(
    evidence.local_source_discovery,
    true,
    "run manifest scope_derivation_evidence local_source_discovery",
    errors,
  );
  validateStringArray(
    evidence.discovery_commands,
    "run manifest scope_derivation_evidence discovery_commands",
    errors,
  );
  if (Array.isArray(evidence.discovery_commands) && evidence.discovery_commands.length === 0) {
    errors.push("run manifest scope_derivation_evidence discovery_commands must not be empty");
  }
  if (evidence.direct_request_content_sha256 !== manifest.direct_request?.content_sha256) {
    errors.push("run manifest scope_derivation_evidence direct request hash does not match");
  }
  if (evidence.evidence_locators_sha256 !== sha256Canonical(manifest.evidence_locators)) {
    errors.push("run manifest scope_derivation_evidence locator hash does not match");
  }
  const resolvedScope = Object.fromEntries([
    "affected_paths",
    "affected_routes",
    "affected_symbols",
    "affected_stores",
    "affected_schemas",
    "affected_data_flows",
    ...PROTECTED_MANIFEST_CATEGORY_FIELDS,
    "platform_domain_matrix",
  ].map(function scopeField(field) { return [field, manifest[field]]; }));
  if (evidence.resolved_scope_sha256 !== sha256Canonical(resolvedScope)) {
    errors.push("run manifest scope_derivation_evidence resolved scope hash does not match");
  }
}

function deriveManifestTriggers(manifest) {
  const affectedPaths = Array.isArray(manifest.affected_paths) ? manifest.affected_paths : [];
  const affectedSymbols = Array.isArray(manifest.affected_symbols) ? manifest.affected_symbols : [];
  const protectedPath = affectedPaths.some(function protectedGovernancePath(locator) {
    return GOVERNANCE_PROTECTED_PATH_PATTERNS.some(function matches(pattern) { return pattern.test(locator); });
  });
  const protectedSymbol = affectedSymbols.some(function protectedGovernanceSymbol(symbol) {
    return GOVERNANCE_PROTECTED_SYMBOLS.has(symbol);
  });
  const protectedCategory = PROTECTED_MANIFEST_CATEGORY_FIELDS.some(function populated(field) {
    return Array.isArray(manifest[field]) && manifest[field].length > 0;
  });
  if (protectedPath || protectedSymbol || protectedCategory) {
    return ["GOVERNANCE_OR_ORCHESTRATION", "PROTECTED_SURFACE"];
  }
  return [];
}

function validatePlatformDomainMatrix(matrix, manifest, errors) {
  if (!isRecord(matrix)) {
    errors.push("run manifest platform_domain_matrix must be an object");
    return;
  }
  const actualKeys = Object.keys(matrix).sort();
  const expectedKeys = [...REQUIRED_PLATFORM_DOMAIN_KEYS].sort();
  if (stableJson(actualKeys) !== stableJson(expectedKeys)) {
    errors.push("run manifest platform_domain_matrix must contain exactly every canonical platform/domain key");
  }
  for (const key of REQUIRED_PLATFORM_DOMAIN_KEYS) {
    const entry = matrix[key];
    const label = `run manifest platform_domain_matrix.${key}`;
    if (!isRecord(entry)) {
      errors.push(`${label} must be an evidence-backed object`);
      continue;
    }
    const actualEntryKeys = Object.keys(entry).sort();
    if (stableJson(actualEntryKeys) !== stableJson(["evidence_locators", "reason", "status"])) {
      errors.push(`${label} must contain exactly status, reason, and evidence_locators`);
    }
    requireEnum(entry.status, PLATFORM_DOMAIN_STATUSES, `${label}.status`, errors);
    requireString(entry.reason, `${label}.reason`, errors);
    validateStringArray(entry.evidence_locators, `${label}.evidence_locators`, errors);
    if (Array.isArray(entry.evidence_locators) && entry.evidence_locators.length === 0) {
      errors.push(`${label}.evidence_locators must not be empty`);
    }
  }
  if (matrix.AGENT_GOVERNANCE?.status !== "IN_SCOPE") {
    errors.push("run manifest platform_domain_matrix.AGENT_GOVERNANCE must be IN_SCOPE");
  }
  for (const surface of Array.isArray(manifest?.affected_release_surfaces)
    ? manifest.affected_release_surfaces
    : []) {
    if (REQUIRED_PLATFORM_DOMAIN_KEYS.includes(surface) && matrix[surface]?.status !== "IN_SCOPE") {
      errors.push(`run manifest affected release surface ${surface} must be IN_SCOPE in platform_domain_matrix`);
    }
  }
  const protectedEffectFields = PROTECTED_MANIFEST_CATEGORY_FIELDS.filter(function nonRelease(field) {
    return field !== "affected_release_surfaces";
  });
  if (protectedEffectFields.some(function populated(field) {
    return Array.isArray(manifest?.[field]) && manifest[field].length > 0;
  }) && matrix.SECURITY_PRIVACY?.status !== "IN_SCOPE") {
    errors.push("run manifest protected effects require SECURITY_PRIVACY IN_SCOPE");
  }
}

function validateManifestDependencyHashes(manifest, errors) {
  if (!isRecord(manifest.dependency_hashes)) {
    errors.push("run manifest dependency_hashes must be an object");
    return;
  }
  const expectedKeys = Object.keys(MANIFEST_DEPENDENCY_FIELDS).sort();
  const actualKeys = Object.keys(manifest.dependency_hashes).sort();
  if (stableJson(actualKeys) !== stableJson(expectedKeys)) {
    errors.push("run manifest dependency_hashes must contain exactly the canonical dependencies");
  }
  for (const dependencyKey of expectedKeys) {
    validateHash(
      manifest.dependency_hashes[dependencyKey],
      `run manifest dependency_hashes.${dependencyKey}`,
      errors,
    );
    const manifestField = MANIFEST_DEPENDENCY_FIELDS[dependencyKey];
    if (manifest.dependency_hashes[dependencyKey] !== manifest[manifestField]) {
      errors.push(`run manifest dependency_hashes.${dependencyKey} does not match ${manifestField}`);
    }
  }
}

function classifyManifestTriggers(triggerIds, errors, routingMode = "EVIDENCE_FIRST_ADAPTIVE") {
  const roleIds = Object.keys(ASSURANCE_RUNTIME_IDENTITIES);
  const rank = { M0_MECHANICAL: 0, M1_MATERIAL: 1, M2_PROTECTED_HIGH_RISK: 2 };
  const uniqueTriggerIds = uniqueStrings(triggerIds);
  let taskClass = uniqueTriggerIds.length === 1 && uniqueTriggerIds[0] === "MECHANICAL_ONLY"
    ? "M0_MECHANICAL"
    : "M1_MATERIAL";
  const roles = new Set(ASSURANCE_CLASS_RULES[taskClass].mandatory_role_ids);
  let fullCouncil = routingMode === "FIXED_FULL_TEN" && taskClass !== "M0_MECHANICAL";
  for (const triggerId of uniqueTriggerIds) {
    const rule = ASSURANCE_TRIGGER_RULES[triggerId];
    if (!rule) {
      errors.push(`run manifest observed trigger is unknown: ${triggerId}`);
      continue;
    }
    if (rank[taskClass] < rank[rule.task_class]) {
      taskClass = rule.task_class;
      for (const roleId of ASSURANCE_CLASS_RULES[taskClass].mandatory_role_ids) roles.add(roleId);
    }
    for (const roleId of rule.role_ids) roles.add(roleId);
    if (rule.full_council === true && taskClass !== "M0_MECHANICAL") fullCouncil = true;
  }
  return {
    task_class: taskClass,
    routing_mode: routingMode,
    mandatory_role_ids: fullCouncil ? roleIds : Array.from(roles),
  };
}

function validateRoleConsiderations(value, mandatoryRoleIds, errors) {
  const canonicalRoleIds = Object.keys(ASSURANCE_RUNTIME_IDENTITIES);
  if (!Array.isArray(value) || value.length !== canonicalRoleIds.length) {
    errors.push("run manifest role_considerations must account for exactly all ten roles");
    return;
  }
  const expectedSelected = new Set(mandatoryRoleIds);
  const observedRoleIds = [];
  for (const [index, entry] of value.entries()) {
    const label = `run manifest role_considerations[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    const keys = Object.keys(entry).sort();
    if (stableJson(keys) !== stableJson(["disposition", "evidence_locators", "reason", "role_id"])) {
      errors.push(`${label} must contain exactly role_id, disposition, reason, and evidence_locators`);
      continue;
    }
    observedRoleIds.push(entry.role_id);
    requireEnum(entry.disposition, new Set(["SELECTED", "EXCLUDED"]), `${label} disposition`, errors);
    requireString(entry.reason, `${label} reason`, errors);
    validateStringArray(entry.evidence_locators, `${label} evidence_locators`, errors);
    if (Array.isArray(entry.evidence_locators) && entry.evidence_locators.length === 0) {
      errors.push(`${label} evidence_locators must not be empty`);
    }
    const expectedDisposition = expectedSelected.has(entry.role_id) ? "SELECTED" : "EXCLUDED";
    if (entry.disposition !== expectedDisposition) {
      errors.push(`${label} disposition must match classified role selection`);
    }
  }
  if (stableJson(observedRoleIds) !== stableJson(canonicalRoleIds)) {
    errors.push("run manifest role_considerations must list all ten canonical roles in order");
  }
}

export function validateRoleReceipt(receipt, manifest) {
  const errors = [];
  if (!isRecord(receipt)) return { errors: ["role receipt must be an object"] };
  const allowedReceiptFields = new Set([
    "schema_version", "protocol_version", "run_id", "run_nonce", "attempt_nonce",
    "issued_at", "expires_at", "task_class", "phase", "phase_sequence", "role_id",
    "runtime_identity", "decision", "ask_kind", "ask", "assurance_status", "execution",
    "closure_status", "subject_scoped_snapshot_sha256", "evidence_ledger_hash",
    "policy_hash", "profile_hash", "source_ledger_hash", "schema_hash",
    "runtime_inventory_hash", "tool_inventory_hash", "model_reasoning_hash",
    "verification_plan_hash", "previous_receipt_hash", "parent_receipt_hashes",
    "phase_dependency_receipts", "question_owned", "scope_checked", "claims",
    "proven_scope_ids", "unverified_scope_ids", "not_applicable_scope_ids",
    "evidence_used", "findings", "finding_history_hashes", "affected_platforms",
    "affected_domains", "dependencies", "invalidation_keys", "verification_run",
    "verification_skipped", "uncertainty", "confidence_boundary",
    "human_escalation_record_reference", "raw_generation_hash", "audit_locator",
    "closure_audit",
  ]);
  for (const field of Object.keys(receipt)) {
    if (!allowedReceiptFields.has(field)) errors.push(`receipt contains unknown field ${field}`);
  }
  requireExact(receipt.schema_version, "zenflow-ten-lens-role-receipt-v2.2.1-e1", "receipt schema_version", errors);
  requireExact(receipt.protocol_version, "2.2.1-e1", "receipt protocol_version", errors);
  requireString(receipt.run_id, "receipt run_id", errors);
  requireString(receipt.role_id, "receipt role_id", errors);
  requireString(receipt.runtime_identity, "receipt runtime_identity", errors);
  const expectedRuntimeIdentity = ASSURANCE_RUNTIME_IDENTITIES[receipt.role_id];
  if (!expectedRuntimeIdentity) errors.push("receipt role_id is not canonical");
  else if (receipt.runtime_identity !== expectedRuntimeIdentity) {
    errors.push("receipt runtime_identity does not match role_id");
  }
  requireString(receipt.phase, "receipt phase", errors);
  requireEnum(
    receipt.task_class,
    new Set(["M0_MECHANICAL", "M1_MATERIAL", "M2_PROTECTED_HIGH_RISK"]),
    "receipt task_class",
    errors,
  );
  if (isRecord(manifest) && receipt.task_class !== manifest.task_class) {
    errors.push("receipt task_class does not match manifest");
  }
  if (receipt.expires_at !== null) validateIso(receipt.expires_at, "receipt expires_at", errors);
  requireString(receipt.question_owned, "receipt question_owned", errors);
  requireEnum(receipt.decision, DECISIONS, "receipt decision", errors);
  requireEnum(receipt.ask_kind, ASK_KINDS, "receipt ask_kind", errors);
  requireEnum(receipt.assurance_status, ASSURANCE_STATUSES, "receipt assurance_status", errors);
  requireEnum(receipt.closure_status, CLOSURE_STATUSES, "receipt closure_status", errors);
  validateNonce(receipt.run_nonce, "receipt run_nonce", errors);
  validateNonce(receipt.attempt_nonce, "receipt attempt_nonce", errors);
  validateIso(receipt.issued_at, "receipt issued_at", errors);
  validateHashes(receipt, [
    "subject_scoped_snapshot_sha256",
    "evidence_ledger_hash",
    "policy_hash",
    "profile_hash",
    "source_ledger_hash",
    "schema_hash",
    "runtime_inventory_hash",
    "tool_inventory_hash",
    "model_reasoning_hash",
    "verification_plan_hash",
  ], "receipt", errors);
  if (receipt.previous_receipt_hash !== null) {
    validateHash(receipt.previous_receipt_hash, "receipt previous_receipt_hash", errors);
  }
  validateHashArray(receipt.parent_receipt_hashes, "receipt parent_receipt_hashes", errors);
  validatePhaseDependencyReceipts(receipt, manifest, errors);
  validateExecution(receipt.execution, errors);
  validateStringArray(receipt.scope_checked, "receipt scope_checked", errors);
  validateStringArray(receipt.proven_scope_ids, "receipt proven_scope_ids", errors);
  validateStringArray(receipt.unverified_scope_ids, "receipt unverified_scope_ids", errors);
  validateStringArray(receipt.not_applicable_scope_ids, "receipt not_applicable_scope_ids", errors);
  validateStringArray(receipt.findings, "receipt findings", errors);
  if (!isRecord(receipt.finding_history_hashes)) {
    errors.push("receipt finding_history_hashes must be an object");
  } else {
    for (const [findingId, historyHash] of Object.entries(receipt.finding_history_hashes)) {
      requireString(findingId, "receipt finding_history_hashes key", errors);
      validateHash(historyHash, `receipt finding_history_hashes.${findingId}`, errors);
      if (!receipt.findings.includes(findingId)) {
        errors.push(`receipt finding_history_hashes.${findingId} lacks matching finding reference`);
      }
    }
  }
  validateStringArray(receipt.affected_platforms, "receipt affected_platforms", errors);
  validateStringArray(receipt.affected_domains, "receipt affected_domains", errors);
  validateStringArray(receipt.verification_run, "receipt verification_run", errors);
  validateStringArray(receipt.verification_skipped, "receipt verification_skipped", errors);
  if (Array.isArray(receipt.affected_platforms) && receipt.affected_platforms.length === 0) {
    errors.push("receipt affected_platforms must not be empty");
  }
  if (Array.isArray(receipt.affected_domains) && receipt.affected_domains.length === 0) {
    errors.push("receipt affected_domains must not be empty");
  }
  if (Array.isArray(receipt.verification_run) && receipt.verification_run.length === 0) {
    errors.push("receipt verification_run must not be empty");
  }
  requireString(receipt.uncertainty, "receipt uncertainty", errors);
  requireString(receipt.confidence_boundary, "receipt confidence_boundary", errors);
  if (receipt.human_escalation_record_reference !== null) {
    requireString(receipt.human_escalation_record_reference, "receipt human escalation reference", errors);
  }
  if ((receipt.raw_generation_hash === null) !== (receipt.audit_locator === null)) {
    errors.push("receipt raw_generation_hash and audit_locator must be both null or both present");
  }
  if (receipt.raw_generation_hash !== null) {
    validateHash(receipt.raw_generation_hash, "receipt raw_generation_hash", errors);
    requireString(receipt.audit_locator, "receipt audit_locator", errors);
  }
  validateReceiptDependencies(receipt, manifest, errors);
  validateClosureAudit(receipt, manifest, errors);
  if (isRecord(manifest)) {
    const manifestValidation = validateRunManifest(manifest);
    errors.push(...manifestValidation.errors);
    validateManifestLink(receipt, manifest, errors);
  }

  const claims = Array.isArray(receipt.claims) ? receipt.claims : [];
  if (claims.length === 0) errors.push("receipt claims must be a non-empty array");
  const evidenceById = validateEvidenceUsed(receipt.evidence_used, errors);
  for (let index = 0; index < claims.length; index += 1) {
    validateClaim(claims[index], `receipt claim ${index}`, receipt.role_id, evidenceById, errors);
  }
  validateClaimScopeRollup(receipt, claims, errors);
  const rollup = rollupAssurance(claims);
  if (claims.length !== 0 && receipt.assurance_status !== rollup) {
    errors.push(`receipt assurance_status must roll up to ${rollup}`);
  }
  if (receipt.decision === "GO") {
    if ((receipt.proven_scope_ids || []).length === 0 && (receipt.not_applicable_scope_ids || []).length === 0) {
      errors.push("GO requires at least one proven or not-applicable-with-evidence scope");
    }
    const unverifiedBlocking = claims.some(function ownedBlocking(claim) {
      return claim && claim.owned === true && claim.blocking === true && claim.assurance_status === "UNVERIFIED";
    });
    if (unverifiedBlocking) errors.push("GO is invalid because an owned blocking scope remains UNVERIFIED");
  }
  if (receipt.decision === "ASK") {
    if (receipt.ask_kind === "NONE") errors.push("ASK requires a non-NONE ask_kind");
    if (!isRecord(receipt.ask)) errors.push("ASK requires exact missing input and resolution path");
    else {
      requireString(receipt.ask.missing, "receipt ask missing", errors);
      requireString(receipt.ask.resolution_path, "receipt ask resolution_path", errors);
    }
  } else if (receipt.ask_kind !== "NONE") {
    errors.push("non-ASK receipt must use ask_kind NONE");
  }
  return { errors: uniqueStrings(errors) };
}

function validateClosureAudit(receipt, manifest, errors) {
  if (receipt.phase !== "PASS_B") {
    if (receipt.closure_audit !== undefined && receipt.closure_audit !== null) {
      errors.push("closure_audit is allowed only for PASS_B");
    }
    return;
  }
  const audit = receipt.closure_audit;
  if (!isRecord(audit)) {
    errors.push("PASS_B receipt requires closure_audit");
    return;
  }
  for (const field of [
    "original_scope_hash", "pass_a_receipt_hash", "receipt_manifest_hash",
    "evidence_ledger_hash", "finding_ledger_hash", "qa_closure_receipt_hash",
  ]) validateHash(audit[field], "receipt closure_audit " + field, errors);
  if (isRecord(manifest) && audit.original_scope_hash !== manifest.original_scope_hash) {
    errors.push("PASS_B closure_audit original_scope_hash does not match manifest");
  }
  if (audit.pass_a_receipt_hash !== receipt.phase_dependency_receipts?.[M2_SENTINEL_ROLE_ID + ":PASS_A"]) {
    errors.push("PASS_B closure_audit pass_a_receipt_hash does not match phase dependency");
  }
  if (audit.qa_closure_receipt_hash !== receipt.phase_dependency_receipts?.["qa-evidence-release-verification:QA_CLOSURE"]) {
    errors.push("PASS_B closure_audit QA hash does not match phase dependency");
  }
  if (audit.evidence_ledger_hash !== receipt.evidence_ledger_hash) {
    errors.push("PASS_B closure_audit evidence ledger hash does not match receipt");
  }
  const allowedStatuses = new Set([
    "RESOLVED_WITH_RECHECKED_EVIDENCE", "REJECTED_WITH_RECHECKED_EVIDENCE",
    "ESCALATION_PENDING", "ACCEPTED_RISK_BY_VERIFIED_AUTHORITY",
    "REJECTED_BY_VERIFIED_AUTHORITY", "UNVERIFIED",
  ]);
  if (!Array.isArray(audit.pass_a_item_statuses) || audit.pass_a_item_statuses.length === 0) {
    errors.push("PASS_B closure_audit pass_a_item_statuses must be non-empty");
  } else {
    const itemIds = new Set();
    for (const item of audit.pass_a_item_statuses) {
      if (!isRecord(item)) {
        errors.push("PASS_B closure_audit item must be an object");
        continue;
      }
      requireString(item.item_id, "PASS_B closure_audit item_id", errors);
      requireEnum(item.status, allowedStatuses, "PASS_B closure_audit item status", errors);
      if (itemIds.has(item.item_id)) errors.push("PASS_B closure_audit item_id must be unique");
      itemIds.add(item.item_id);
    }
  }
}

function validateReceiptDependencies(receipt, manifest, errors) {
  if (!isRecord(receipt.dependencies)) {
    errors.push("receipt dependencies must be an object");
    return;
  }
  const expectedKeys = Object.keys(MANIFEST_DEPENDENCY_FIELDS).sort();
  if (stableJson(Object.keys(receipt.dependencies).sort()) !== stableJson(expectedKeys)) {
    errors.push("receipt dependencies must contain exactly the canonical invalidation keys");
  }
  for (const dependencyKey of expectedKeys) {
    validateHash(receipt.dependencies[dependencyKey], `receipt dependencies.${dependencyKey}`, errors);
    if (isRecord(manifest) && receipt.dependencies[dependencyKey] !== manifest.dependency_hashes?.[dependencyKey]) {
      errors.push(`receipt dependencies.${dependencyKey} does not match manifest`);
    }
  }
  validateHashArray(receipt.invalidation_keys, "receipt invalidation_keys", errors);
  if (stableJson(uniqueStrings(receipt.invalidation_keys)) !== stableJson(uniqueStrings(Object.values(receipt.dependencies)))) {
    errors.push("receipt invalidation_keys must exactly match dependency hashes");
  }
}

function validateManifestLink(receipt, manifest, errors) {
  if (receipt.run_id !== manifest.run_id) errors.push("receipt run_id does not match manifest");
  if (receipt.run_nonce !== manifest.run_nonce) errors.push("receipt run_nonce does not match manifest");
  if (receipt.subject_scoped_snapshot_sha256 !== manifest.subject_scoped_snapshot_sha256) {
    errors.push("receipt subject snapshot does not match manifest");
  }
  if (receipt.policy_hash !== manifest.policy_hash) errors.push("receipt policy hash does not match manifest");
  if (receipt.schema_hash !== manifest.schema_hash) errors.push("receipt schema hash does not match manifest");
  if (receipt.profile_hash !== manifest.profile_set_hash) errors.push("receipt profile hash does not match manifest");
  if (receipt.source_ledger_hash !== manifest.source_ledger_hash) errors.push("receipt source ledger hash does not match manifest");
  if (receipt.runtime_inventory_hash !== manifest.runtime_inventory_hash) errors.push("receipt runtime inventory hash does not match manifest");
  if (receipt.tool_inventory_hash !== manifest.tool_inventory_hash) errors.push("receipt tool inventory hash does not match manifest");
  if (receipt.model_reasoning_hash !== manifest.model_reasoning_hash) errors.push("receipt model/reasoning hash does not match manifest");
  if (receipt.verification_plan_hash !== manifest.verification_plan_hash) errors.push("receipt verification plan hash does not match manifest");
  if (!Array.isArray(manifest.required_receipt_keys) || !manifest.required_receipt_keys.includes(assuranceKey(receipt))) {
    errors.push("receipt role and phase are not declared by manifest");
  } else {
    const plannedPhase = manifest.phase_plan.find(function receiptPhase(item) {
      return item.role_id === receipt.role_id && item.phase === receipt.phase;
    });
    if (!plannedPhase || receipt.phase_sequence !== plannedPhase.sequence) {
      errors.push("receipt phase_sequence does not match manifest phase_plan");
    }
  }
}

function validatePhaseDependencyReceipts(receipt, manifest, errors) {
  const requiredParentKeys = requiredParentReceiptKeys(receipt, manifest);
  const dependencies = isRecord(receipt.phase_dependency_receipts)
    ? receipt.phase_dependency_receipts
    : {};
  const actualParentKeys = Object.keys(dependencies).sort();
  if (stableJson(actualParentKeys) !== stableJson(requiredParentKeys)) {
    errors.push(`receipt ${receipt.phase} phase_dependency_receipts must exactly match required parents`);
  }
  for (const parentKey of actualParentKeys) {
    validateHash(dependencies[parentKey], `receipt phase_dependency_receipts.${parentKey}`, errors);
  }
  const declaredParentHashes = uniqueStrings(receipt.parent_receipt_hashes);
  const dependencyHashes = uniqueStrings(Object.values(dependencies));
  if (stableJson(declaredParentHashes) !== stableJson(dependencyHashes)) {
    errors.push("receipt parent_receipt_hashes must exactly match phase_dependency_receipts values");
  }
}

function requiredParentReceiptKeys(receipt, manifest) {
  if (!isRecord(receipt) || !isRecord(manifest) || !Array.isArray(manifest.phase_plan)) return [];
  const earlierPhases = manifest.phase_plan.filter(function earlierPhase(phase) {
    return phase.sequence < receipt.phase_sequence;
  });
  const gateKeys = earlierPhases
    .filter(function prerequisiteGate(phase) {
      return ["PASS_A", "ROLE_1_PREFLIGHT", "CREATE_BRIEF"].includes(phase.phase);
    })
    .map(function gateKey(phase) { return `${phase.role_id}:${phase.phase}`; });
  if (receipt.phase === "ROLE_1_PREFLIGHT" || receipt.phase === "CREATE_BRIEF") {
    return gateKeys.sort();
  }
  if (receipt.phase === "INITIAL_REVIEW") return gateKeys.sort();
  if (
    receipt.role_id === "psychology-human-factors-emotional-safety" &&
    receipt.phase === "INDEPENDENT_FINAL_REVIEW"
  ) {
    return uniqueStrings([
      ...gateKeys,
      ...earlierPhases
        .filter(function initialReview(phase) { return phase.phase === "INITIAL_REVIEW"; })
        .map(function initialKey(phase) { return `${phase.role_id}:${phase.phase}`; }),
    ]).sort();
  }
  if (receipt.phase === "FINAL_REVIEW") {
    const ownInitial = `${receipt.role_id}:INITIAL_REVIEW`;
    const psychologyFinal = earlierPhases.find(function role2Final(phase) {
      return phase.role_id === "psychology-human-factors-emotional-safety" &&
        phase.phase === "INDEPENDENT_FINAL_REVIEW";
    });
    return uniqueStrings([
      ...gateKeys,
      ownInitial,
      ...(psychologyFinal ? [`${psychologyFinal.role_id}:${psychologyFinal.phase}`] : []),
    ]).sort();
  }
  if (!["QA_CLOSURE", "PASS_B", "ROLE_1_FINAL_INTEGRATION"].includes(receipt.phase)) return [];
  return earlierPhases
    .map(function parentKey(phase) {
      return `${phase.role_id}:${phase.phase}`;
    })
    .sort();
}

function validateEvidenceUsed(evidenceUsed, errors) {
  const evidenceById = new Map();
  if (!Array.isArray(evidenceUsed) || evidenceUsed.length === 0) {
    errors.push("receipt evidence_used must be a non-empty array");
    return evidenceById;
  }
  for (let index = 0; index < evidenceUsed.length; index += 1) {
    const evidence = evidenceUsed[index];
    const label = `receipt evidence_used ${index}`;
    if (!isRecord(evidence)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    requireString(evidence.evidence_id, `${label} evidence_id`, errors);
    requireString(evidence.locator, `${label} locator`, errors);
    validateHash(evidence.artifact_sha256, `${label} artifact_sha256`, errors);
    requireEnum(
      evidence.direct_recheck_status,
      DIRECT_RECHECK_STATUSES,
      `${label} direct_recheck_status`,
      errors,
    );
    if (evidenceById.has(evidence.evidence_id)) {
      errors.push(`${label} evidence_id must be unique`);
    }
    evidenceById.set(evidence.evidence_id, evidence);
  }
  return evidenceById;
}

function validateClaim(claim, label, roleId, evidenceById, errors) {
  if (!isRecord(claim)) {
    errors.push(`${label} must be an object`);
    return;
  }
  requireString(claim.claim_id, `${label} claim_id`, errors);
  requireString(claim.scope_id, `${label} scope_id`, errors);
  if (claim.owned !== true && claim.owned !== false) errors.push(`${label} owned must be boolean`);
  if (claim.owned === true) {
    const prefixes = ASSURANCE_SCOPE_OWNERSHIP_PREFIXES[roleId] || [];
    const ownsScope = prefixes.some(function ownedPrefix(prefix) {
      return typeof claim.scope_id === "string" && claim.scope_id.startsWith(prefix);
    });
    if (!ownsScope) errors.push(`${label} owned scope is outside canonical role ownership`);
  }
  if (claim.blocking !== true && claim.blocking !== false) errors.push(`${label} blocking must be boolean`);
  requireEnum(claim.assurance_status, ASSURANCE_STATUSES, `${label} assurance_status`, errors);
  validateStringArray(claim.evidence_ids, `${label} evidence_ids`, errors);
  validateStringArray(claim.depends_on_claim_ids, `${label} depends_on_claim_ids`, errors);
  if (Array.isArray(claim.depends_on_claim_ids) && claim.depends_on_claim_ids.includes(claim.claim_id)) {
    errors.push(`${label} cannot depend on itself`);
  }
  if (!isRecord(claim.dependency_hashes)) {
    errors.push(`${label} dependency_hashes must be an object`);
  } else {
    const dependencyKeys = Object.keys(claim.dependency_hashes).sort();
    const expectedDependencyKeys = Object.keys(MANIFEST_DEPENDENCY_FIELDS).sort();
    if (stableJson(dependencyKeys) !== stableJson(expectedDependencyKeys)) {
      errors.push(`${label} dependency_hashes must contain exactly the canonical dependencies`);
    }
    for (const dependencyKey of dependencyKeys) {
      validateHash(
        claim.dependency_hashes[dependencyKey],
        `${label} dependency_hashes.${dependencyKey}`,
        errors,
      );
    }
  }
  const evidenceCount = Array.isArray(claim.evidence_ids) ? claim.evidence_ids.length : 0;
  if (claim.assurance_status === "VERIFIED" && evidenceCount === 0) {
    errors.push(`${label} VERIFIED requires evidence_ids`);
  }
  if (claim.assurance_status === "NOT_APPLICABLE_WITH_EVIDENCE" && evidenceCount === 0) {
    errors.push(`${label} NOT_APPLICABLE_WITH_EVIDENCE requires evidence_ids`);
  }
  for (const evidenceId of Array.isArray(claim.evidence_ids) ? claim.evidence_ids : []) {
    const evidence = evidenceById.get(evidenceId);
    if (!evidence) {
      errors.push(`${label} references missing evidence_id ${evidenceId}`);
      continue;
    }
    if (
      ["VERIFIED", "NOT_APPLICABLE_WITH_EVIDENCE"].includes(claim.assurance_status) &&
      evidence.direct_recheck_status !== "RECHECKED"
    ) {
      errors.push(`${label} positive assurance requires directly rechecked evidence`);
    }
  }
}

function validateClaimScopeRollup(receipt, claims, errors) {
  const expectedProven = uniqueStrings(claims.filter(function verifiedClaim(claim) {
    return claim && claim.assurance_status === "VERIFIED";
  }).map(function verifiedScope(claim) {
    return claim.scope_id;
  }));
  const expectedUnverified = uniqueStrings(claims.filter(function unverifiedClaim(claim) {
    return claim && claim.assurance_status === "UNVERIFIED";
  }).map(function unverifiedScope(claim) {
    return claim.scope_id;
  }));
  const expectedNotApplicable = uniqueStrings(claims.filter(function notApplicableClaim(claim) {
    return claim && claim.assurance_status === "NOT_APPLICABLE_WITH_EVIDENCE";
  }).map(function notApplicableScope(claim) {
    return claim.scope_id;
  }));
  if (stableJson(uniqueStrings(receipt.proven_scope_ids)) !== stableJson(expectedProven)) {
    errors.push("receipt proven_scope_ids must exactly match VERIFIED claims");
  }
  if (stableJson(uniqueStrings(receipt.unverified_scope_ids)) !== stableJson(expectedUnverified)) {
    errors.push("receipt unverified_scope_ids must exactly match UNVERIFIED claims");
  }
  if (stableJson(uniqueStrings(receipt.not_applicable_scope_ids)) !== stableJson(expectedNotApplicable)) {
    errors.push("receipt not_applicable_scope_ids must exactly match NOT_APPLICABLE_WITH_EVIDENCE claims");
  }
}

function rollupAssurance(claims) {
  if (claims.some(function unverified(claim) {
    return claim && claim.assurance_status === "UNVERIFIED";
  })) return "UNVERIFIED";
  if (claims.length !== 0 && claims.every(function notApplicable(claim) {
    return claim && claim.assurance_status === "NOT_APPLICABLE_WITH_EVIDENCE";
  })) return "NOT_APPLICABLE_WITH_EVIDENCE";
  return "VERIFIED";
}

function validateExecution(execution, errors) {
  if (!isRecord(execution)) {
    errors.push("receipt execution must be an object");
    return;
  }
  requireEnum(execution.mode, EXECUTION_MODES, "execution mode", errors);
  requireEnum(execution.state, EXECUTION_STATES, "execution state", errors);
  requireEnum(execution.result, EXECUTION_RESULTS, "execution result", errors);
  if (execution.result === "PASS" && execution.state !== "VALIDATED") {
    errors.push("execution PASS requires state VALIDATED");
  }
  if (execution.state === "VALIDATED") {
    requireString(execution.executor_identity, "execution executor_identity", errors);
    validateHashes(execution, [
      "command_or_action_digest",
      "output_artifact_hash",
      "ingest_receipt_hash",
      "validation_receipt_hash",
    ], "execution", errors);
    validateIso(execution.started_at, "execution started_at", errors);
    validateIso(execution.finished_at, "execution finished_at", errors);
  }
}

export function validateFindingLedger(ledger, evidenceLedger) {
  return validateFindingLedgerWithEvidence(ledger, evidenceLedger);
}

export function validateEvidenceLedger(ledger) {
  const errors = [];
  const evidenceById = new Map();
  if (!isRecord(ledger)) return { errors: ["evidence ledger must be an object"], evidenceById };
  requireExact(
    ledger.schema_version,
    "zenflow-ten-lens-evidence-ledger-v2.2.1-e1",
    "evidence ledger schema_version",
    errors,
  );
  requireString(ledger.run_id, "evidence ledger run_id", errors);
  validateHash(
    ledger.subject_scoped_snapshot_sha256,
    "evidence ledger subject_scoped_snapshot_sha256",
    errors,
  );
  if (!Array.isArray(ledger.records)) {
    errors.push("evidence ledger records must be an array");
    return { errors: uniqueStrings(errors), evidenceById };
  }
  for (let index = 0; index < ledger.records.length; index += 1) {
    const record = ledger.records[index];
    const label = `evidence ledger record ${index}`;
    if (!isRecord(record)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    requireString(record.evidence_id, `${label} evidence_id`, errors);
    requireString(record.locator, `${label} locator`, errors);
    validateHash(record.artifact_sha256, `${label} artifact_sha256`, errors);
    requireEnum(
      record.direct_recheck_status,
      DIRECT_RECHECK_STATUSES,
      `${label} direct_recheck_status`,
      errors,
    );
    if (evidenceById.has(record.evidence_id)) errors.push(`${label} evidence_id must be unique`);
    evidenceById.set(record.evidence_id, record);
  }
  return { errors: uniqueStrings(errors), evidenceById };
}

function validateFindingLedgerWithEvidence(ledger, evidenceLedger) {
  const errors = [];
  if (!isRecord(ledger)) return { errors: ["finding ledger must be an object"] };
  requireExact(ledger.schema_version, "zenflow-ten-lens-finding-ledger-v2.2.1-e1", "finding ledger schema_version", errors);
  requireString(ledger.run_id, "finding ledger run_id", errors);
  validateHash(
    ledger.subject_scoped_snapshot_sha256,
    "finding ledger subject_scoped_snapshot_sha256",
    errors,
  );
  validateHash(ledger.evidence_ledger_hash, "finding ledger evidence_ledger_hash", errors);
  const evidenceValidation = validateEvidenceLedger(evidenceLedger);
  errors.push(...evidenceValidation.errors);
  if (isRecord(evidenceLedger) && ledger.evidence_ledger_hash !== sha256Canonical(evidenceLedger)) {
    errors.push("finding ledger evidence_ledger_hash does not match supplied evidence ledger");
  }
  if (!Array.isArray(ledger.findings)) {
    errors.push("finding ledger findings must be an array");
    return { errors };
  }
  const findingIds = new Set();
  for (let index = 0; index < ledger.findings.length; index += 1) {
    const finding = ledger.findings[index];
    validateFinding(
      finding,
      `finding ${index}`,
      findingIds,
      evidenceValidation.evidenceById,
      errors,
    );
    for (const evidenceId of isRecord(finding) && Array.isArray(finding.original_evidence_ids)
      ? finding.original_evidence_ids
      : []) {
      if (!evidenceValidation.evidenceById.has(evidenceId)) {
        errors.push(`finding ${index} references missing global evidence_id ${evidenceId}`);
      }
    }
  }
  return { errors: uniqueStrings(errors) };
}

function validateFinding(finding, label, findingIds, evidenceById, errors) {
  if (!isRecord(finding)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const immutableFields = [
    "finding_id",
    "origin_role",
    "origin_phase",
    "original_evidence_ids",
    "original_severity",
    "original_blocking_scope",
    "created_subject_snapshot_hash",
  ];
  requireString(finding.finding_id, `${label} finding_id`, errors);
  if (findingIds.has(finding.finding_id)) errors.push(`${label} finding_id must be unique`);
  findingIds.add(finding.finding_id);
  requireString(finding.origin_role, `${label} origin_role`, errors);
  requireString(finding.origin_phase, `${label} origin_phase`, errors);
  validateStringArray(finding.original_evidence_ids, `${label} original_evidence_ids`, errors);
  requireEnum(finding.original_severity, new Set(Object.keys(SEVERITY_RANK)), `${label} original_severity`, errors);
  validateStringArray(finding.original_blocking_scope, `${label} original_blocking_scope`, errors);
  validateHash(finding.created_subject_snapshot_hash, `${label} created_subject_snapshot_hash`, errors);
  if (!Array.isArray(finding.versions) || finding.versions.length === 0) {
    errors.push(`${label} versions must be a non-empty append-only array`);
    return;
  }
  let priorVersion = null;
  let maximumSeverity = SEVERITY_RANK[finding.original_severity] || 0;
  const protectedBlockingScope = new Set(finding.original_blocking_scope || []);
  for (let versionIndex = 0; versionIndex < finding.versions.length; versionIndex += 1) {
    const version = finding.versions[versionIndex];
    const versionLabel = `${label} version ${versionIndex + 1}`;
    if (!isRecord(version)) {
      errors.push(`${versionLabel} must be an object`);
      continue;
    }
    if (version.version !== versionIndex + 1) errors.push(`${versionLabel} version must be sequential`);
    const expectedPreviousHash = priorVersion === null ? null : sha256Canonical(priorVersion);
    if (version.previous_version_hash !== expectedPreviousHash) {
      errors.push(`${versionLabel} previous_version_hash does not match full history`);
    }
    for (const field of immutableFields) {
      if (stableJson(version[field]) !== stableJson(finding[field])) {
        errors.push(`${versionLabel} changed immutable field ${field}`);
      }
    }
    requireEnum(version.severity, new Set(Object.keys(SEVERITY_RANK)), `${versionLabel} severity`, errors);
    validateStringArray(version.blocking_scope, `${versionLabel} blocking_scope`, errors);
    requireEnum(version.evidence_resolution, EVIDENCE_RESOLUTIONS, `${versionLabel} evidence_resolution`, errors);
    requireEnum(version.risk_decision, RISK_DECISIONS, `${versionLabel} risk_decision`, errors);
    requireEnum(version.waivability, WAIVABILITY, `${versionLabel} waivability`, errors);
    if (version.risk_decision_proof_effect !== "NONE") {
      errors.push(`${versionLabel} risk decision proof effect must be NONE`);
    }
    if (version.risk_decision === "ACCEPTED_BY_VERIFIED_AUTHORITY") {
      if (version.waivability === "NON_WAIVABLE") errors.push(`${versionLabel} non-waivable finding cannot accept risk`);
      validateHash(version.authority_decision_hash, `${versionLabel} authority_decision_hash`, errors);
    }
    const severityRank = SEVERITY_RANK[version.severity] || 0;
    const currentBlockingScope = new Set(version.blocking_scope || []);
    if (versionIndex === 0) {
      if (version.severity !== finding.original_severity) {
        errors.push(`${versionLabel} severity must equal original_severity`);
      }
      if (stableJson(uniqueStrings(version.blocking_scope)) !== stableJson(uniqueStrings(finding.original_blocking_scope))) {
        errors.push(`${versionLabel} blocking_scope must equal original_blocking_scope`);
      }
      if (!["OPEN", "UNVERIFIED"].includes(version.evidence_resolution)) {
        errors.push(`${versionLabel} initial finding cannot begin resolved`);
      }
      if (version.risk_decision !== "NONE") {
        errors.push(`${versionLabel} initial finding cannot begin with a risk decision`);
      }
    }
    const removedProtectedScope = Array.from(protectedBlockingScope).some(function removedScope(scopeId) {
      return !currentBlockingScope.has(scopeId);
    });
    const downgraded = severityRank < maximumSeverity || removedProtectedScope;
    const positiveClosure = versionIndex !== 0 &&
      ["VERIFIED_RESOLVED", "VERIFIED_REJECTED"].includes(version.evidence_resolution) &&
      priorVersion.evidence_resolution !== version.evidence_resolution;
    if (versionIndex !== 0 && (downgraded || positiveClosure)) {
      validateFindingReviewTransition(
        finding,
        version,
        versionIndex,
        versionLabel,
        evidenceById,
        errors,
      );
    }
    maximumSeverity = Math.max(maximumSeverity, severityRank);
    for (const scopeId of currentBlockingScope) protectedBlockingScope.add(scopeId);
    priorVersion = version;
  }
}

function validateFindingReviewTransition(
  finding,
  version,
  versionIndex,
  label,
  evidenceById,
  errors,
) {
  if (version.direct_recheck_current_snapshot !== true) errors.push(`${label} review requires direct current recheck`);
  if (version.origin_role_reviewed !== true) errors.push(`${label} review requires origin-role review`);
  if (version.role8_verified !== true) errors.push(`${label} review requires role 8 verification`);
  validateHash(version.full_history_hash, `${label} full_history_hash`, errors);
  const expectedHistoryHash = sha256Canonical(finding.versions.slice(0, versionIndex));
  if (version.full_history_hash !== expectedHistoryHash) {
    errors.push(`${label} full_history_hash does not match prior versions`);
  }
  validateHash(version.origin_role_receipt_hash, `${label} origin_role_receipt_hash`, errors);
  validateHash(version.role8_receipt_hash, `${label} role8_receipt_hash`, errors);
  validateStringArray(version.resolution_evidence_ids, `${label} resolution_evidence_ids`, errors);
  if (!Array.isArray(version.resolution_evidence_ids) || version.resolution_evidence_ids.length === 0) {
    errors.push(`${label} review requires resolution_evidence_ids`);
  }
  for (const evidenceId of version.resolution_evidence_ids || []) {
    const evidence = evidenceById.get(evidenceId);
    if (!evidence || evidence.direct_recheck_status !== "RECHECKED") {
      errors.push(`${label} resolution evidence must exist and be directly rechecked`);
    }
  }
}

function validateFindingDowngradeReceipts(ledger, receiptsByHash, errors) {
  for (const finding of isRecord(ledger) && Array.isArray(ledger.findings) ? ledger.findings : []) {
    let maximumSeverity = SEVERITY_RANK[finding.original_severity] || 0;
    const protectedScope = new Set(finding.original_blocking_scope || []);
    for (let index = 0; index < (finding.versions || []).length; index += 1) {
      const version = finding.versions[index];
      const severityRank = SEVERITY_RANK[version.severity] || 0;
      const currentScope = new Set(version.blocking_scope || []);
      const removedScope = Array.from(protectedScope).some(function removed(scopeId) {
        return !currentScope.has(scopeId);
      });
      const downgraded = index !== 0 && (severityRank < maximumSeverity || removedScope);
      const previousVersion = index === 0 ? null : finding.versions[index - 1];
      const positiveClosure = index !== 0 &&
        ["VERIFIED_RESOLVED", "VERIFIED_REJECTED"].includes(version.evidence_resolution) &&
        previousVersion.evidence_resolution !== version.evidence_resolution;
      if (downgraded || positiveClosure) {
        const originReceipt = receiptsByHash.get(version.origin_role_receipt_hash);
        const role8Receipt = receiptsByHash.get(version.role8_receipt_hash);
        if (!originReceipt || originReceipt.role_id !== finding.origin_role) {
          errors.push(`finding ${finding.finding_id} downgrade lacks the actual origin-role receipt`);
        }
        if (!role8Receipt || role8Receipt.role_id !== "qa-evidence-release-verification") {
          errors.push(`finding ${finding.finding_id} downgrade lacks the actual Role 8 receipt`);
        }
        for (const [label, reviewReceipt] of [
          ["origin-role", originReceipt],
          ["Role 8", role8Receipt],
        ]) {
          if (!reviewReceipt) continue;
          if (!Array.isArray(reviewReceipt.findings) || !reviewReceipt.findings.includes(finding.finding_id)) {
            errors.push(`finding ${finding.finding_id} ${label} receipt lacks the finding reference`);
          }
          if (reviewReceipt.finding_history_hashes?.[finding.finding_id] !== version.full_history_hash) {
            errors.push(`finding ${finding.finding_id} ${label} receipt lacks the current history hash`);
          }
          const usedEvidenceIds = new Set((reviewReceipt.evidence_used || []).map(function usedEvidence(item) {
            return item.evidence_id;
          }));
          for (const evidenceId of version.resolution_evidence_ids || []) {
            if (!usedEvidenceIds.has(evidenceId)) {
              errors.push(`finding ${finding.finding_id} ${label} receipt lacks resolution evidence ${evidenceId}`);
            }
          }
        }
      }
      maximumSeverity = Math.max(maximumSeverity, severityRank);
      for (const scopeId of currentScope) protectedScope.add(scopeId);
    }
  }
}

export function aggregateAssuranceRun(input, trustedRuntime = {}) {
  const state = aggregateAssuranceState(input, trustedRuntime);
  return {
    ...state,
    assurance_report: buildAssuranceReport(input, state),
  };
}

function aggregateAssuranceState(input, trustedRuntime) {
  const manifest = input && input.manifest;
  const manifestRunId = isRecord(manifest) ? manifest.run_id : null;
  const manifestSnapshotHash = isRecord(manifest)
    ? manifest.subject_scoped_snapshot_sha256
    : null;
  const receipts = Array.isArray(input && input.receipts) ? input.receipts : [];
  const priorReceipts = Array.isArray(input && input.priorReceipts) ? input.priorReceipts : [];
  const findingLedger = input && input.findingLedger;
  const evidenceLedger = input && input.evidenceLedger;
  const usageLedger = input && input.usageLedger;
  const manifestRequiredKeys = uniqueStrings(manifest && manifest.required_receipt_keys);
  const callerRequiredKeys = uniqueStrings(input && input.requiredReceiptKeys);
  const requiredReceiptKeys = manifestRequiredKeys;
  const integrity = validateRunManifest(manifest).errors.slice();
  const usageValidation = validateUsageLedger(usageLedger, { manifest });
  integrity.push(...usageValidation.errors);
  if (stableJson(callerRequiredKeys) !== stableJson(manifestRequiredKeys)) {
    integrity.push("caller required receipt keys do not match manifest");
  }
  const seenKeys = new Set();
  const seenNonces = new Set();
  const receiptsByKey = new Map();
  const receiptsByHash = new Map();
  const allClaims = [];
  const claimIds = new Set();
  for (const receipt of receipts) {
    const validation = validateRoleReceipt(receipt, manifest);
    integrity.push(...validation.errors);
    if (receipt.evidence_ledger_hash !== sha256Canonical(evidenceLedger)) {
      integrity.push(`receipt ${assuranceKey(receipt)} evidence ledger hash does not match supplied ledger`);
    }
    const key = assuranceKey(receipt);
    if (seenKeys.has(key)) integrity.push(`duplicate receipt key: ${key}`);
    seenKeys.add(key);
    receiptsByKey.set(key, receipt);
    receiptsByHash.set(sha256Canonical(receipt), receipt);
    if (seenNonces.has(receipt.attempt_nonce)) integrity.push(`replayed attempt nonce: ${receipt.attempt_nonce}`);
    seenNonces.add(receipt.attempt_nonce);
    for (const claim of Array.isArray(receipt.claims) ? receipt.claims : []) {
      if (claimIds.has(claim.claim_id)) integrity.push(`duplicate claim_id: ${claim.claim_id}`);
      claimIds.add(claim.claim_id);
      allClaims.push(claim);
    }
  }
  for (const priorReceipt of priorReceipts) {
    const validation = validateRoleReceipt(priorReceipt, manifest);
    integrity.push(...validation.errors);
    const priorHash = sha256Canonical(priorReceipt);
    if (receiptsByHash.has(priorHash)) integrity.push(`duplicate prior receipt hash: ${priorHash}`);
    receiptsByHash.set(priorHash, priorReceipt);
    if (seenNonces.has(priorReceipt.attempt_nonce)) {
      integrity.push(`replayed attempt nonce: ${priorReceipt.attempt_nonce}`);
    }
    seenNonces.add(priorReceipt.attempt_nonce);
  }
  for (const requiredKey of requiredReceiptKeys) {
    if (!seenKeys.has(requiredKey)) integrity.push(`missing mandatory receipt: ${requiredKey}`);
  }
  const evidenceValidation = validateEvidenceLedger(evidenceLedger);
  integrity.push(...evidenceValidation.errors);
  if (isRecord(evidenceLedger) && evidenceLedger.run_id !== manifestRunId) {
    integrity.push("evidence ledger run_id does not match manifest");
  }
  if (
    isRecord(evidenceLedger) &&
    evidenceLedger.subject_scoped_snapshot_sha256 !== manifestSnapshotHash
  ) {
    integrity.push("evidence ledger subject snapshot does not match manifest");
  }
  validateReceiptEvidenceBindings(receipts, evidenceValidation.evidenceById, integrity);
  const findingValidation = validateFindingLedgerWithEvidence(findingLedger, evidenceLedger);
  integrity.push(...findingValidation.errors);
  if (findingLedger && findingLedger.run_id !== manifestRunId) {
    integrity.push("finding ledger run_id does not match manifest");
  }
  if (
    findingLedger &&
    findingLedger.subject_scoped_snapshot_sha256 !== manifestSnapshotHash
  ) {
    integrity.push("finding ledger subject snapshot does not match manifest");
  }
  validateParentReceiptBindings(receipts, receiptsByKey, integrity);
  validatePassBClosureBindings(
    receiptsByKey,
    manifest,
    evidenceLedger,
    findingLedger,
    integrity,
  );
  validatePreviousReceiptBindings(priorReceipts.concat(receipts), receiptsByHash, integrity);
  for (const claim of allClaims) {
    for (const dependencyClaimId of claim.depends_on_claim_ids || []) {
      if (!claimIds.has(dependencyClaimId)) {
        integrity.push(`claim ${claim.claim_id} depends on missing claim ${dependencyClaimId}`);
      }
    }
  }
  validateClaimDependencyGraph(allClaims, integrity);
  const invalidation = computeInvalidatedClaims(
    allClaims,
    isRecord(manifest) && isRecord(manifest.dependency_hashes) ? manifest.dependency_hashes : {},
  );
  if (invalidation.invalidated_claim_ids.length !== 0) {
    integrity.push(
      `claims invalidated by current dependencies: ${invalidation.invalidated_claim_ids.join(", ")}`,
    );
  }
  validateAcceptedRiskBindings(input, manifest, findingLedger, integrity);
  validateFindingDowngradeReceipts(findingLedger, receiptsByHash, integrity);
  if (integrity.length !== 0) return aggregateResult("INTEGRITY_FAILED", integrity);

  const currentFindingVersions = latestFindingVersions(findingLedger);
  const blockingFinding = currentFindingVersions.some(function blocks(version) {
    return version.risk_decision !== "ACCEPTED_BY_VERIFIED_AUTHORITY" &&
      ["OPEN", "UNVERIFIED"].includes(version.evidence_resolution) &&
      version.blocking_scope.length !== 0;
  });
  if (blockingFinding || receipts.some(function stops(receipt) {
    return receipt.decision === "STOP";
  })) return aggregateResult("BLOCKED", ["blocking finding or mandatory STOP"]);

  const failedExecution = receipts.some(function executionFailed(receipt) {
    return receipt.execution.result === "FAIL";
  });
  if (failedExecution) return aggregateResult("BLOCKED", ["mandatory execution reported FAIL"]);

  const blockingAsk = receipts.some(function asksForScope(receipt) {
    return receipt.decision === "ASK" && ["MISSING_INPUT", "AMBIGUOUS_SCOPE"].includes(receipt.ask_kind);
  });
  if (blockingAsk) return aggregateResult("BLOCKED", ["required input or scope is unresolved"]);

  const authorityAsk = receipts.some(function asksAuthority(receipt) {
    return receipt.decision === "ASK" && receipt.ask_kind === "AUTHORITY_DECISION";
  });
  if (authorityAsk) return aggregateResult("NEEDS_AUTHORITY", ["qualified authority decision required"]);

  const incompleteAsk = receipts.some(function asksForExecution(receipt) {
    return receipt.decision === "ASK" && ["CAPABILITY_UNAVAILABLE", "BUDGET_EXHAUSTED"].includes(receipt.ask_kind);
  });
  const incompleteExecution = receipts.some(function notValidated(receipt) {
    if (manifest.task_class === "M0_MECHANICAL" && receipt.execution.mode === "DETERMINISTIC_ONLY") {
      return receipt.execution.state !== "VALIDATED";
    }
    return receipt.execution.state !== "VALIDATED" || receipt.execution.result === "NO_ASSERTION";
  });
  if (incompleteAsk || incompleteExecution) {
    return aggregateResult("EXECUTION_INCOMPLETE", ["mandatory execution is not validated"]);
  }

  const acceptedRisk = currentFindingVersions.some(function riskAccepted(version) {
    return version.risk_decision === "ACCEPTED_BY_VERIFIED_AUTHORITY";
  });
  if (acceptedRisk) {
    const acceptedDecisionHashes = new Set(currentFindingVersions.filter(function accepted(version) {
      return version.risk_decision === "ACCEPTED_BY_VERIFIED_AUTHORITY";
    }).map(function acceptedHash(version) { return version.authority_decision_hash; }));
    const acceptedDecisions = (Array.isArray(input.authorityDecisions) ? input.authorityDecisions : []).filter(function acceptedDecision(decision) {
      return acceptedDecisionHashes.has(sha256Canonical(decision));
    });
    const trustedVerifier = trustedRuntime && trustedRuntime.verifyAuthorityDecision;
    const authenticated = typeof trustedVerifier === "function" && acceptedDecisions.length === acceptedDecisionHashes.size &&
      acceptedDecisions.every(function verifyDecision(decision) {
        try { return trustedVerifier(decision, manifest) === true; } catch { return false; }
      });
    if (!authenticated) {
      return aggregateResult("NEEDS_AUTHORITY", [
        "accepted-risk record lacks an independently authenticated authority trust boundary",
      ]);
    }
    return aggregateResult("AUTHORIZED_WITH_ACCEPTED_RISK", [
      "residual risk is bound to a validated and independently authenticated scoped authority decision with no proof effect",
    ]);
  }

  const unverified = receipts.some(function receiptUnverified(receipt) {
    return receipt.assurance_status === "UNVERIFIED";
  }) || currentFindingVersions.some(function findingUnverified(version) {
    return version.evidence_resolution === "UNVERIFIED";
  });
  if (unverified) return aggregateResult("COMPLETE_WITH_UNVERIFIED", ["nonblocking UNVERIFIED scope remains"]);
  let scopeDiscoveryAuthenticated = false;
  if (typeof trustedRuntime?.verifyScopeDiscovery === "function") {
    try {
      scopeDiscoveryAuthenticated = trustedRuntime.verifyScopeDiscovery(
        manifest.scope_derivation_evidence,
        manifest,
      ) === true;
    } catch {
      scopeDiscoveryAuthenticated = false;
    }
  }
  let qualityAdjudicationAuthenticated = false;
  if (typeof trustedRuntime?.verifyQualityAdjudication === "function") {
    try {
      qualityAdjudicationAuthenticated = trustedRuntime.verifyQualityAdjudication(
        input.baselineComparison?.quality_adjudication,
        manifest,
        {
          evidenceLedger,
          evidenceIds: input.baselineComparison?.quality_adjudication_evidence_ids,
        },
      ) === true;
    } catch {
      qualityAdjudicationAuthenticated = false;
    }
  }
  const promotionValidation = validatePromotionGate(input.promotionGate, {
    manifest, receiptsByKey, receipts, evidenceLedger, findingLedger, usageLedger,
    requirementProofMapping: input.requirementProofMapping,
    baselineComparison: input.baselineComparison,
    baselineUsageLedger: input.baselineUsageLedger,
    baselineManifest: input.baselineManifest,
    scopeDiscoveryAuthenticated,
    qualityAdjudicationAuthenticated,
  });
  if (promotionValidation.errors.length !== 0) {
    return aggregateResult("COMPLETE_WITH_UNVERIFIED", promotionValidation.errors);
  }
  const trustedPromotionVerifier = trustedRuntime && trustedRuntime.verifyPromotionGate;
  let promotionAuthenticated = false;
  if (typeof trustedPromotionVerifier === "function") {
    try {
      promotionAuthenticated = trustedPromotionVerifier(input.promotionGate, manifest, {
        baselineComparison: input.baselineComparison,
        baselineUsageLedger: input.baselineUsageLedger,
        baselineManifest: input.baselineManifest,
        candidateUsageLedger: input.usageLedger,
        qualityAdjudication: input.baselineComparison?.quality_adjudication,
        evidenceLedger: input.evidenceLedger,
      }) === true;
    } catch { promotionAuthenticated = false; }
  }
  if (!promotionAuthenticated) {
    return aggregateResult("COMPLETE_WITH_UNVERIFIED", ["promotion gate lacks an independently authenticated trust boundary"]);
  }
  return aggregateResult("GO_FOR_PROVEN_SCOPE", ["every requested scope passed the validated and independently authenticated promotion gate"]);
}

export function validatePromotionGate(gate, context) {
  const errors = [];
  if (!isRecord(gate)) return { errors: ["promotion gate is not supplied"] };
  requireExact(gate.schema_version, "zenflow-promotion-gate-v2.2.1-e1", "promotion gate schema_version", errors);
  validateStringArray(gate.requested_scope_ids, "promotion gate requested_scope_ids", errors);
  if (Array.isArray(gate.requested_scope_ids) && gate.requested_scope_ids.length === 0) errors.push("promotion gate requested scopes must not be empty");
  validateHash(gate.qa_closure_receipt_hash, "promotion gate qa_closure_receipt_hash", errors);
  validateHash(gate.paired_evaluation_sha256, "promotion gate paired_evaluation_sha256", errors);
  validateHash(gate.scope_discovery_receipt_sha256, "promotion gate scope_discovery_receipt_sha256", errors);
  validateHash(gate.quality_adjudication_sha256, "promotion gate quality_adjudication_sha256", errors);
  for (const field of ["authority_gate_status", "retention_gate_status", "evaluation_integrity_status", "platform_boundary_status"]) {
    requireExact(gate[field], "VERIFIED", "promotion gate " + field, errors);
  }
  requireEnum(gate.qualified_human_gate_status, new Set(["VERIFIED", "NOT_APPLICABLE_WITH_EVIDENCE"]), "promotion gate qualified human status", errors);
  requireString(gate.attestation, "promotion gate attestation", errors);
  const manifest = context?.manifest;
  if (!isRecord(manifest) || manifest.task_class === "M0_MECHANICAL") errors.push("GO promotion gate requires an M1 or M2 run");
  if (gate.scope_discovery_receipt_sha256 !== sha256Canonical(manifest?.scope_derivation_evidence)) {
    errors.push("promotion gate scope discovery hash does not match the manifest receipt");
  }
  if (context?.scopeDiscoveryAuthenticated !== true) {
    errors.push("promotion gate requires independently rechecked scope discovery provenance");
  }
  if (context?.qualityAdjudicationAuthenticated !== true) {
    errors.push("promotion gate requires independently authenticated quality adjudication");
  }
  const role10Required = Array.isArray(manifest?.mandatory_role_ids) &&
    manifest.mandatory_role_ids.includes(M2_SENTINEL_ROLE_ID);
  for (const field of ["role_10_pass_a_receipt_hash", "role_10_pass_b_receipt_hash"]) {
    if (role10Required) validateHash(gate[field], "promotion gate " + field, errors);
    else if (gate[field] !== null) errors.push("promotion gate " + field + " must be null when Role 10 is not selected");
  }
  if (manifest?.routing_mode === "FIXED_FULL_TEN") {
    validateHash(gate.coordinator_final_receipt_hash, "promotion gate coordinator_final_receipt_hash", errors);
  } else if (gate.coordinator_final_receipt_hash !== null) {
    errors.push("promotion gate coordinator_final_receipt_hash must be null for root-coordinated adaptive routing");
  }
  const byKey = context?.receiptsByKey instanceof Map ? context.receiptsByKey : new Map();
  const expectedHashes = {
    qa_closure_receipt_hash: byKey.has("qa-evidence-release-verification:QA_CLOSURE") ? sha256Canonical(byKey.get("qa-evidence-release-verification:QA_CLOSURE")) : null,
    role_10_pass_a_receipt_hash: byKey.has(M2_SENTINEL_ROLE_ID + ":PASS_A") ? sha256Canonical(byKey.get(M2_SENTINEL_ROLE_ID + ":PASS_A")) : null,
    role_10_pass_b_receipt_hash: byKey.has(M2_SENTINEL_ROLE_ID + ":PASS_B") ? sha256Canonical(byKey.get(M2_SENTINEL_ROLE_ID + ":PASS_B")) : null,
    coordinator_final_receipt_hash: byKey.has("coordinator-teamlead:ROLE_1_FINAL_INTEGRATION") ? sha256Canonical(byKey.get("coordinator-teamlead:ROLE_1_FINAL_INTEGRATION")) : null,
  };
  for (const [field, expected] of Object.entries(expectedHashes)) if (gate[field] !== expected) errors.push("promotion gate " + field + " does not match the validated receipt");
  const provenScopes = uniqueStrings((Array.isArray(context?.receipts) ? context.receipts : []).flatMap(function proven(receipt) { return receipt.proven_scope_ids || []; }));
  if (stableJson(uniqueStrings(gate.requested_scope_ids)) !== stableJson(provenScopes)) errors.push("promotion gate requested scopes must exactly match proven receipt scopes");
  const evidenceById = new Map((Array.isArray(context?.evidenceLedger?.records) ? context.evidenceLedger.records : []).map(function evidence(record) { return [record.evidence_id, record]; }));
  const requirements = uniqueStrings([...(manifest?.explicit_requirements || []), ...(manifest?.implied_requirements || [])]);
  const mappings = Array.isArray(context?.requirementProofMapping) ? context.requirementProofMapping : [];
  if (stableJson(uniqueStrings(mappings.map(function requirement(item) { return item.requirement; }))) !== stableJson(requirements)) errors.push("promotion gate requires an exact mapping for every requirement");
  for (const mapping of mappings) {
    if (mapping.status !== "VERIFIED" || !Array.isArray(mapping.evidence_ids) || mapping.evidence_ids.length === 0) errors.push("promotion gate requirement mappings must be VERIFIED with evidence");
    for (const evidenceId of mapping.evidence_ids || []) if (evidenceById.get(evidenceId)?.direct_recheck_status !== "RECHECKED") errors.push("promotion gate requirement evidence must be directly RECHECKED");
  }
  const baseline = context?.baselineComparison;
  if (!isRecord(baseline) || baseline.status !== "VERIFIED" || baseline.quality_noninferiority_status !== "VERIFIED") errors.push("promotion gate requires a VERIFIED paired baseline and quality noninferiority result");
  const promotionUsageFields = [
    "requests",
    "input_tokens",
    "cached_input_tokens",
    "cache_write_tokens",
    "output_tokens",
    "reasoning_tokens",
    "role_invocations",
    "elapsed_ms",
  ];
  const baselineManifest = context?.baselineManifest;
  const baselineManifestErrors = validateRunManifest(baselineManifest).errors;
  for (const error of baselineManifestErrors) {
    errors.push(`promotion gate baseline manifest: ${error}`);
  }
  if (isRecord(baselineManifest) && baselineManifest.routing_mode !== "FIXED_FULL_TEN") {
    errors.push("promotion gate baseline manifest must use FIXED_FULL_TEN");
  }
  const baselineLedgerValidation = validateUsageLedger(context?.baselineUsageLedger, {
    manifest: baselineManifest,
  });
  for (const error of baselineLedgerValidation.errors) {
    errors.push(`promotion gate baseline usage: ${error}`);
  }
  const candidateUsage = validatePromotionUsageLedger(
    context?.usageLedger,
    "candidate",
    promotionUsageFields,
    errors,
  );
  const baselineUsage = validatePromotionUsageLedger(
    context?.baselineUsageLedger,
    "baseline",
    promotionUsageFields,
    errors,
  );
  if (isRecord(baseline)) {
    if (baseline.baseline_manifest_sha256 !== sha256Canonical(baselineManifest)) {
      errors.push("promotion gate baseline manifest hash does not match supplied manifest");
    }
    if (baseline.candidate_manifest_sha256 !== sha256Canonical(context?.manifest)) {
      errors.push("promotion gate candidate manifest hash does not match current manifest");
    }
    if (baselineManifest?.subject_base_commit_oid !== context?.manifest?.subject_base_commit_oid) {
      errors.push("promotion gate paired manifests must share subject_base_commit_oid");
    }
    if (baseline.candidate_usage_ledger_hash !== sha256Canonical(context?.usageLedger)) {
      errors.push("promotion gate candidate usage hash does not match the current ledger");
    }
    if (baseline.baseline_usage_ledger_hash !== sha256Canonical(context?.baselineUsageLedger)) {
      errors.push("promotion gate baseline usage hash does not match the supplied baseline ledger");
    }
    requireExact(
      baseline.minimum_total_token_reduction_percent,
      MINIMUM_TOTAL_TOKEN_REDUCTION_PERCENT,
      "promotion gate minimum total token reduction percent",
      errors,
    );
    requireExact(
      baseline.quality_noninferiority_margin,
      0,
      "promotion gate quality noninferiority margin",
      errors,
    );
    validateStringArray(
      baseline.quality_adjudication_evidence_ids,
      "promotion gate quality adjudication evidence_ids",
      errors,
    );
    if (Array.isArray(baseline.quality_adjudication_evidence_ids) &&
      baseline.quality_adjudication_evidence_ids.length === 0) {
      errors.push("promotion gate quality adjudication evidence_ids must not be empty");
    }
    for (const evidenceId of baseline.quality_adjudication_evidence_ids || []) {
      if (evidenceById.get(evidenceId)?.direct_recheck_status !== "RECHECKED") {
        errors.push("promotion gate quality adjudication evidence must be directly RECHECKED");
      }
    }
    const adjudication = baseline.quality_adjudication;
    if (!isRecord(adjudication)) {
      errors.push("promotion gate requires a structured quality adjudication artifact");
    } else {
      validateStringArray(adjudication.paired_holdout_task_ids, "promotion gate paired holdout task_ids", errors);
      if (Array.isArray(adjudication.paired_holdout_task_ids) && adjudication.paired_holdout_task_ids.length === 0) {
        errors.push("promotion gate paired holdout task_ids must not be empty");
      }
      for (const field of [
        "baseline_results_sha256",
        "candidate_results_sha256",
        "independent_adjudication_receipt_sha256",
      ]) validateHash(adjudication[field], `promotion gate quality adjudication ${field}`, errors);
      for (const field of [
        "baseline_critical_misses",
        "candidate_critical_misses",
        "baseline_owned_scope_failures",
        "candidate_owned_scope_failures",
      ]) {
        if (!Number.isInteger(adjudication[field]) || adjudication[field] < 0) {
          errors.push(`promotion gate quality adjudication ${field} must be a nonnegative integer`);
        }
      }
      requireExact(
        adjudication.evaluated_noninferiority_margin,
        baseline.quality_noninferiority_margin,
        "promotion gate evaluated quality margin",
        errors,
      );
      if (adjudication.candidate_critical_misses > adjudication.baseline_critical_misses) {
        errors.push("promotion gate quality adjudication has new critical misses");
      }
      if (adjudication.candidate_owned_scope_failures > adjudication.baseline_owned_scope_failures) {
        errors.push("promotion gate quality adjudication regresses owned-scope decisions");
      }
      if (gate.quality_adjudication_sha256 !== sha256Canonical(adjudication)) {
        errors.push("promotion gate quality adjudication hash does not match");
      }
      if (stableJson(uniqueStrings(adjudication.evidence_ids)) !==
        stableJson(uniqueStrings(baseline.quality_adjudication_evidence_ids))) {
        errors.push("promotion gate quality adjudication evidence_ids do not match");
      }
      for (const evidenceId of baseline.quality_adjudication_evidence_ids || []) {
        const qualityEvidence = evidenceById.get(evidenceId);
        if (qualityEvidence?.evidence_kind !== "PAIRED_QUALITY_ADJUDICATION") {
          errors.push("promotion gate quality evidence kind must be PAIRED_QUALITY_ADJUDICATION");
          continue;
        }
        if (!Array.isArray(qualityEvidence.claim_scope_ids) ||
          !qualityEvidence.claim_scope_ids.includes("quality.noninferiority")) {
          errors.push("promotion gate quality evidence must bind quality.noninferiority scope");
        }
        if (stableJson(uniqueStrings(qualityEvidence.paired_holdout_task_ids)) !==
          stableJson(uniqueStrings(adjudication.paired_holdout_task_ids))) {
          errors.push("promotion gate quality evidence holdout tasks do not match adjudication");
        }
        if (qualityEvidence.baseline_results_sha256 !== adjudication.baseline_results_sha256 ||
          qualityEvidence.candidate_results_sha256 !== adjudication.candidate_results_sha256) {
          errors.push("promotion gate quality evidence result hashes do not match adjudication");
        }
      }
    }
  }
  if (candidateUsage && baselineUsage) {
    for (const field of [
      "direct_request_content_sha256",
      "subject_scoped_snapshot_sha256",
      "tool_inventory_hash",
      "runtime_inventory_hash",
      "verification_plan_hash",
      "permission_scope_sha256",
    ]) {
      if (candidateUsage.ledger[field] !== baselineUsage.ledger[field]) {
        errors.push(`promotion gate paired usage ${field} must match`);
      }
    }
    if (stableJson(candidateUsage.models) !== stableJson(baselineUsage.models)) {
      errors.push("promotion gate paired usage models must match");
    }
    if (stableJson(candidateUsage.reasoningEfforts) !== stableJson(baselineUsage.reasoningEfforts)) {
      errors.push("promotion gate paired usage reasoning efforts must match");
    }
    const boundArmFields = [
      ["baseline_build_sha256", baselineUsage.ledger.build_sha256],
      ["candidate_build_sha256", candidateUsage.ledger.build_sha256],
      ["baseline_registry_sha256", baselineUsage.ledger.registry_sha256],
      ["candidate_registry_sha256", candidateUsage.ledger.registry_sha256],
      ["baseline_profile_set_hash", baselineUsage.ledger.profile_set_hash],
      ["candidate_profile_set_hash", candidateUsage.ledger.profile_set_hash],
    ];
    for (const [field, expected] of boundArmFields) {
      validateHash(baseline?.[field], `promotion gate ${field}`, errors);
      if (baseline?.[field] !== expected) errors.push(`promotion gate ${field} does not match its usage arm`);
    }
    if (baselineUsage.ledger.build_sha256 === candidateUsage.ledger.build_sha256) {
      errors.push("promotion gate baseline and candidate assurance builds must be distinct");
    }
    const tokenChangePercent = baselineUsage.totalTokens === 0
      ? null
      : Number((((candidateUsage.totalTokens - baselineUsage.totalTokens) /
        baselineUsage.totalTokens) * 100).toFixed(4));
    if (tokenChangePercent === null || baseline?.token_change_percent !== tokenChangePercent) {
      errors.push("promotion gate token_change_percent does not match measured ledgers");
    }
    if (tokenChangePercent === null || tokenChangePercent > -MINIMUM_TOTAL_TOKEN_REDUCTION_PERCENT) {
      errors.push(`promotion gate requires at least ${MINIMUM_TOTAL_TOKEN_REDUCTION_PERCENT}% measured total-token reduction`);
    }
  }
  const expectedPairedEvaluationHash = sha256Canonical({
    baseline_comparison: baseline,
    baseline_usage_ledger: context?.baselineUsageLedger,
    candidate_usage_ledger_hash: sha256Canonical(context?.usageLedger),
  });
  if (gate.paired_evaluation_sha256 !== expectedPairedEvaluationHash) {
    errors.push("promotion gate paired_evaluation_sha256 does not match the paired evidence");
  }
  const nonterminalFindings = latestFindingVersions(context?.findingLedger).filter(function nonterminal(version) {
    return version.risk_decision !== "ACCEPTED_BY_VERIFIED_AUTHORITY" && ["OPEN", "UNVERIFIED"].includes(version.evidence_resolution);
  });
  if (nonterminalFindings.length !== 0) errors.push("promotion gate cannot close nonterminal material findings");
  return { errors: uniqueStrings(errors) };
}

function validatePromotionUsageLedger(ledger, label, requiredNumericFields, errors) {
  if (!isRecord(ledger) || !Array.isArray(ledger.entries) || ledger.entries.length === 0) {
    errors.push(`promotion gate requires a non-empty ${label} usage ledger`);
    return null;
  }
  for (const field of [
    "manifest_sha256",
    "direct_request_content_sha256",
    "subject_scoped_snapshot_sha256",
    "profile_set_hash",
    "tool_inventory_hash",
    "build_sha256",
    "registry_sha256",
    "runtime_inventory_hash",
    "verification_plan_hash",
    "permission_scope_sha256",
  ]) validateHash(ledger[field], `promotion gate ${label} usage ${field}`, errors);
  requireExact(
    ledger.schema_version,
    "zenflow-ten-lens-usage-v2.2.1-e1",
    `promotion gate ${label} usage schema_version`,
    errors,
  );
  requireString(ledger.run_id, `promotion gate ${label} usage run_id`, errors);
  requireEnum(
    ledger.routing_mode,
    new Set(["EVIDENCE_FIRST_ADAPTIVE", "FIXED_FULL_TEN"]),
    `promotion gate ${label} usage routing_mode`,
    errors,
  );
  if (label === "candidate" && ledger.routing_mode !== "EVIDENCE_FIRST_ADAPTIVE") {
    errors.push("promotion gate candidate usage must use EVIDENCE_FIRST_ADAPTIVE");
  }
  if (label === "baseline" && ledger.routing_mode !== "FIXED_FULL_TEN") {
    errors.push("promotion gate baseline usage must use FIXED_FULL_TEN");
  }
  const models = uniqueStrings(ledger.entries.map(function model(entry) { return entry.model; }));
  const reasoningEfforts = uniqueStrings(ledger.entries.map(function reasoning(entry) {
    return entry.reasoning_effort;
  }));
  if (models.length === 0 || models.includes("UNAVAILABLE")) {
    errors.push(`promotion gate ${label} usage models must be exposed`);
  }
  if (models.length !== 1) {
    errors.push(`promotion gate ${label} usage must expose exactly one model`);
  }
  if (reasoningEfforts.length === 0 || reasoningEfforts.includes("UNAVAILABLE")) {
    errors.push(`promotion gate ${label} usage reasoning efforts must be exposed`);
  }
  if (reasoningEfforts.length !== 1) {
    errors.push(`promotion gate ${label} usage must expose exactly one reasoning effort`);
  }
  let totalTokens = 0;
  const phaseKeys = [];
  for (const [index, entry] of ledger.entries.entries()) {
    requireString(entry.run_id, `promotion gate ${label} usage entry ${index} run_id`, errors);
    requireString(entry.role_id, `promotion gate ${label} usage entry ${index} role_id`, errors);
    requireString(entry.phase, `promotion gate ${label} usage entry ${index} phase`, errors);
    if (entry.run_id !== ledger.run_id) errors.push(`promotion gate ${label} usage entry ${index} run_id does not match ledger`);
    if (!ASSURANCE_RUNTIME_IDENTITIES[entry.role_id]) errors.push(`promotion gate ${label} usage entry ${index} role_id is not canonical`);
    phaseKeys.push(`${entry.role_id}:${entry.phase}`);
    for (const field of requiredNumericFields) {
      if (!Number.isFinite(entry[field]) || entry[field] < 0) {
        errors.push(`promotion gate requires measured ${label} usage entry ${index} ${field}`);
      }
    }
    for (const field of ["input_tokens", "output_tokens"]) {
      if (Number.isFinite(entry[field]) && entry[field] >= 0) totalTokens += entry[field];
    }
  }
  if (new Set(phaseKeys).size !== phaseKeys.length) {
    errors.push(`promotion gate ${label} usage contains duplicate role/phase entries`);
  }
  if (label === "baseline") {
    const expectedBaselineKeys = buildLegacyFullTenPhases(Object.keys(ASSURANCE_RUNTIME_IDENTITIES))
      .map(function phaseKey(phase) { return `${phase.role_id}:${phase.phase}`; });
    if (stableJson(phaseKeys) !== stableJson(expectedBaselineKeys)) {
      errors.push("promotion gate baseline usage must exactly match FIXED_FULL_TEN topology");
    }
  }
  return { ledger, models, reasoningEfforts, totalTokens };
}

export function buildAssuranceReport(input, aggregateState) {
  const manifest = isRecord(input?.manifest) ? input.manifest : {};
  const receipts = Array.isArray(input?.receipts) ? input.receipts : [];
  const evidenceLedger = isRecord(input?.evidenceLedger) ? input.evidenceLedger : {};
  const findingLedger = isRecord(input?.findingLedger) ? input.findingLedger : {};
  const usageLedger = isRecord(input?.usageLedger) ? input.usageLedger : {};
  const receiptsByRole = new Map();
  for (const receipt of receipts) {
    if (!receiptsByRole.has(receipt.role_id)) receiptsByRole.set(receipt.role_id, []);
    receiptsByRole.get(receipt.role_id).push(receipt);
  }
  const considerationByRole = new Map(
    (Array.isArray(manifest.role_considerations) ? manifest.role_considerations : [])
      .map(function considerationEntry(item) { return [item.role_id, item]; }),
  );
  const reportEvidenceById = new Map((Array.isArray(evidenceLedger.records) ? evidenceLedger.records : []).map(function reportEvidence(record) { return [record.evidence_id, record]; }));
  const suppliedMapping = Array.isArray(input?.requirementProofMapping)
    ? new Map(input.requirementProofMapping.map(function mapRequirement(item) { return [item.requirement, item]; }))
    : new Map();
  const requirements = uniqueStrings([
    ...(Array.isArray(manifest.explicit_requirements) ? manifest.explicit_requirements : []),
    ...(Array.isArray(manifest.implied_requirements) ? manifest.implied_requirements : []),
  ]);
  const requirementMapping = requirements.map(function requirementEntry(requirement) {
    const supplied = suppliedMapping.get(requirement);
    const suppliedEvidenceIds = supplied ? uniqueStrings(supplied.evidence_ids) : [];
    const validEvidenceIds = suppliedEvidenceIds.filter(function validRequirementEvidence(evidenceId) {
      return reportEvidenceById.get(evidenceId)?.direct_recheck_status === "RECHECKED";
    });
    const positiveStatusIsBound = supplied && ["VERIFIED", "NOT_APPLICABLE_WITH_EVIDENCE"].includes(supplied.status) &&
      suppliedEvidenceIds.length !== 0 && validEvidenceIds.length === suppliedEvidenceIds.length;
    return supplied ? {
      requirement,
      status: positiveStatusIsBound ? supplied.status : "UNVERIFIED",
      evidence_ids: validEvidenceIds,
      verification_path: supplied.verification_path,
    } : {
      requirement,
      status: "UNVERIFIED",
      evidence_ids: [],
      verification_path: "No requirement-specific proof mapping supplied",
    };
  });
  const allTenCoverage = Object.keys(ASSURANCE_RUNTIME_IDENTITIES).map(function roleCoverage(roleId) {
    const roleReceipts = receiptsByRole.get(roleId) || [];
    const consideration = considerationByRole.get(roleId);
    return {
      role_id: roleId,
      required: Array.isArray(manifest.mandatory_role_ids) && manifest.mandatory_role_ids.includes(roleId),
      routing_disposition: consideration?.disposition ?? "UNVERIFIED",
      routing_reason: consideration?.reason ?? "No validated routing consideration supplied",
      routing_evidence_locators: Array.isArray(consideration?.evidence_locators)
        ? consideration.evidence_locators
        : [],
      receipt_keys: roleReceipts.map(assuranceKey).sort(),
      receipt_hashes: roleReceipts.map(sha256Canonical).sort(),
      coverage_status: roleReceipts.length === 0
        ? "NOT_EXECUTED_NOT_REQUIRED_BY_CLASS"
        : roleReceipts.every(function validated(receipt) {
          return validateRoleReceipt(receipt, manifest).errors.length === 0 &&
            receipt.execution?.state === "VALIDATED" && receipt.execution?.result === "PASS";
        })
          ? "RECEIPT_AND_EXECUTION_VALIDATED"
          : "RECEIPT_PRESENT_UNVERIFIED",
    };
  });
  const evidenceCounts = { RECHECKED: 0, UNVERIFIED: 0, NOT_APPLICABLE_WITH_EVIDENCE: 0 };
  for (const record of Array.isArray(evidenceLedger.records) ? evidenceLedger.records : []) {
    if (Object.hasOwn(evidenceCounts, record.direct_recheck_status)) evidenceCounts[record.direct_recheck_status] += 1;
  }
  const byKey = new Map(receipts.map(function receiptEntry(receipt) { return [assuranceKey(receipt), receipt]; }));
  const qa = byKey.get("qa-evidence-release-verification:QA_CLOSURE");
  const passA = byKey.get(M2_SENTINEL_ROLE_ID + ":PASS_A");
  const passB = byKey.get(M2_SENTINEL_ROLE_ID + ":PASS_B");
  const coordinatorFinal = byKey.get("coordinator-teamlead:ROLE_1_FINAL_INTEGRATION");
  const baselineComparison = isRecord(input?.baselineComparison) ? input.baselineComparison : {
    status: "UNVERIFIED",
    baseline_usage_ledger_hash: null,
    candidate_usage_ledger_hash: sha256Canonical(usageLedger),
    token_change_percent: "UNAVAILABLE",
    quality_noninferiority_status: "UNVERIFIED",
    limitations: ["No paired same-model whole-run baseline measurement supplied"],
  };
  const currentFindings = latestFindingVersions(findingLedger);
  return {
    schema_version: "zenflow-ten-lens-assurance-report-v2.2.1-e1",
    protocol_version: "2.2.1-e1",
    run_id: typeof manifest.run_id === "string" ? manifest.run_id : "INVALID_RUN",
    manifest_hash: sha256Canonical(manifest),
    requirement_to_proof_mapping: requirementMapping,
    all_ten_coverage: allTenCoverage,
    findings: currentFindings,
    orthogonal_statuses: receipts.map(function statusRecord(receipt) {
      return {
        receipt_key: assuranceKey(receipt),
        decision: receipt.decision,
        assurance_status: receipt.assurance_status,
        execution_state: receipt.execution?.state,
        execution_result: receipt.execution?.result,
        closure_status: receipt.closure_status,
      };
    }).sort(function byReceiptKey(a, b) { return a.receipt_key.localeCompare(b.receipt_key); }),
    aggregated_run_status: aggregateState.status,
    aggregate_reasons: aggregateState.reasons,
    evidence_classes: evidenceCounts,
    platform_statuses: isRecord(manifest.platform_domain_matrix) ? manifest.platform_domain_matrix : {},
    qa_closure: qa ? { receipt_key: assuranceKey(qa), receipt_hash: sha256Canonical(qa) } : null,
    role_10_closure: {
      pass_a_receipt_hash: passA ? sha256Canonical(passA) : null,
      pass_b_receipt_hash: passB ? sha256Canonical(passB) : null,
    },
    coordinator_closure: coordinatorFinal ? { receipt_hash: sha256Canonical(coordinatorFinal) } : null,
    usage: { ledger_hash: sha256Canonical(usageLedger), entries: Array.isArray(usageLedger.entries) ? usageLedger.entries.length : 0 },
    baseline_comparison: baselineComparison,
    residual_risks: currentFindings.filter(function residual(version) {
      return version.risk_decision === "ACCEPTED_BY_VERIFIED_AUTHORITY";
    }).map(function residualRecord(version) {
      return {
        finding_id: version.finding_id,
        authority_decision_hash: version.authority_decision_hash,
        scope: version.blocking_scope,
        limitations: version.limitations || [],
        expires_at: version.risk_acceptance_expires_at || null,
        rollback_obligations: version.rollback_obligations || [],
        monitoring_obligations: version.monitoring_obligations || [],
      };
    }),
    unknowns: uniqueStrings([...(Array.isArray(manifest.unknowns) ? manifest.unknowns : []), ...(Array.isArray(input?.unknowns) ? input.unknowns : [])]),
    promotion_status: aggregateState.status,
  };
}

export function validateAssuranceReport(report, input) {
  const errors = [];
  if (!isRecord(report)) return { errors: ["assurance report must be an object"] };
  requireExact(report.schema_version, "zenflow-ten-lens-assurance-report-v2.2.1-e1", "assurance report schema_version", errors);
  requireExact(report.protocol_version, "2.2.1-e1", "assurance report protocol_version", errors);
  requireString(report.run_id, "assurance report run_id", errors);
  validateHash(report.manifest_hash, "assurance report manifest_hash", errors);
  if (isRecord(input?.manifest) && report.manifest_hash !== sha256Canonical(input.manifest)) errors.push("assurance report manifest hash does not match input");
  requireEnum(report.aggregated_run_status, new Set(ASSURANCE_AGGREGATE_PRECEDENCE), "assurance report aggregate status", errors);
  if (report.promotion_status !== report.aggregated_run_status) errors.push("assurance report promotion status must match aggregate status");
  validateStringArray(report.aggregate_reasons, "assurance report aggregate_reasons", errors);
  validateStringArray(report.unknowns, "assurance report unknowns", errors);
  const reportEvidenceById = new Map((Array.isArray(input?.evidenceLedger?.records) ? input.evidenceLedger.records : []).map(function reportEvidence(record) { return [record.evidence_id, record]; }));
  if (!Array.isArray(report.requirement_to_proof_mapping)) errors.push("assurance report requirement-to-proof mapping must be an array");
  else for (const item of report.requirement_to_proof_mapping) {
    if (!isRecord(item)) { errors.push("assurance report requirement mapping item must be an object"); continue; }
    requireString(item.requirement, "assurance report mapped requirement", errors);
    requireEnum(item.status, ASSURANCE_STATUSES, "assurance report mapped status", errors);
    validateStringArray(item.evidence_ids, "assurance report mapped evidence_ids", errors);
    requireString(item.verification_path, "assurance report verification_path", errors);
    if (item.status === "VERIFIED" && item.evidence_ids.length === 0) errors.push("assurance report VERIFIED mapping requires evidence IDs");
    for (const evidenceId of item.evidence_ids || []) {
      const record = reportEvidenceById.get(evidenceId);
      if (!record) errors.push(`assurance report mapping evidence ${evidenceId} is absent from the global evidence ledger`);
      else if (item.status === "VERIFIED" && record.direct_recheck_status !== "RECHECKED") errors.push(`assurance report mapping evidence ${evidenceId} is not RECHECKED`);
    }
  }
  if (!Array.isArray(report.all_ten_coverage) || report.all_ten_coverage.length !== 10) errors.push("assurance report all-ten coverage must contain exactly ten roles");
  else {
    const ids = report.all_ten_coverage.map(function coverageId(item) { return item.role_id; }).sort();
    if (stableJson(ids) !== stableJson(Object.keys(ASSURANCE_RUNTIME_IDENTITIES).sort())) errors.push("assurance report all-ten coverage role set is not canonical");
    for (const item of report.all_ten_coverage) {
      requireEnum(
        item.routing_disposition,
        new Set(["SELECTED", "EXCLUDED"]),
        "assurance report routing disposition",
        errors,
      );
      requireString(item.routing_reason, "assurance report routing reason", errors);
      validateStringArray(
        item.routing_evidence_locators,
        "assurance report routing evidence locators",
        errors,
      );
      if (Array.isArray(item.routing_evidence_locators) && item.routing_evidence_locators.length === 0) {
        errors.push("assurance report routing evidence locators must not be empty");
      }
    }
  }
  if (!Array.isArray(report.findings)) errors.push("assurance report findings must be an array");
  if (!Array.isArray(report.orthogonal_statuses)) errors.push("assurance report orthogonal statuses must be an array");
  if (!isRecord(report.evidence_classes)) errors.push("assurance report evidence classes must be an object");
  if (!isRecord(report.platform_statuses)) errors.push("assurance report platform statuses must be an object");
  if (!isRecord(report.role_10_closure)) errors.push("assurance report Role 10 closure must be an object");
  if (!isRecord(report.usage)) errors.push("assurance report usage must be an object");
  else {
    validateHash(report.usage.ledger_hash, "assurance report usage ledger hash", errors);
    if (isRecord(input?.usageLedger) && report.usage.ledger_hash !== sha256Canonical(input.usageLedger)) errors.push("assurance report usage hash does not match input");
  }
  if (!isRecord(report.baseline_comparison)) errors.push("assurance report baseline comparison must be an object");
  else {
    requireEnum(report.baseline_comparison.status, new Set(["VERIFIED", "UNVERIFIED"]), "assurance report baseline status", errors);
    requireEnum(report.baseline_comparison.quality_noninferiority_status, new Set(["VERIFIED", "UNVERIFIED", "FAILED"]), "assurance report quality status", errors);
    validateStringArray(report.baseline_comparison.limitations, "assurance report baseline limitations", errors);
  }
  if (!Array.isArray(report.residual_risks)) errors.push("assurance report residual risks must be an array");
  return { errors: uniqueStrings(errors) };
}

function validatePassBClosureBindings(receiptsByKey, manifest, evidenceLedger, findingLedger, errors) {
  const passBKey = M2_SENTINEL_ROLE_ID + ":PASS_B";
  const passBReceipt = receiptsByKey.get(passBKey);
  if (!passBReceipt) return;
  const audit = passBReceipt.closure_audit;
  if (!isRecord(audit)) return;
  const receiptManifest = {};
  const passBSequence = (manifest.phase_plan || []).find(function passBPhase(phase) {
    return phase.role_id + ":" + phase.phase === passBKey;
  })?.sequence ?? Number.POSITIVE_INFINITY;
  for (const phase of manifest.phase_plan || []) {
    const key = phase.role_id + ":" + phase.phase;
    if (key === passBKey || phase.sequence >= passBSequence) continue;
    const receipt = receiptsByKey.get(key);
    if (receipt) receiptManifest[key] = sha256Canonical(receipt);
  }
  if (audit.receipt_manifest_hash !== sha256Canonical(receiptManifest)) {
    errors.push("PASS_B closure_audit receipt_manifest_hash does not match supplied receipts");
  }
  if (audit.evidence_ledger_hash !== sha256Canonical(evidenceLedger)) {
    errors.push("PASS_B closure_audit evidence_ledger_hash does not match supplied ledger");
  }
  if (audit.finding_ledger_hash !== sha256Canonical(findingLedger)) {
    errors.push("PASS_B closure_audit finding_ledger_hash does not match supplied ledger");
  }
  const qaReceipt = receiptsByKey.get("qa-evidence-release-verification:QA_CLOSURE");
  if (!qaReceipt || audit.qa_closure_receipt_hash !== sha256Canonical(qaReceipt)) {
    errors.push("PASS_B closure_audit qa_closure_receipt_hash does not match supplied QA closure");
  }
  const passAReceipt = receiptsByKey.get(M2_SENTINEL_ROLE_ID + ":PASS_A");
  if (!passAReceipt || audit.pass_a_receipt_hash !== sha256Canonical(passAReceipt)) {
    errors.push("PASS_B closure_audit pass_a_receipt_hash does not match supplied Pass A");
  }
}

function validateReceiptEvidenceBindings(receipts, evidenceById, errors) {
  for (const receipt of receipts) {
    for (const evidence of Array.isArray(receipt.evidence_used) ? receipt.evidence_used : []) {
      const ledgerEvidence = evidenceById.get(evidence.evidence_id);
      if (!ledgerEvidence) {
        errors.push(`receipt ${assuranceKey(receipt)} evidence is absent from the global ledger`);
        continue;
      }
      if (stableJson(evidence) !== stableJson(ledgerEvidence)) {
        errors.push(`receipt ${assuranceKey(receipt)} evidence does not match the global ledger`);
      }
    }
  }
}

function validateParentReceiptBindings(receipts, receiptsByKey, errors) {
  for (const receipt of receipts) {
    if (!isRecord(receipt.phase_dependency_receipts)) continue;
    for (const parentKey of Object.keys(receipt.phase_dependency_receipts)) {
      const parentReceipt = receiptsByKey.get(parentKey);
      if (!parentReceipt) {
        errors.push(`receipt ${assuranceKey(receipt)} is missing parent receipt ${parentKey}`);
        continue;
      }
      if (parentReceipt.phase_sequence >= receipt.phase_sequence) {
        errors.push(`receipt ${assuranceKey(receipt)} parent phase is not earlier`);
      }
      if (Date.parse(parentReceipt.issued_at) > Date.parse(receipt.issued_at)) {
        errors.push(`receipt ${assuranceKey(receipt)} was issued before parent receipt ${parentKey}`);
      }
      const actualParentHash = sha256Canonical(parentReceipt);
      if (receipt.phase_dependency_receipts[parentKey] !== actualParentHash) {
        errors.push(`receipt ${assuranceKey(receipt)} parent receipt hash does not match ${parentKey}`);
      }
    }
  }
}

function validatePreviousReceiptBindings(receipts, receiptsByHash, errors) {
  for (const receipt of receipts) {
    if (receipt.previous_receipt_hash === null) continue;
    const previous = receiptsByHash.get(receipt.previous_receipt_hash);
    if (!previous || previous === receipt) {
      errors.push(`receipt ${assuranceKey(receipt)} previous_receipt_hash is not supplied`);
      continue;
    }
    if (
      previous.run_id !== receipt.run_id ||
      previous.role_id !== receipt.role_id ||
      previous.phase !== receipt.phase
    ) {
      errors.push(`receipt ${assuranceKey(receipt)} previous receipt identity does not match`);
    }
    if (Date.parse(previous.issued_at) >= Date.parse(receipt.issued_at)) {
      errors.push(`receipt ${assuranceKey(receipt)} previous receipt is not earlier`);
    }
  }
}

function validateClaimDependencyGraph(claims, errors) {
  const byId = new Map(claims.map(function claimEntry(claim) {
    return [claim.claim_id, claim];
  }));
  const visiting = new Set();
  const visited = new Set();
  function visit(claimId) {
    if (visiting.has(claimId)) {
      errors.push(`claim dependency cycle detected at ${claimId}`);
      return;
    }
    if (visited.has(claimId)) return;
    visiting.add(claimId);
    const claim = byId.get(claimId);
    const dependencies = claim && Array.isArray(claim.depends_on_claim_ids)
      ? claim.depends_on_claim_ids
      : [];
    for (const dependencyId of dependencies) {
      if (byId.has(dependencyId)) visit(dependencyId);
    }
    visiting.delete(claimId);
    visited.add(claimId);
  }
  for (const claimId of byId.keys()) visit(claimId);
}

function validateAcceptedRiskBindings(input, manifest, findingLedger, errors) {
  const authorityDecisions = Array.isArray(input && input.authorityDecisions)
    ? input.authorityDecisions
    : [];
  const decisionsByHash = new Map();
  for (const decision of authorityDecisions) {
    const validation = validateAuthorityDecision(decision, { now: input && input.now });
    errors.push(...validation.errors);
    if (decision.run_id !== manifest.run_id) errors.push("authority decision run_id does not match manifest");
    if (decision.authority_policy_hash !== manifest.policy_hash) {
      errors.push("authority decision policy hash does not match manifest");
    }
    decisionsByHash.set(sha256Canonical(decision), decision);
  }
  for (const version of latestFindingVersions(findingLedger)) {
    if (version.risk_decision !== "ACCEPTED_BY_VERIFIED_AUTHORITY") continue;
    const decision = decisionsByHash.get(version.authority_decision_hash);
    if (!decision) {
      errors.push("accepted risk is not bound to a supplied valid authority decision");
      continue;
    }
    if (decision.decision_type !== "RISK_ACCEPTANCE") {
      errors.push("accepted risk authority decision must use RISK_ACCEPTANCE");
    }
    for (const blockingScope of version.blocking_scope || []) {
      if (!scopeMatches(blockingScope, [decision.decision_scope])) {
        errors.push("accepted risk authority decision does not cover finding blocking scope");
      }
    }
  }
}

function aggregateResult(status, reasons) {
  return { status, reasons: uniqueStrings(reasons).sort() };
}

function assuranceKey(receipt) {
  return `${receipt.role_id}:${receipt.phase}`;
}

function latestFindingVersions(ledger) {
  if (!isRecord(ledger) || !Array.isArray(ledger.findings)) return [];
  return ledger.findings.map(function latestVersion(finding) {
    return finding.versions[finding.versions.length - 1];
  });
}

export function computeInvalidatedClaims(claims, currentDependencyHashes) {
  const records = Array.isArray(claims) ? claims : [];
  const invalidated = new Set();
  for (const claim of records) {
    const dependencies = isRecord(claim.dependency_hashes) ? claim.dependency_hashes : {};
    for (const key of Object.keys(dependencies)) {
      if (dependencies[key] !== currentDependencyHashes[key]) invalidated.add(claim.claim_id);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const claim of records) {
      if (invalidated.has(claim.claim_id)) continue;
      const upstreamInvalid = (claim.depends_on_claim_ids || []).some(function dependencyInvalid(claimId) {
        return invalidated.has(claimId);
      });
      if (upstreamInvalid) {
        invalidated.add(claim.claim_id);
        changed = true;
      }
    }
  }
  const ids = Array.from(invalidated).sort();
  return { invalidated_claim_ids: ids, reopened_closure_claim_ids: ids.slice() };
}

export function validateUsageLedger(ledger, options = {}) {
  const errors = [];
  if (!isRecord(ledger)) return { errors: ["usage ledger must be an object"] };
  const manifest = options.manifest;
  const manifestErrors = validateRunManifest(manifest).errors;
  if (manifestErrors.length !== 0) {
    errors.push("usage ledger requires a valid run manifest");
    errors.push(...manifestErrors);
  }
  requireExact(ledger.schema_version, "zenflow-ten-lens-usage-v2.2.1-e1", "usage ledger schema_version", errors);
  requireString(ledger.run_id, "usage ledger run_id", errors);
  validateHash(ledger.manifest_sha256, "usage ledger manifest_sha256", errors);
  validateHash(ledger.build_sha256, "usage ledger build_sha256", errors);
  validateHash(ledger.registry_sha256, "usage ledger registry_sha256", errors);
  validateHash(ledger.direct_request_content_sha256, "usage ledger direct_request_content_sha256", errors);
  validateHash(ledger.subject_scoped_snapshot_sha256, "usage ledger subject_scoped_snapshot_sha256", errors);
  validateHash(ledger.profile_set_hash, "usage ledger profile_set_hash", errors);
  validateHash(ledger.tool_inventory_hash, "usage ledger tool_inventory_hash", errors);
  validateHash(ledger.runtime_inventory_hash, "usage ledger runtime_inventory_hash", errors);
  validateHash(ledger.verification_plan_hash, "usage ledger verification_plan_hash", errors);
  validateHash(ledger.permission_scope_sha256, "usage ledger permission_scope_sha256", errors);
  requireEnum(
    ledger.routing_mode,
    new Set(["EVIDENCE_FIRST_ADAPTIVE", "FIXED_FULL_TEN"]),
    "usage ledger routing_mode",
    errors,
  );
  if (isRecord(manifest)) {
    if (ledger.run_id !== manifest.run_id) errors.push("usage ledger run_id does not match manifest");
    if (ledger.routing_mode !== manifest.routing_mode) errors.push("usage ledger routing_mode does not match manifest");
    if (ledger.build_sha256 !== manifest.assurance_build_sha256) {
      errors.push("usage ledger build hash does not match manifest assurance build");
    }
    if (ledger.registry_sha256 !== manifest.classification_registry_digest) {
      errors.push("usage ledger registry hash does not match manifest");
    }
    if (ledger.direct_request_content_sha256 !== manifest.direct_request?.content_sha256) {
      errors.push("usage ledger direct request hash does not match manifest");
    }
    if (ledger.manifest_sha256 !== sha256Canonical(manifest)) {
      errors.push("usage ledger manifest_sha256 does not match manifest");
    }
    if (ledger.subject_scoped_snapshot_sha256 !== manifest.subject_scoped_snapshot_sha256) {
      errors.push("usage ledger subject snapshot does not match manifest");
    }
    if (ledger.profile_set_hash !== manifest.profile_set_hash) {
      errors.push("usage ledger profile set does not match manifest");
    }
    if (ledger.tool_inventory_hash !== manifest.tool_inventory_hash) {
      errors.push("usage ledger tool inventory does not match manifest");
    }
    if (ledger.runtime_inventory_hash !== manifest.runtime_inventory_hash) {
      errors.push("usage ledger runtime inventory does not match manifest");
    }
    if (ledger.verification_plan_hash !== manifest.verification_plan_hash) {
      errors.push("usage ledger verification plan does not match manifest");
    }
    if (ledger.permission_scope_sha256 !== sha256Canonical(manifest.authority_write_scope)) {
      errors.push("usage ledger permission scope does not match manifest authority");
    }
  }
  if (!Array.isArray(ledger.entries)) {
    errors.push("usage ledger entries must be an array");
    return { errors };
  }
  if (ledger.entries.length === 0) errors.push("usage ledger entries must not be empty");
  const usageFields = [
    "requests",
    "input_tokens",
    "cached_input_tokens",
    "cache_write_tokens",
    "output_tokens",
    "reasoning_tokens",
    "tool_calls",
    "retries",
    "role_invocations",
    "peak_concurrency",
    "elapsed_ms",
    "actual_price_or_credits",
  ];
  const observedEntryKeys = [];
  for (let index = 0; index < ledger.entries.length; index += 1) {
    const entry = ledger.entries[index];
    const label = `usage entry ${index}`;
    if (!isRecord(entry)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    requireString(entry.run_id, `${label} run_id`, errors);
    requireString(entry.role_id, `${label} role_id`, errors);
    requireString(entry.phase, `${label} phase`, errors);
    requireString(entry.model, `${label} model`, errors);
    requireString(entry.reasoning_effort, `${label} reasoning_effort`, errors);
    if (entry.run_id !== ledger.run_id) errors.push(`${label} run_id does not match usage ledger`);
    if (!ASSURANCE_RUNTIME_IDENTITIES[entry.role_id]) errors.push(`${label} role_id is not canonical`);
    observedEntryKeys.push(`${entry.role_id}:${entry.phase}`);
    for (const field of usageFields) {
      const value = entry[field];
      if (value !== "UNAVAILABLE" && (!Number.isFinite(value) || value < 0)) {
        errors.push(`${label} ${field} must be a nonnegative exposed value or UNAVAILABLE`);
      }
    }
    if (/estimate/i.test(stableJson(entry))) errors.push(`${label} must not contain estimated usage`);
  }
  if (isRecord(manifest) && Array.isArray(manifest.required_receipt_keys)) {
    if (stableJson(uniqueStrings(observedEntryKeys)) !== stableJson(uniqueStrings(manifest.required_receipt_keys))) {
      errors.push("usage ledger role/phase entries must exactly match manifest required phases");
    }
    if (new Set(observedEntryKeys).size !== observedEntryKeys.length) {
      errors.push("usage ledger contains duplicate role/phase entries");
    }
  }
  return { errors: uniqueStrings(errors) };
}

export function validateAuthorityDecision(decision, options = {}) {
  const errors = [];
  const now = options.now instanceof Date ? options.now : new Date();
  if (!isRecord(decision)) return { errors: ["authority decision must be an object"] };
  requireExact(decision.schema_version, "zenflow-authority-decision-v2.2.1-e1", "authority decision schema_version", errors);
  for (const field of [
    "run_id",
    "authority_policy_version",
    "authority_id",
    "authority_class",
    "qualification_basis",
    "credential_or_role_reference",
    "revocation_status",
    "independence_requirement",
    "conflict_of_interest_status",
    "decision_type",
    "decision_scope",
    "matched_authority_rule_id",
    "qualification_scope",
  ]) requireString(decision[field], `authority decision ${field}`, errors);
  validateHash(decision.authority_policy_hash, "authority decision authority_policy_hash", errors);
  validateHash(decision.authorization_validation_receipt, "authority decision authorization_validation_receipt", errors);
  validateStringArray(decision.authorized_decision_types, "authority decision authorized_decision_types", errors);
  validateStringArray(decision.authorized_scopes, "authority decision authorized_scopes", errors);
  if (!Array.isArray(decision.delegation_chain)) errors.push("authority decision delegation_chain must be an array");
  validateIso(decision.valid_from, "authority decision valid_from", errors);
  validateIso(decision.valid_until, "authority decision valid_until", errors);
  const validFrom = Date.parse(decision.valid_from);
  const validUntil = Date.parse(decision.valid_until);
  if (Number.isFinite(validFrom) && now.getTime() < validFrom) errors.push("authority decision is not yet valid");
  if (Number.isFinite(validUntil) && validUntil < now.getTime()) errors.push("authority decision is expired");
  if (decision.revocation_status !== "ACTIVE") errors.push("authority decision is revoked or inactive");
  if (!Array.isArray(decision.authorized_decision_types) || !decision.authorized_decision_types.includes(decision.decision_type)) {
    errors.push("authority decision type is not authorized");
  }
  if (!scopeMatches(decision.decision_scope, decision.authorized_scopes)) {
    errors.push("authority decision scope is outside authorized scopes");
  }
  if (!scopeMatches(decision.decision_scope, [decision.qualification_scope])) {
    errors.push("authority decision scope is outside qualification scope");
  }
  if (/CONFLICT|UNCHECKED/i.test(decision.conflict_of_interest_status)) {
    errors.push("authority decision conflict of interest is not cleared");
  }
  return { errors: uniqueStrings(errors) };
}

function scopeMatches(scope, allowedScopes) {
  if (typeof scope !== "string" || !Array.isArray(allowedScopes)) return false;
  return allowedScopes.some(function allowed(allowedScope) {
    return scope === allowedScope || scope.startsWith(`${allowedScope}.`);
  });
}

export function validateRuntimePersistenceInventory(inventory) {
  const errors = [];
  if (!isRecord(inventory)) return { errors: ["runtime persistence inventory must be an object"] };
  requireExact(
    inventory.schema_version,
    "zenflow-runtime-persistence-inventory-v2.2.1-e1",
    "runtime persistence inventory schema_version",
    errors,
  );
  requireString(inventory.run_id, "runtime persistence inventory run_id", errors);
  if (inventory.sensitive_run !== true && inventory.sensitive_run !== false) {
    errors.push("runtime persistence inventory sensitive_run must be boolean");
  }
  if (!Array.isArray(inventory.channels)) {
    errors.push("runtime persistence inventory channels must be an array");
    return { errors };
  }
  const seen = new Set();
  for (let index = 0; index < inventory.channels.length; index += 1) {
    const channel = inventory.channels[index];
    const label = `runtime persistence channel ${index}`;
    if (!isRecord(channel)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    requireString(channel.runtime_channel, `${label} runtime_channel`, errors);
    if (seen.has(channel.runtime_channel)) errors.push(`${label} runtime_channel must be unique`);
    seen.add(channel.runtime_channel);
    for (const field of [
      "default_persistence",
      "configured_persistence",
      "actual_probe_result",
      "storage_location",
      "encryption",
      "access_scope",
      "retention_ttl",
      "deletion_method",
      "evidence_status",
    ]) requireString(channel[field], `${label} ${field}`, errors);
    if (channel.sensitive_data_allowed !== true && channel.sensitive_data_allowed !== false) {
      errors.push(`${label} sensitive_data_allowed must be boolean`);
    }
  }
  for (const requiredChannel of REQUIRED_RUNTIME_CHANNELS) {
    if (!seen.has(requiredChannel)) errors.push(`runtime persistence inventory missing ${requiredChannel}`);
  }
  if (inventory.sensitive_run === true) {
    const history = inventory.channels.find(function historyChannel(channel) {
      return isRecord(channel) && channel.runtime_channel === "CODEX_HISTORY";
    });
    if (!history || history.configured_persistence !== "none") {
      errors.push("sensitive run requires CODEX_HISTORY configured_persistence none");
    }
    for (const channel of inventory.channels) {
      if (!isRecord(channel)) continue;
      if (channel.evidence_status !== "VERIFIED") {
        errors.push(`sensitive run persistence channel ${channel.runtime_channel} lacks verified evidence`);
      }
      const expectedProbe = channel.sensitive_data_allowed === true
        ? "VERIFIED_ALLOWED_WITH_CONTROLS"
        : "VERIFIED_EXCLUDED";
      if (channel.actual_probe_result !== expectedProbe) {
        errors.push(`sensitive run persistence channel ${channel.runtime_channel} actual probe is not ${expectedProbe}`);
      }
    }
  }
  return { errors: uniqueStrings(errors) };
}

export function createSpecialistPacket(input) {
  if (input.inputDataClassification !== "REDACTED_TASK_METADATA") {
    throw new Error("specialist packet requires REDACTED_TASK_METADATA; raw private content is forbidden");
  }
  const registry = input.registry;
  const manifest = input.manifest;
  const manifestValidation = validateRunManifest(manifest);
  if (manifestValidation.errors.length !== 0) {
    throw new Error(`invalid run manifest: ${manifestValidation.errors.join("; ")}`);
  }
  const role = registry.roles.find(function selectedRole(item) {
    return item.id === input.roleId;
  });
  if (!role) throw new Error(`unknown specialist role: ${input.roleId}`);
  if (role.phase_contracts && !role.phase_contracts[input.phase]) {
    throw new Error(`role ${input.roleId} does not support phase ${input.phase}`);
  }
  if (!manifest.required_receipt_keys.includes(`${input.roleId}:${input.phase}`)) {
    throw new Error("specialist role and phase are not declared by the run manifest");
  }
  const plannedPhase = manifest.phase_plan.find(function packetPhase(phase) {
    return phase.role_id === input.roleId && phase.phase === input.phase;
  });
  const requiredParentKeys = requiredParentReceiptKeys({
    role_id: input.roleId,
    phase: input.phase,
    phase_sequence: plannedPhase.sequence,
  }, manifest);
  const explicitlySuppliedDependencies = isRecord(input.phaseDependencyReceipts)
    ? input.phaseDependencyReceipts
    : null;
  const legacyParentHashes = uniqueStrings(input.parentReceiptHashes);
  let phaseDependencyReceipts = explicitlySuppliedDependencies === null
    ? {}
    : { ...explicitlySuppliedDependencies };
  if (
    explicitlySuppliedDependencies === null &&
    requiredParentKeys.length === 1 &&
    legacyParentHashes.length === 1
  ) {
    phaseDependencyReceipts = { [requiredParentKeys[0]]: legacyParentHashes[0] };
  }
  const suppliedParentKeys = Object.keys(phaseDependencyReceipts).sort();
  if (stableJson(suppliedParentKeys) !== stableJson(requiredParentKeys)) {
    throw new Error(`${input.phase} phase dependency receipts must exactly match every required earlier phase`);
  }
  for (const parentKey of suppliedParentKeys) {
    if (!HASH_PATTERN.test(phaseDependencyReceipts[parentKey])) {
      throw new Error(`phase dependency receipt ${parentKey} must be SHA-256`);
    }
  }
  if (input.phase === "PASS_B") {
    const closureErrors = [];
    validateClosureAudit({
      phase: input.phase,
      closure_audit: input.closureAudit,
      phase_dependency_receipts: phaseDependencyReceipts,
      evidence_ledger_hash: input.closureAudit?.evidence_ledger_hash,
    }, manifest, closureErrors);
    if (closureErrors.length !== 0) {
      throw new Error(`invalid PASS_B closure audit: ${closureErrors.join("; ")}`);
    }
  } else if (input.closureAudit !== undefined) {
    throw new Error("closureAudit is allowed only for PASS_B");
  }
  const parentReceiptHashes = uniqueStrings(Object.values(phaseDependencyReceipts));
  if (
    legacyParentHashes.length !== 0 &&
    stableJson(legacyParentHashes) !== stableJson(parentReceiptHashes)
  ) {
    throw new Error("parent receipt hashes do not match phase dependency receipts");
  }
  let passAVisibilityRecords;
  if (input.phase === "PASS_A") {
    if (!Array.isArray(input.evidenceRecords) || input.evidenceRecords.length === 0) {
      throw new Error("Pass A requires typed visibility evidence records");
    }
    passAVisibilityRecords = input.evidenceRecords.map(function validatePassARecord(record) {
      if (!isRecord(record) || !PASS_A_ALLOWED_EVIDENCE_CLASSES.includes(record.evidence_class)) {
        throw new Error("Pass A evidence class is outside the visibility policy");
      }
      if (typeof record.locator !== "string" || record.locator.length === 0) {
        throw new Error("Pass A visibility record requires a locator");
      }
      if (PASS_A_FORBIDDEN_LOCATOR_PREFIXES.some(function forbidden(prefix) { return record.locator.startsWith(prefix); })) {
        throw new Error("Pass A visibility locator is forbidden by construction");
      }
      return { evidence_class: record.evidence_class, locator: record.locator };
    });
  }
  const protocol = registry.assurance_protocol;
  const stableObject = {
    protocol_version: protocol.version,
    schema_version: protocol.receipt_schema_version,
    project: registry.orchestra_id,
    role_id: role.id,
    role_contract_hash: role.semantic_contract_sha256,
    phase: input.phase,
    trust_policy_hash: manifest.policy_hash,
    profile_hash: manifest.profile_set_hash,
    output_contract: protocol.compact_receipt_contract,
  };
  const dynamicObject = {
    run_id: manifest.run_id,
    run_nonce: manifest.run_nonce,
    subject_scoped_snapshot_sha256: manifest.subject_scoped_snapshot_sha256,
    input_data_classification: input.inputDataClassification,
    question_owned: input.questionOwned,
    evidence_locators: uniqueStrings(input.evidenceLocators),
    parent_receipt_hashes: parentReceiptHashes,
    phase_dependency_receipts: phaseDependencyReceipts,
  };
  if (input.phase === "PASS_A") dynamicObject.pass_a_visibility_records = passAVisibilityRecords;
  if (input.phase === "PASS_B") dynamicObject.closure_audit = input.closureAudit;
  const stablePrefix = stableJson(stableObject);
  const dynamicSuffix = stableJson(dynamicObject);
  const partition = [
    registry.orchestra_id,
    protocol.version,
    role.id,
    manifest.policy_hash,
    role.semantic_contract_sha256,
  ].join(":");
  return {
    prompt_cache_partition: partition,
    stable_prefix: stablePrefix,
    dynamic_suffix: dynamicSuffix,
    packet_sha256: sha256Canonical({
      stable_prefix: stablePrefix,
      dynamic_suffix: dynamicSuffix,
    }),
  };
}

export async function buildRepositorySnapshot(input) {
  const rootDir = path.resolve(input.rootDir);
  const scopePaths = uniqueStrings(input.scopePaths || []).map(normalizeRelativePath);
  if (scopePaths.length === 0) throw new Error("repository snapshot requires scopePaths");
  const headOid = gitText(rootDir, ["rev-parse", "HEAD"]);
  const trackedTreeOid = gitText(rootDir, ["rev-parse", "HEAD^{tree}"]);
  const gitVersion = gitText(rootDir, ["--version"]);
  const trackedDirtyPaths = uniqueStrings([
    ...parseZeroSeparated(gitText(rootDir, [
      "diff", "--cached", "--name-only", "-z", "--no-ext-diff", "--no-textconv", "--no-renames",
    ], false)),
    ...parseZeroSeparated(gitText(rootDir, [
      "diff", "--name-only", "-z", "--no-ext-diff", "--no-textconv", "--no-renames",
    ], false)),
  ]).map(normalizeRelativePath);
  const untrackedPaths = parseZeroSeparated(gitText(rootDir, [
    "ls-files", "--others", "--exclude-standard", "-z",
  ], false)).map(normalizeRelativePath);
  const scopeInventory = await inventoryPaths(rootDir, scopePaths);
  const trackedDirtyInventory = await inventoryPaths(rootDir, trackedDirtyPaths, true);
  const untrackedInventory = await inventoryPaths(rootDir, untrackedPaths, true);
  const outsideScopeDirtyPaths = uniqueStrings(trackedDirtyPaths.concat(untrackedPaths).filter(
    function outsideDeclaredScope(candidatePath) {
      return !scopePaths.some(function containsCandidate(scopePath) {
        return candidatePath === scopePath || candidatePath.startsWith(`${scopePath}/`);
      });
    },
  ));
  const scopeDerivationEvidence = {
    disposition: "OUTSIDE_SCOPE_DIRTY_PATHS_INCLUDED_IN_DEPENDENCY_CLOSURE",
    declared_scope_paths: scopePaths,
    outside_scope_dirty_paths: outsideScopeDirtyPaths,
    tracked_dirty_inventory_sha256: sha256Canonical(trackedDirtyInventory),
    untracked_inventory_sha256: sha256Canonical(untrackedInventory),
  };
  const criticalInventory = await inventoryPaths(rootDir, [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "package.json",
    "package-lock.json",
    ".codex/hooks.json",
    ".codex/config.toml",
    "config/persistent-agent-orchestra.json",
    "config/persistent-agent-orchestra.evals.json",
    "config/persistent-agent-orchestra.eval-baseline.json",
    "scripts/persistent-agent-orchestra/registry-core.mjs",
    "scripts/persistent-agent-orchestra/eval-core.mjs",
    "scripts/persistent-agent-orchestra/assurance-core.mjs",
    "docs/ai/TEST_FIRST_AGENT_POLICY.md",
    "docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md",
  ], true);
  const diffConfig = {};
  for (const key of [
    "core.autocrlf",
    "core.filemode",
    "core.ignorecase",
    "core.quotepath",
    "diff.renames",
  ]) {
    diffConfig[key] = gitOptionalText(rootDir, ["config", "--get", key]);
  }
  const indexDiff = gitText(rootDir, [
    "diff", "--cached", "--binary", "--no-ext-diff", "--no-textconv", "--no-renames",
  ], false);
  const worktreeDiff = gitText(rootDir, [
    "diff", "--binary", "--no-ext-diff", "--no-textconv", "--no-renames",
  ], false);
  const dependencyClosure = {
    scope_inventory_sha256: sha256Canonical(scopeInventory),
    critical_global_inputs_sha256: sha256Canonical(criticalInventory),
    repository_dirty_path_inventory_sha256: sha256Canonical(trackedDirtyInventory),
    repository_untracked_path_inventory_sha256: sha256Canonical(untrackedInventory),
    scope_derivation_evidence_sha256: sha256Canonical(scopeDerivationEvidence),
    index_diff_sha256: sha256Text(indexDiff),
    worktree_diff_sha256: sha256Text(worktreeDiff),
  };
  const snapshotIdentity = {
    snapshot_algorithm_version: "zenflow-git-snapshot-v2.2.1-e1",
    head_oid: headOid,
    repository_tracked_tree_oid: trackedTreeOid,
    scope_paths: scopePaths,
    scope_inventory: scopeInventory,
    scope_derivation_evidence: scopeDerivationEvidence,
    dependency_closure_digest: sha256Canonical(dependencyClosure),
    diff_relevant_config_digest: sha256Canonical(diffConfig),
  };
  return {
    snapshot_algorithm_version: snapshotIdentity.snapshot_algorithm_version,
    scope_derivation_algorithm_version: "zenflow-repository-closure-v2.2.1-e1",
    scope_derivation_evidence: scopeDerivationEvidence,
    git_version: gitVersion,
    subject_base_commit_oid: headOid,
    head_oid: headOid,
    repository_tracked_tree_oid: trackedTreeOid,
    repository_dirty_path_inventory_sha256: dependencyClosure.repository_dirty_path_inventory_sha256,
    repository_untracked_path_inventory_sha256: dependencyClosure.repository_untracked_path_inventory_sha256,
    repository_index_diff_sha256: dependencyClosure.index_diff_sha256,
    repository_worktree_diff_sha256: dependencyClosure.worktree_diff_sha256,
    critical_global_inputs_sha256: dependencyClosure.critical_global_inputs_sha256,
    dependency_closure_digest: snapshotIdentity.dependency_closure_digest,
    diff_relevant_config_digest: snapshotIdentity.diff_relevant_config_digest,
    subject_scoped_snapshot_sha256: sha256Canonical(snapshotIdentity),
    scope_paths: scopePaths,
  };
}

async function inventoryPaths(rootDir, relativePaths, allowMissing = false) {
  const rows = [];
  for (const relativePath of uniqueStrings(relativePaths)) {
    const normalized = normalizeRelativePath(relativePath);
    const absolute = path.resolve(rootDir, normalized);
    ensureInsideRoot(rootDir, absolute);
    try {
      await ensureNoSymlinkParents(rootDir, normalized);
      await inventoryEntry(rootDir, absolute, rows);
    } catch (error) {
      if (allowMissing && error && error.code === "ENOENT") {
        rows.push({ path: normalized, type: "MISSING" });
        continue;
      }
      throw error;
    }
  }
  rows.sort(function compareRows(left, right) {
    return compareUtf8Strings(left.path, right.path);
  });
  return rows;
}

async function ensureNoSymlinkParents(rootDir, normalizedPath) {
  const rootStat = await lstat(rootDir);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("repository snapshot root must be a real directory");
  }
  const segments = normalizedPath.split("/");
  let current = rootDir;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`repository snapshot path crosses a symlink parent: ${normalizedPath}`);
    }
    if (!stat.isDirectory()) {
      throw new Error(`repository snapshot parent is not a directory: ${normalizedPath}`);
    }
  }
}

async function inventoryEntry(rootDir, absolute, rows) {
  const stat = await lstat(absolute);
  const relative = path.relative(rootDir, absolute).split(path.sep).join("/");
  await ensureNoSymlinkParents(rootDir, relative);
  if (stat.isSymbolicLink()) {
    const target = await readlink(absolute);
    rows.push({ path: relative, type: "SYMLINK", mode: stat.mode, sha256: sha256Text(target) });
    return;
  }
  if (stat.isDirectory()) {
    rows.push({ path: relative, type: "DIRECTORY", mode: stat.mode });
    const entries = await readdir(absolute, { withFileTypes: true });
    entries.sort(function compareEntries(left, right) {
      return compareUtf8Strings(left.name, right.name);
    });
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      await inventoryEntry(rootDir, path.join(absolute, entry.name), rows);
    }
    return;
  }
  if (!stat.isFile()) {
    rows.push({ path: relative, type: "SPECIAL", mode: stat.mode });
    return;
  }
  if (stat.nlink !== 1) {
    throw new Error(`repository snapshot file must not be hardlinked: ${relative}`);
  }
  const handle = await open(absolute, "r");
  let content;
  try {
    const openedStat = await handle.stat();
    if (
      openedStat.dev !== stat.dev ||
      openedStat.ino !== stat.ino ||
      openedStat.mode !== stat.mode ||
      openedStat.nlink !== 1
    ) {
      throw new Error(`repository snapshot file identity changed while reading: ${relative}`);
    }
    content = await handle.readFile();
  } finally {
    await handle.close();
  }
  const finalStat = await lstat(absolute);
  if (finalStat.dev !== stat.dev || finalStat.ino !== stat.ino || finalStat.nlink !== 1) {
    throw new Error(`repository snapshot file identity changed after reading: ${relative}`);
  }
  rows.push({
    path: relative,
    type: "FILE",
    mode: stat.mode,
    size: stat.size,
    sha256: createHash("sha256").update(content).digest("hex"),
  });
}

function compareUtf8Strings(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function gitText(rootDir, args, trim = true) {
  const value = execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: MAX_GIT_CAPTURE_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return trim ? value.trim() : value;
}

function gitOptionalText(rootDir, args) {
  try {
    return gitText(rootDir, args);
  } catch {
    return "UNSET";
  }
}

function parseZeroSeparated(value) {
  return value.split("\0").filter(Boolean).sort();
}

function normalizeRelativePath(value) {
  if (typeof value !== "string" || value.trim() === "") throw new Error("scope path must be a string");
  const normalized = path.normalize(value).split(path.sep).join("/");
  if (path.isAbsolute(value) || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`scope path escapes repository: ${value}`);
  }
  return normalized;
}

function ensureInsideRoot(rootDir, absolute) {
  const relative = path.relative(rootDir, absolute);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("resolved path escapes repository");
  }
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value) {
  return JSON.stringify(sortCanonical(value));
}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (!isRecord(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = sortCanonical(value[key]);
  return result;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter(function stringValue(value) {
    return typeof value === "string" && value.trim() !== "";
  }))).sort();
}

function requireExact(value, expected, label, errors) {
  if (value !== expected) errors.push(`${label} must equal ${expected}`);
}

function requireString(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${label} must be a non-empty string`);
}

function requireEnum(value, allowed, label, errors) {
  if (!allowed.has(value)) errors.push(`${label} is invalid`);
}

function validateNonce(value, label, errors) {
  if (typeof value !== "string" || !NONCE_PATTERN.test(value)) errors.push(`${label} must be a UUID nonce`);
}

function validateIso(value, label, errors) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) errors.push(`${label} must be an ISO timestamp`);
}

function validateHashes(value, fields, label, errors) {
  for (const field of fields) validateHash(value[field], `${label} ${field}`, errors);
}

function validateHash(value, label, errors) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) errors.push(`${label} must be a lowercase SHA-256`);
}

function validateStringArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (value.some(function invalidString(item) {
    return typeof item !== "string" || item.trim() === "";
  })) errors.push(`${label} must contain only non-empty strings`);
  if (new Set(value).size !== value.length) errors.push(`${label} must not contain duplicates`);
}

function validateHashArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  for (const item of value) validateHash(item, label, errors);
  if (new Set(value).size !== value.length) errors.push(`${label} must not contain duplicates`);
}
