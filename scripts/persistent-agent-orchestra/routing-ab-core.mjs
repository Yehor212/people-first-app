import { createHash, randomBytes as cryptoRandomBytes } from "node:crypto";

export const ROUTING_AB_ARMS = Object.freeze(["ROOT_ONLY", "TARGETED", "FIXED_FULL_TEN"]);

const COMPLETED_REPORT_STATUS = "PILOT_COMPLETED";
const INTERRUPTED_REPORT_STATUS = "PILOT_INTERRUPTED";
const PREPARED_REPORT_STATUS = "PREPARED";
const REPORT_STATUSES = new Set([
  PREPARED_REPORT_STATUS,
  COMPLETED_REPORT_STATUS,
  INTERRUPTED_REPORT_STATUS,
]);
const ARM_STATUSES = new Set(["PREPARED", "COMPLETED", "INTERRUPTED"]);
const DISPOSITIONS = new Set(["SELECTED", "EXCLUDED"]);
const DECISION_STATUSES = new Set(["PILOT_NONPROMOTABLE", "PROMOTABLE"]);
const REVIEWER_STATUSES = new Set(["UNVERIFIED", "VERIFIED"]);
const HOLDOUT_STATUSES = new Set(["UNAVAILABLE", "VERIFIED"]);
const REQUIRED_CONDITION_KEYS = Object.freeze([
  "artifact_snapshot_sha256",
  "runtime_identity_sha256",
  "tool_surface_sha256",
  "budget_identity_sha256",
  "rubric_sha256",
]);
const REQUIRED_USAGE_KEYS = Object.freeze([
  "request_count",
  "input_tokens",
  "cached_input_tokens",
  "cache_write_tokens",
  "output_tokens",
  "reasoning_tokens",
]);

export function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculateTaskSliceSha256(taskSlice) {
  return sha256Text(stableJson({
    id: taskSlice.id,
    title: taskSlice.title,
    prompt: taskSlice.prompt,
    evidence_locators: [...taskSlice.evidence_locators].sort(),
    privacy_boundary: taskSlice.privacy_boundary,
  }));
}

export function createPreparedRoutingAbReport({
  now = new Date(),
  runId,
  roleIds,
  taskSlice,
  sharedConditions,
  randomBytes = cryptoRandomBytes,
}) {
  const canonicalRoleIds = requireCanonicalRoleIds(roleIds);
  const createdAt = toExactIsoTimestamp(now, "now");
  requireBoundedIdentifier(runId, "runId");
  const normalizedTaskSlice = normalizeTaskSlice(taskSlice);
  const normalizedConditions = normalizeSharedConditions(sharedConditions);
  if (typeof randomBytes !== "function") throw new TypeError("randomBytes must be a function");

  const executionOrder = shuffledArms(randomBytes);
  return {
    schema_version: 1,
    run_id: runId,
    created_at: createdAt,
    status: PREPARED_REPORT_STATUS,
    task_slice: normalizedTaskSlice,
    shared_conditions: {
      ...normalizedConditions,
      execution_order: executionOrder,
    },
    runtime_observations: {
      custom_profile_loading: "UNVERIFIED",
      effective_permissions: "UNVERIFIED",
    },
    canonical_role_ids: canonicalRoleIds,
    arms: ROUTING_AB_ARMS.map((armId) => createPreparedArm(armId, normalizedTaskSlice.sha256, normalizedConditions)),
    decision: {
      status: "PILOT_NONPROMOTABLE",
      reason_codes: ["PREPARED_NOT_EXECUTED"],
    },
    limitations: [
      "Preparation proves only the frozen local receipt shape and declared identities.",
      "Custom-profile loading, effective permissions, semantic quality, qualified review, and user value remain UNVERIFIED.",
    ],
  };
}

