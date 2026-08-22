import { describe, expect, it } from "vitest";

import {
  ROUTING_AB_ARMS,
  createPreparedRoutingAbReport,
  sha256Text,
  validateRoutingAbReport,
} from "../persistent-agent-orchestra/routing-ab-core.mjs";

const ROLE_IDS = [
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
const TASK_SLICE_CONTENT = {
  id: "governance-routing-value",
  title: "Evaluate ZenFlow agent roles, hooks, and rules",
  prompt: "Review the current governance surfaces and identify evidence-backed risks.",
  evidence_locators: ["AGENTS.md", "config/persistent-agent-orchestra.json"],
  privacy_boundary: "NO_PERSONAL_OR_PRODUCTION_DATA",
};
const DIGEST = sha256Text(stableJson(TASK_SLICE_CONTENT));
const OTHER_DIGEST = "b".repeat(64);
const NOW = new Date("2026-08-04T12:00:00.000Z");

function makePrepared() {
  return createPreparedRoutingAbReport({
    now: NOW,
    runId: "agent-routing-ab-2026-08-04",
    roleIds: ROLE_IDS,
    taskSlice: {
      ...TASK_SLICE_CONTENT,
      sha256: DIGEST,
    },
    sharedConditions: {
      artifact_snapshot_sha256: DIGEST,
      runtime_identity_sha256: DIGEST,
      tool_surface_sha256: DIGEST,
      budget_identity_sha256: DIGEST,
      rubric_sha256: DIGEST,
    },
    randomBytes: (size) => Buffer.alloc(size, 0),
  });
}

function completeArm(arm, index) {
  arm.status = "COMPLETED";
  arm.outputs = [];
  arm.measurements = {
    elapsed_ms: 100 + index,
    invocation_count: 1 + index,
    retry_count: 0,
    interruption_count: 0,
    usage: {
      request_count: "UNAVAILABLE",
      input_tokens: "UNAVAILABLE",
      cached_input_tokens: "UNAVAILABLE",
      cache_write_tokens: "UNAVAILABLE",
      output_tokens: "UNAVAILABLE",
      reasoning_tokens: "UNAVAILABLE",
    },
  };
  arm.review = {
    critical_miss_ids: [],
    forbidden_outcome_ids: [],
    evidence_coverage: { required: 3, verified: 2, unverified: 1 },
    reviewer_status: "UNVERIFIED",
    holdout_status: "UNAVAILABLE",
    conflicts: [],
  };
}

function setOutputsForActors(arm, actorIds) {
  arm.outputs = actorIds.map((actorId) => ({
    actor_id: actorId,
    raw_output_sha256: sha256Text(`${arm.arm_id}:${actorId}:controlled-output`),
    relative_path: `output/agent-orchestra/test-${arm.arm_id.toLowerCase()}-${actorId}.md`,
  }));
}

function makeCompletedPilot() {
  const report = makePrepared();
  report.status = "PILOT_COMPLETED";
  report.arms.forEach(completeArm);
  const targeted = report.arms.find((arm) => arm.arm_id === "TARGETED");
  targeted.routing.role_dispositions = ROLE_IDS.map((role_id) => ({
    role_id,
    disposition: [
      "coordinator-teamlead",
      "logic-causality-state-coherence",
      "security-privacy-agent-trust",
      "performance-reliability-operations",
      "qa-evidence-release-verification",
      "independent-blind-spot-sentinel",
    ].includes(role_id)
      ? "SELECTED"
      : "EXCLUDED",
    evidence_locators: ["AGENTS.md:Persistent Codex Agent Orchestra"],
  }));
  targeted.routing.execution_role_ids = targeted.routing.role_dispositions
    .filter((item) => item.disposition === "SELECTED")
    .map((item) => item.role_id);
  const fullTen = report.arms.find((arm) => arm.arm_id === "FIXED_FULL_TEN");
  fullTen.routing.execution_role_ids = [...ROLE_IDS];
  setOutputsForActors(report.arms.find((arm) => arm.arm_id === "ROOT_ONLY"), ["root"]);
  setOutputsForActors(targeted, targeted.routing.execution_role_ids);
  setOutputsForActors(fullTen, fullTen.routing.execution_role_ids);
  report.decision = {
    status: "PILOT_NONPROMOTABLE",
    reason_codes: [
      "NO_OWNER_CONTROLLED_HOLDOUT",
      "USAGE_COUNTERS_UNAVAILABLE",
      "QUALIFIED_HUMAN_REVIEW_UNAVAILABLE",
      "CUSTOM_PROFILE_LOADING_UNVERIFIED",
      "EFFECTIVE_PERMISSIONS_UNVERIFIED",
    ],
  };
  return report;
}

function makeInterruptedPilot() {
  const report = makeCompletedPilot();
  const interrupted = report.arms.find((arm) => arm.arm_id === "TARGETED");
  report.status = "PILOT_INTERRUPTED";
  interrupted.status = "INTERRUPTED";
  interrupted.outputs = [];
  interrupted.measurements = {
    elapsed_ms: 0,
    invocation_count: 0,
    retry_count: 0,
    interruption_count: 1,
    usage: {
      request_count: "UNAVAILABLE",
      input_tokens: "UNAVAILABLE",
      cached_input_tokens: "UNAVAILABLE",
      cache_write_tokens: "UNAVAILABLE",
      output_tokens: "UNAVAILABLE",
      reasoning_tokens: "UNAVAILABLE",
    },
  };
  interrupted.review = null;
  report.decision = {
    status: "PILOT_NONPROMOTABLE",
    reason_codes: [
      "PILOT_INTERRUPTED",
      "ARM_INTERRUPTED",
      "NO_OWNER_CONTROLLED_HOLDOUT",
      "USAGE_COUNTERS_UNAVAILABLE",
      "QUALIFIED_HUMAN_REVIEW_UNAVAILABLE",
      "CUSTOM_PROFILE_LOADING_UNVERIFIED",
      "EFFECTIVE_PERMISSIONS_UNVERIFIED",
    ],
  };
  return report;
}

describe("agent routing A/B/C evaluation", () => {
  it("prepares exactly the three required arms in a retained randomized permutation", () => {
    const report = makePrepared();

    expect(report.arms.map((arm) => arm.arm_id).sort()).toEqual([...ROUTING_AB_ARMS].sort());
    expect(report.shared_conditions.execution_order.sort()).toEqual([...ROUTING_AB_ARMS].sort());
    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors).toEqual([]);
  });

  it("rejects a completed comparison whose arm no longer has the same task identity", () => {
    const report = makeCompletedPilot();
    report.arms[1].task_slice_sha256 = OTHER_DIGEST;

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "task_slice_sha256 must match",
    );
  });

  it("rejects a retained task-slice digest after its current task content changes", () => {
    const report = makeCompletedPilot();
    report.task_slice.prompt += " The retained digest was not recomputed.";

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "task_slice.sha256 must match retained task fields",
    );
  });

  it("requires all ten role dispositions for the targeted arm", () => {
    const report = makeCompletedPilot();
    const targeted = report.arms.find((arm) => arm.arm_id === "TARGETED");
    targeted.routing.role_dispositions.pop();

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "must record exactly one disposition for every canonical role",
    );
  });

  it("requires all ten roles to execute in the fixed-full-ten arm", () => {
    const report = makeCompletedPilot();
    const fullTen = report.arms.find((arm) => arm.arm_id === "FIXED_FULL_TEN");
    fullTen.routing.execution_role_ids.pop();

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "must execute every canonical role exactly once",
    );
  });

  it("rejects duplicate raw-output identities across comparison arms", () => {
    const report = makeCompletedPilot();
    report.arms[1].outputs[0].raw_output_sha256 = report.arms[0].outputs[0].raw_output_sha256;

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "duplicate raw_output_sha256",
    );
  });

  it("rejects a duplicated raw-output identity within one arm", () => {
    const report = makeCompletedPilot();
    report.arms[0].outputs.push({
      actor_id: "root-copy",
      raw_output_sha256: report.arms[0].outputs[0].raw_output_sha256,
      relative_path: "output/agent-orchestra/test-root-copy.md",
    });

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "duplicate raw_output_sha256",
    );
  });

  it("rejects a raw-output path that escapes the ignored operator directory", () => {
    const report = makeCompletedPilot();
    report.arms[0].outputs[0].relative_path = "specs/002-agent-routing-ab-eval/spec.md";

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "relative_path must stay under output/agent-orchestra/",
    );
  });

  it("rejects an output actor that is not declared for its comparison arm", () => {
    const report = makeCompletedPilot();
    report.arms[0].outputs[0].actor_id = "undeclared-actor";

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "outputs.actor_id must exactly match routing.execution_role_ids",
    );
  });

  it("rejects a completed arm with no recorded invocation", () => {
    const report = makeCompletedPilot();
    report.arms[0].measurements.invocation_count = 0;

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "measurements.invocation_count must be at least 1 when COMPLETED",
    );
  });

  it("keeps a user-cancelled comparison as a valid non-promotable terminal receipt", () => {
    const result = validateRoutingAbReport(makeInterruptedPilot(), { roleIds: ROLE_IDS });

    expect(result.errors).toEqual([]);
    expect(result.non_promotable_reasons).toEqual(expect.arrayContaining([
      "PILOT_INTERRUPTED",
      "ARM_INTERRUPTED",
    ]));
  });

  it("rejects an interrupted terminal report that contains no interrupted arm", () => {
    const report = makeCompletedPilot();
    report.status = "PILOT_INTERRUPTED";
    report.decision.reason_codes.push("PILOT_INTERRUPTED", "ARM_INTERRUPTED");

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "PILOT_INTERRUPTED report requires at least one arm to be INTERRUPTED",
    );
  });

  it("does not present partial output or a final review as completed evidence after cancellation", () => {
    const report = makeInterruptedPilot();
    const interrupted = report.arms.find((arm) => arm.arm_id === "TARGETED");
    interrupted.outputs = [{
      actor_id: "coordinator-teamlead",
      raw_output_sha256: sha256Text("partial"),
      relative_path: "output/agent-orchestra/partial.md",
    }];
    interrupted.review = {
      critical_miss_ids: [],
      forbidden_outcome_ids: [],
      evidence_coverage: { required: 1, verified: 0, unverified: 1 },
      reviewer_status: "UNVERIFIED",
      holdout_status: "UNAVAILABLE",
      conflicts: [],
    };

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "outputs must be empty while INTERRUPTED",
    );
    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "review must be null while INTERRUPTED",
    );
  });

  it("preserves unavailable usage in a valid non-promotable visible-slice pilot", () => {
    const result = validateRoutingAbReport(makeCompletedPilot(), { roleIds: ROLE_IDS });

    expect(result.errors).toEqual([]);
    expect(result.non_promotable_reasons).toContain("USAGE_COUNTERS_UNAVAILABLE");
  });

  it("preserves an unavailable elapsed observation instead of inventing a duration", () => {
    const report = makeCompletedPilot();
    report.arms[0].measurements.elapsed_ms = "UNAVAILABLE";
    report.decision.reason_codes.push("ELAPSED_TIME_UNAVAILABLE");

    const result = validateRoutingAbReport(report, { roleIds: ROLE_IDS });

    expect(result.errors).toEqual([]);
    expect(result.non_promotable_reasons).toContain("ELAPSED_TIME_UNAVAILABLE");
  });

  it("rejects a promotion claim while any required usage counter is unavailable", () => {
    const report = makeCompletedPilot();
    report.decision.status = "PROMOTABLE";
    report.decision.reason_codes = [];

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "PROMOTABLE requires every usage counter",
    );
  });

  it("rejects a self-authored local PROMOTABLE claim even when every field says VERIFIED", () => {
    const report = makeCompletedPilot();
    report.runtime_observations = {
      custom_profile_loading: "VERIFIED",
      effective_permissions: "VERIFIED",
    };
    for (const arm of report.arms) {
      for (const usageKey of Object.keys(arm.measurements.usage)) {
        arm.measurements.usage[usageKey] = 1;
      }
      arm.review = {
        ...arm.review,
        evidence_coverage: { required: 3, verified: 3, unverified: 0 },
        reviewer_status: "VERIFIED",
        holdout_status: "VERIFIED",
      };
    }
    report.decision = { status: "PROMOTABLE", reason_codes: [] };

    expect(validateRoutingAbReport(report, { roleIds: ROLE_IDS }).errors.join("\n")).toContain(
      "local evaluator cannot return PROMOTABLE",
    );
  });
});

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