export function validateRoutingAbReport(report, { roleIds } = {}) {
  const errors = [];
  const warnings = [];
  const nonPromotableReasons = new Set();
  const canonicalRoleIds = validateCanonicalRoleIds(roleIds, errors);

  if (!isPlainObject(report)) {
    return result(["routing A/B report must be an object"], warnings, nonPromotableReasons);
  }
  rejectUnknownKeys(report, new Set([
    "schema_version",
    "run_id",
    "created_at",
    "status",
    "task_slice",
    "shared_conditions",
    "runtime_observations",
    "canonical_role_ids",
    "arms",
    "decision",
    "limitations",
  ]), "report", errors);
  if (report.schema_version !== 1) errors.push("report.schema_version must be 1");
  validateBoundedIdentifier(report.run_id, "report.run_id", errors);
  if (!isExactIsoTimestamp(report.created_at)) errors.push("report.created_at must be an exact ISO timestamp");
  if (!REPORT_STATUSES.has(report.status)) {
    errors.push("report.status must be PREPARED, PILOT_COMPLETED, or PILOT_INTERRUPTED");
  }

  const taskSha256 = validateTaskSlice(report.task_slice, errors);
  const sharedConditions = validateSharedConditions(report.shared_conditions, errors);
  validateRuntimeObservations(report.runtime_observations, errors, nonPromotableReasons);
  validateRoleIdSnapshot(report.canonical_role_ids, canonicalRoleIds, errors);
  validateLimitations(report.limitations, errors);

  if (!Array.isArray(report.arms) || report.arms.length !== ROUTING_AB_ARMS.length) {
    errors.push("report.arms must contain exactly the three required comparison arms");
  }

  const armById = new Map();
  if (Array.isArray(report.arms)) {
    for (const [index, arm] of report.arms.entries()) {
      validateArm({
        arm,
        index,
        taskSha256,
        sharedConditions,
        canonicalRoleIds,
        errors,
        nonPromotableReasons,
      });
      if (isPlainObject(arm) && typeof arm.arm_id === "string") {
        if (armById.has(arm.arm_id)) errors.push(`report.arms contains duplicate arm_id: ${arm.arm_id}`);
        armById.set(arm.arm_id, arm);
      }
    }
  }
  for (const armId of ROUTING_AB_ARMS) {
    if (!armById.has(armId)) errors.push(`report.arms is missing required arm ${armId}`);
  }
  validateExecutionOrder(report.shared_conditions?.execution_order, errors);
  validateNoDuplicateOutputHashes(armById, errors);

  if (report.status === PREPARED_REPORT_STATUS) {
    for (const armId of ROUTING_AB_ARMS) {
      if (armById.get(armId)?.status !== "PREPARED") {
        errors.push("PREPARED report cannot contain a completed or interrupted arm");
        break;
      }
    }
    nonPromotableReasons.add("PREPARED_NOT_EXECUTED");
  }
  if (report.status === COMPLETED_REPORT_STATUS) {
    for (const armId of ROUTING_AB_ARMS) {
      if (armById.get(armId)?.status !== "COMPLETED") {
        errors.push("PILOT_COMPLETED report requires every arm to be COMPLETED");
        break;
      }
    }
  }
  if (report.status === INTERRUPTED_REPORT_STATUS) {
    const hasInterruptedArm = [...armById.values()].some((arm) => arm?.status === "INTERRUPTED");
    if (!hasInterruptedArm) {
      errors.push("PILOT_INTERRUPTED report requires at least one arm to be INTERRUPTED");
    }
    nonPromotableReasons.add("PILOT_INTERRUPTED");
  }

  validateDecision({
    decision: report.decision,
    reportStatus: report.status,
    armById,
    errors,
    nonPromotableReasons,
  });

  if (errors.length === 0 && report.status === COMPLETED_REPORT_STATUS) {
    warnings.push("Local structure valid; supplied output-file hashes do not prove actual actor execution, semantic quality, human review, runtime enforcement, or user value.");
  }
  return result(errors, warnings, nonPromotableReasons);
}

function createPreparedArm(armId, taskSha256, sharedConditions) {
  return {
    arm_id: armId,
    status: "PREPARED",
    task_slice_sha256: taskSha256,
    shared_conditions: { ...sharedConditions },
    routing: {
      execution_role_ids: armId === "ROOT_ONLY" ? ["root"] : [],
      role_dispositions: [],
    },
    outputs: [],
    measurements: null,
    review: null,
  };
}

function validateArm({
  arm,
  index,
  taskSha256,
  sharedConditions,
  canonicalRoleIds,
  errors,
  nonPromotableReasons,
}) {
  const label = `report.arms[${index}]`;
  if (!isPlainObject(arm)) {
    errors.push(`${label} must be an object`);
    return;
  }
  rejectUnknownKeys(arm, new Set([
    "arm_id",
    "status",
    "task_slice_sha256",
    "shared_conditions",
    "routing",
    "outputs",
    "measurements",
    "review",
  ]), label, errors);
  if (!ROUTING_AB_ARMS.includes(arm.arm_id)) errors.push(`${label}.arm_id is invalid`);
  if (!ARM_STATUSES.has(arm.status)) errors.push(`${label}.status is invalid`);
  if (!isSha256(arm.task_slice_sha256)) errors.push(`${label}.task_slice_sha256 must be a SHA-256 digest`);
  else if (taskSha256 && arm.task_slice_sha256 !== taskSha256) {
    errors.push(`${label}.task_slice_sha256 must match report.task_slice.sha256`);
  }
  validateArmConditions(arm.shared_conditions, sharedConditions, label, errors);
  validateRouting(arm, canonicalRoleIds, label, errors);

  if (arm.status === "PREPARED") {
    if (!Array.isArray(arm.outputs) || arm.outputs.length !== 0) errors.push(`${label}.outputs must be empty while PREPARED`);
    if (arm.measurements !== null) errors.push(`${label}.measurements must be null while PREPARED`);
    if (arm.review !== null) errors.push(`${label}.review must be null while PREPARED`);
    return;
  }
  if (arm.status === "INTERRUPTED") return validateInterruptedArm(arm, label, errors, nonPromotableReasons);
  validateOutputs(arm.outputs, arm.routing?.execution_role_ids, label, errors);
  validateMeasurements(arm.measurements, label, errors, nonPromotableReasons);
  validateReview(arm.review, label, errors, nonPromotableReasons);
}

function validateInterruptedArm(arm, label, errors, nonPromotableReasons) {
  nonPromotableReasons.add("ARM_INTERRUPTED");
  if (!Array.isArray(arm.outputs) || arm.outputs.length !== 0) {
    errors.push(`${label}.outputs must be empty while INTERRUPTED`);
  }
  validateMeasurements(arm.measurements, label, errors, nonPromotableReasons, {
    requireInvocation: false,
    requireInterruption: true,
  });
  if (arm.review !== null) errors.push(`${label}.review must be null while INTERRUPTED`);
}

function validateRouting(arm, canonicalRoleIds, label, errors) {
  const routing = arm.routing;
  if (!isPlainObject(routing)) {
    errors.push(`${label}.routing must be an object`);
    return;
  }
  rejectUnknownKeys(routing, new Set(["execution_role_ids", "role_dispositions"]), `${label}.routing`, errors);
  const executionRoleIds = routing.execution_role_ids;
  if (!isUniqueStringArray(executionRoleIds)) errors.push(`${label}.routing.execution_role_ids must be a unique string array`);
  if (!Array.isArray(routing.role_dispositions)) errors.push(`${label}.routing.role_dispositions must be an array`);

  if (arm.arm_id === "ROOT_ONLY") {
    if (Array.isArray(executionRoleIds) && (executionRoleIds.length !== 1 || executionRoleIds[0] !== "root")) {
      errors.push(`${label}.routing.execution_role_ids must be [\"root\"] for ROOT_ONLY`);
    }
    if (Array.isArray(routing.role_dispositions) && routing.role_dispositions.length !== 0) {
      errors.push(`${label}.routing.role_dispositions must be empty for ROOT_ONLY`);
    }
    return;
  }

  if (arm.arm_id === "TARGETED" && arm.status !== "PREPARED") {
    validateTargetedDispositions(routing, canonicalRoleIds, label, errors);
  }
  if (arm.arm_id === "FIXED_FULL_TEN" && arm.status !== "PREPARED") {
    if (!sameStringSet(executionRoleIds, canonicalRoleIds)) {
      errors.push(`${label}.routing.execution_role_ids must execute every canonical role exactly once for FIXED_FULL_TEN`);
    }
  }
}

function validateTargetedDispositions(routing, canonicalRoleIds, label, errors) {
  const dispositions = routing.role_dispositions;
  if (!Array.isArray(dispositions) || dispositions.length !== canonicalRoleIds.length) {
    errors.push(`${label}.routing.role_dispositions must record exactly one disposition for every canonical role`);
    return;
  }
  const selectedRoleIds = [];
  const seenRoleIds = new Set();
  for (const [index, item] of dispositions.entries()) {
    const itemLabel = `${label}.routing.role_dispositions[${index}]`;
    if (!isPlainObject(item)) {
      errors.push(`${itemLabel} must be an object`);
      continue;
    }
    rejectUnknownKeys(item, new Set(["role_id", "disposition", "evidence_locators"]), itemLabel, errors);
    if (!canonicalRoleIds.includes(item.role_id)) errors.push(`${itemLabel}.role_id is not canonical`);
    if (seenRoleIds.has(item.role_id)) errors.push(`${itemLabel}.role_id is duplicated`);
    seenRoleIds.add(item.role_id);
    if (!DISPOSITIONS.has(item.disposition)) errors.push(`${itemLabel}.disposition must be SELECTED or EXCLUDED`);
    if (!isNonEmptyStringArray(item.evidence_locators)) errors.push(`${itemLabel}.evidence_locators must be non-empty`);
    if (item.disposition === "SELECTED") selectedRoleIds.push(item.role_id);
  }
  if (!sameStringSet([...seenRoleIds], canonicalRoleIds)) {
    errors.push(`${label}.routing.role_dispositions must record exactly one disposition for every canonical role`);
  }
  if (!sameStringSet(routing.execution_role_ids, selectedRoleIds)) {
    errors.push(`${label}.routing.execution_role_ids must exactly match the selected targeted roles`);
  }
}

function validateOutputs(outputs, executionRoleIds, label, errors) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    errors.push(`${label}.outputs must contain at least one output identity when COMPLETED`);
    return;
  }
  const seenActors = new Set();
  for (const [index, output] of outputs.entries()) {
    const outputLabel = `${label}.outputs[${index}]`;
    if (!isPlainObject(output)) {
      errors.push(`${outputLabel} must be an object`);
      continue;
    }
    rejectUnknownKeys(output, new Set(["actor_id", "raw_output_sha256", "relative_path"]), outputLabel, errors);
    validateBoundedIdentifier(output.actor_id, `${outputLabel}.actor_id`, errors);
    if (seenActors.has(output.actor_id)) errors.push(`${outputLabel}.actor_id is duplicated within the arm`);
    seenActors.add(output.actor_id);
    if (!isSha256(output.raw_output_sha256)) errors.push(`${outputLabel}.raw_output_sha256 must be a SHA-256 digest`);
    if (!isSafeOperatorOutputPath(output.relative_path)) {
      errors.push(`${outputLabel}.relative_path must stay under output/agent-orchestra/`);
    }
  }
  if (!sameStringSet([...seenActors], executionRoleIds)) {
    errors.push(`${label}.outputs.actor_id must exactly match routing.execution_role_ids`);
  }
}

function validateMeasurements(
  measurements,
  label,
  errors,
  nonPromotableReasons,
  { requireInvocation = true, requireInterruption = false } = {},
) {
  if (!isPlainObject(measurements)) {
    errors.push(`${label}.measurements must be an object when COMPLETED`);
    return;
  }
  rejectUnknownKeys(measurements, new Set([
    "elapsed_ms",
    "invocation_count",
    "retry_count",
    "interruption_count",
    "usage",
  ]), `${label}.measurements`, errors);
  for (const key of ["invocation_count", "retry_count", "interruption_count"]) {
    if (!isNonNegativeInteger(measurements[key])) errors.push(`${label}.measurements.${key} must be a non-negative integer`);
  }
  if (requireInvocation && measurements.invocation_count === 0) {
    errors.push(`${label}.measurements.invocation_count must be at least 1 when COMPLETED`);
  }
  if (requireInterruption && measurements.interruption_count === 0) {
    errors.push(`${label}.measurements.interruption_count must be at least 1 when INTERRUPTED`);
  }
  if (measurements.elapsed_ms === "UNAVAILABLE") {
    nonPromotableReasons.add("ELAPSED_TIME_UNAVAILABLE");
  } else if (!isNonNegativeInteger(measurements.elapsed_ms)) {
    errors.push(`${label}.measurements.elapsed_ms must be a non-negative integer or UNAVAILABLE`);
  }
  if (!isPlainObject(measurements.usage)) {
    errors.push(`${label}.measurements.usage must be an object`);
    return;
  }
  rejectUnknownKeys(measurements.usage, new Set(REQUIRED_USAGE_KEYS), `${label}.measurements.usage`, errors);
  for (const key of REQUIRED_USAGE_KEYS) {
    const value = measurements.usage[key];
    if (value === "UNAVAILABLE") {
      nonPromotableReasons.add("USAGE_COUNTERS_UNAVAILABLE");
      continue;
    }
    if (!isNonNegativeInteger(value)) errors.push(`${label}.measurements.usage.${key} must be a non-negative integer or UNAVAILABLE`);
  }
}

function validateReview(review, label, errors, nonPromotableReasons) {
  if (!isPlainObject(review)) {
    errors.push(`${label}.review must be an object when COMPLETED`);
    return;
  }
  rejectUnknownKeys(review, new Set([
    "critical_miss_ids",
    "forbidden_outcome_ids",
    "evidence_coverage",
    "reviewer_status",
    "holdout_status",
    "conflicts",
  ]), `${label}.review`, errors);
  for (const key of ["critical_miss_ids", "forbidden_outcome_ids", "conflicts"]) {
    if (!isUniqueStringArray(review[key])) errors.push(`${label}.review.${key} must be a unique string array`);
  }
  if (!isPlainObject(review.evidence_coverage)) {
    errors.push(`${label}.review.evidence_coverage must be an object`);
  } else {
    rejectUnknownKeys(review.evidence_coverage, new Set(["required", "verified", "unverified"]), `${label}.review.evidence_coverage`, errors);
    for (const key of ["required", "verified", "unverified"]) {
      if (!isNonNegativeInteger(review.evidence_coverage[key])) errors.push(`${label}.review.evidence_coverage.${key} must be a non-negative integer`);
    }
    if (isNonNegativeInteger(review.evidence_coverage.required) && isNonNegativeInteger(review.evidence_coverage.verified) && isNonNegativeInteger(review.evidence_coverage.unverified) && review.evidence_coverage.verified + review.evidence_coverage.unverified !== review.evidence_coverage.required) {
      errors.push(`${label}.review.evidence_coverage must partition required evidence`);
    }
  }
  if (!REVIEWER_STATUSES.has(review.reviewer_status)) errors.push(`${label}.review.reviewer_status must be UNVERIFIED or VERIFIED`);
  if (review.reviewer_status !== "VERIFIED") nonPromotableReasons.add("QUALIFIED_HUMAN_REVIEW_UNAVAILABLE");
  if (!HOLDOUT_STATUSES.has(review.holdout_status)) errors.push(`${label}.review.holdout_status must be UNAVAILABLE or VERIFIED`);
  if (review.holdout_status !== "VERIFIED") nonPromotableReasons.add("NO_OWNER_CONTROLLED_HOLDOUT");
  if (Array.isArray(review.critical_miss_ids) && review.critical_miss_ids.length > 0) nonPromotableReasons.add("CRITICAL_MISS_PRESENT");
  if (Array.isArray(review.forbidden_outcome_ids) && review.forbidden_outcome_ids.length > 0) nonPromotableReasons.add("FORBIDDEN_OUTCOME_PRESENT");
  if (Array.isArray(review.conflicts) && review.conflicts.length > 0) nonPromotableReasons.add("UNRESOLVED_CONFLICT_PRESENT");
}

function validateDecision({ decision, reportStatus, armById, errors, nonPromotableReasons }) {
  if (!isPlainObject(decision)) {
    errors.push("report.decision must be an object");
    return;
  }
  rejectUnknownKeys(decision, new Set(["status", "reason_codes"]), "report.decision", errors);
  if (!DECISION_STATUSES.has(decision.status)) errors.push("report.decision.status must be PILOT_NONPROMOTABLE or PROMOTABLE");
  if (!isUniqueStringArray(decision.reason_codes)) errors.push("report.decision.reason_codes must be a unique string array");
  const reasonCodes = Array.isArray(decision.reason_codes) ? new Set(decision.reason_codes) : new Set();

  if (reportStatus === PREPARED_REPORT_STATUS) {
    if (decision.status !== "PILOT_NONPROMOTABLE" || !reasonCodes.has("PREPARED_NOT_EXECUTED")) {
      errors.push("PREPARED report must be PILOT_NONPROMOTABLE with PREPARED_NOT_EXECUTED");
    }
    return;
  }
  if (reportStatus === INTERRUPTED_REPORT_STATUS) {
    if (
      decision.status !== "PILOT_NONPROMOTABLE" ||
      !reasonCodes.has("PILOT_INTERRUPTED") ||
      !reasonCodes.has("ARM_INTERRUPTED")
    ) {
      errors.push("PILOT_INTERRUPTED report must be PILOT_NONPROMOTABLE with PILOT_INTERRUPTED and ARM_INTERRUPTED");
    }
  }
  if (decision.status === "PILOT_NONPROMOTABLE") {
    for (const reason of nonPromotableReasons) {
      if (!reasonCodes.has(reason)) errors.push(`PILOT_NONPROMOTABLE decision must include observed reason ${reason}`);
    }
    return;
  }
  if (decision.status === "PROMOTABLE") {
    if (nonPromotableReasons.has("USAGE_COUNTERS_UNAVAILABLE")) {
      errors.push("PROMOTABLE requires every usage counter to be available");
    }
    if (nonPromotableReasons.size > 0) {
      errors.push(`PROMOTABLE is blocked by: ${[...nonPromotableReasons].sort().join(", ")}`);
    }
    for (const arm of armById.values()) {
      if (arm?.review?.critical_miss_ids?.length > 0) errors.push("PROMOTABLE requires no critical misses");
    }
    errors.push("local evaluator cannot return PROMOTABLE; authenticated external promotion evidence is required");
  }
}

function validateTaskSlice(taskSlice, errors) {
  if (!isPlainObject(taskSlice)) {
    errors.push("report.task_slice must be an object");
    return null;
  }
  rejectUnknownKeys(taskSlice, new Set([
    "id",
    "title",
    "prompt",
    "sha256",
    "evidence_locators",
    "privacy_boundary",
  ]), "report.task_slice", errors);
  validateBoundedIdentifier(taskSlice.id, "report.task_slice.id", errors);
  validateBoundedText(taskSlice.title, "report.task_slice.title", errors, 3, 240);
  validateBoundedText(taskSlice.prompt, "report.task_slice.prompt", errors, 20, 12000);
  const hasSha256 = isSha256(taskSlice.sha256);
  if (!hasSha256) errors.push("report.task_slice.sha256 must be a SHA-256 digest");
  const hasEvidenceLocators = isNonEmptyStringArray(taskSlice.evidence_locators);
  if (!hasEvidenceLocators) errors.push("report.task_slice.evidence_locators must be non-empty");
  if (taskSlice.privacy_boundary !== "NO_PERSONAL_OR_PRODUCTION_DATA") {
    errors.push("report.task_slice.privacy_boundary must be NO_PERSONAL_OR_PRODUCTION_DATA");
  }
  const canRecompute =
    typeof taskSlice.id === "string" &&
    typeof taskSlice.title === "string" &&
    typeof taskSlice.prompt === "string" &&
    hasEvidenceLocators &&
    taskSlice.privacy_boundary === "NO_PERSONAL_OR_PRODUCTION_DATA";
  if (!canRecompute) return hasSha256 ? taskSlice.sha256 : null;
  const recomputed = calculateTaskSliceSha256(taskSlice);
  if (hasSha256 && taskSlice.sha256 !== recomputed) {
    errors.push("report.task_slice.sha256 must match retained task fields");
  }
  return recomputed;
}

function validateSharedConditions(conditions, errors) {
  if (!isPlainObject(conditions)) {
    errors.push("report.shared_conditions must be an object");
    return null;
  }
  rejectUnknownKeys(conditions, new Set([...REQUIRED_CONDITION_KEYS, "execution_order"]), "report.shared_conditions", errors);
  for (const key of REQUIRED_CONDITION_KEYS) {
    if (!isSha256(conditions[key])) errors.push(`report.shared_conditions.${key} must be a SHA-256 digest`);
  }
  return conditions;
}

function validateArmConditions(conditions, sharedConditions, label, errors) {
  if (!isPlainObject(conditions)) {
    errors.push(`${label}.shared_conditions must be an object`);
    return;
  }
  rejectUnknownKeys(conditions, new Set(REQUIRED_CONDITION_KEYS), `${label}.shared_conditions`, errors);
  for (const key of REQUIRED_CONDITION_KEYS) {
    if (!isSha256(conditions[key])) errors.push(`${label}.shared_conditions.${key} must be a SHA-256 digest`);
    else if (sharedConditions && conditions[key] !== sharedConditions[key]) {
      errors.push(`${label}.shared_conditions.${key} must match report.shared_conditions.${key}`);
    }
  }
}

function validateRuntimeObservations(observations, errors, nonPromotableReasons) {
  if (!isPlainObject(observations)) {
    errors.push("report.runtime_observations must be an object");
    return;
  }
  rejectUnknownKeys(observations, new Set(["custom_profile_loading", "effective_permissions"]), "report.runtime_observations", errors);
  if (!new Set(["UNVERIFIED", "VERIFIED"]).has(observations.custom_profile_loading)) {
    errors.push("report.runtime_observations.custom_profile_loading must be UNVERIFIED or VERIFIED");
  }
  if (observations.custom_profile_loading !== "VERIFIED") nonPromotableReasons.add("CUSTOM_PROFILE_LOADING_UNVERIFIED");
  if (!new Set(["UNVERIFIED", "VERIFIED"]).has(observations.effective_permissions)) {
    errors.push("report.runtime_observations.effective_permissions must be UNVERIFIED or VERIFIED");
  }
  if (observations.effective_permissions !== "VERIFIED") {
    nonPromotableReasons.add("EFFECTIVE_PERMISSIONS_UNVERIFIED");
  }
}

function validateRoleIdSnapshot(roleIds, canonicalRoleIds, errors) {
  if (!sameStringSet(roleIds, canonicalRoleIds)) {
    errors.push("report.canonical_role_ids must exactly match the supplied canonical registry roles");
  }
}

function validateLimitations(limitations, errors) {
  if (!isNonEmptyStringArray(limitations)) errors.push("report.limitations must be a non-empty string array");
}

function validateExecutionOrder(executionOrder, errors) {
  if (!sameStringSet(executionOrder, ROUTING_AB_ARMS)) {
    errors.push("report.shared_conditions.execution_order must be a permutation of the three required arms");
  }
}

function validateNoDuplicateOutputHashes(armById, errors) {
  const seen = new Map();
  for (const [armId, arm] of armById.entries()) {
    if (!Array.isArray(arm?.outputs)) continue;
    for (const output of arm.outputs) {
      const hash = output?.raw_output_sha256;
      if (!isSha256(hash)) continue;
      const priorArmId = seen.get(hash);
      if (priorArmId !== undefined) {
        errors.push(`duplicate raw_output_sha256 across comparison output identities: ${priorArmId} and ${armId}`);
      }
      seen.set(hash, armId);
    }
  }
}

function normalizeTaskSlice(taskSlice) {
  const errors = [];
  const sha256 = validateTaskSlice(taskSlice, errors);
  if (errors.length > 0 || !sha256) throw new Error(errors.join("; "));
  return {
    id: taskSlice.id,
    title: taskSlice.title,
    prompt: taskSlice.prompt,
    sha256,
    evidence_locators: [...taskSlice.evidence_locators].sort(),
    privacy_boundary: taskSlice.privacy_boundary,
  };
}

function normalizeSharedConditions(sharedConditions) {
  const errors = [];
  const conditions = validateSharedConditions({ ...sharedConditions, execution_order: ROUTING_AB_ARMS }, errors);
  if (errors.length > 0 || !conditions) throw new Error(errors.join("; "));
  return Object.fromEntries(REQUIRED_CONDITION_KEYS.map((key) => [key, conditions[key]]));
}

function requireCanonicalRoleIds(roleIds) {
  const errors = [];
  const canonicalRoleIds = validateCanonicalRoleIds(roleIds, errors);
  if (errors.length > 0) throw new Error(errors.join("; "));
  return canonicalRoleIds;
}

function validateCanonicalRoleIds(roleIds, errors) {
  if (!isUniqueStringArray(roleIds) || roleIds.length !== 10) {
    errors.push("canonical role IDs must be exactly ten unique non-empty strings");
    return [];
  }
  return [...roleIds];
}

function shuffledArms(randomBytes) {
  const arms = [...ROUTING_AB_ARMS];
  for (let index = arms.length - 1; index > 0; index -= 1) {
    const bytes = randomBytes(4);
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
      throw new TypeError("randomBytes must return bytes");
    }
    if (bytes.length < 4) throw new Error("randomBytes must return at least four bytes");
    const random = Buffer.from(bytes).readUInt32BE(0);
    const swapIndex = random % (index + 1);
    [arms[index], arms[swapIndex]] = [arms[swapIndex], arms[index]];
  }
  return arms;
}

function toExactIsoTimestamp(value, label) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError(`${label} must be a valid Date`);
  return value.toISOString();
}

function isExactIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function requireBoundedIdentifier(value, label) {
  const errors = [];
  validateBoundedIdentifier(value, label, errors);
  if (errors.length > 0) throw new Error(errors.join("; "));
}

function validateBoundedIdentifier(value, label, errors) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,199}$/.test(value)) {
    errors.push(`${label} must be a 3-200 character identifier`);
  }
}

function validateBoundedText(value, label, errors, minimum, maximum) {
  if (typeof value !== "string" || value.trim().length < minimum || value.length > maximum) {
    errors.push(`${label} must be ${minimum}-${maximum} characters`);
  }
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isSafeOperatorOutputPath(value) {
  return typeof value === "string" && /^output\/agent-orchestra\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,239}\.md$/.test(value);
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isUniqueStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0) && new Set(value).size === value.length;
}

function isNonEmptyStringArray(value) {
  return isUniqueStringArray(value) && value.length > 0;
}

function sameStringSet(left, right) {
  return isUniqueStringArray(left) && isUniqueStringArray(right) && left.length === right.length && left.every((value) => right.includes(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function rejectUnknownKeys(value, allowed, label, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} contains unknown key ${key}`);
  }
}

function result(errors, warnings, nonPromotableReasons) {
  return {
    errors,
    warnings,
    non_promotable_reasons: [...nonPromotableReasons].sort(),
  };
}
