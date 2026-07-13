import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  detectDuplicateCandidateOutputs,
  parseStrictJson,
  validateCandidateEnvelope,
  validateEvalCatalog,
  validateRunReceipt,
} from "../persistent-agent-orchestra/eval-core.mjs";

const REPO_ROOT = process.cwd();
const FIXED_NOW = new Date("2026-07-13T05:00:00.000Z");

describe("persistent agent orchestra evidence boundary", () => {
  it("accepts the canonical scenario catalog and covers every role", async () => {
    const registry = await readJson("config/persistent-agent-orchestra.json");
    const catalog = await readJson("config/persistent-agent-orchestra.evals.json");

    const result = validateEvalCatalog(catalog, registry);

    expect(result.errors).toEqual([]);
    expect(catalog.scenarios.length).toBeGreaterThanOrEqual(32);
    expect(new Set(catalog.scenarios.map((scenario) => scenario.role_id)).size).toBe(10);
  });

  it("parses only plain JSON and rejects fenced or trailing content", () => {
    expect(parseStrictJson('{"status":"UNVERIFIED"}')).toEqual({ status: "UNVERIFIED" });
    expect(() => parseStrictJson('```json\n{"status":"UNVERIFIED"}\n```')).toThrow(/plain JSON/);
    expect(() => parseStrictJson('{"status":"UNVERIFIED"}\nexplanation')).toThrow(/valid JSON/);
  });

  it("does not let UNTRUSTED_PROJECT satisfy a trusted-project run", () => {
    const receipt = makeRunReceipt();
    receipt.project_trust = "UNTRUSTED_PROJECT";

    const result = validateRunReceipt(receipt, {
      now: FIXED_NOW,
      requireTrustedProject: true,
    });

    expect(result.errors.join("\n")).toContain("TRUSTED_PROJECT required");
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

  it("rejects a high-risk finding self-marked resolved", () => {
    const candidate = makeCandidate();
    candidate.findings[0].severity = "HIGH";
    candidate.findings[0].status = "RESOLVED";

    expect(validateCandidateEnvelope(candidate).errors.join("\n")).toContain(
      "candidate finding status",
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
});

function makeRunReceipt() {
  return {
    schema_version: 1,
    receipt_type: "RUNNER_PREPARATION",
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
    artifact_hashes: {
      registry: "a".repeat(64),
      catalog: "b".repeat(64),
      profiles: "c".repeat(64),
      protocol: "d".repeat(64),
    },
  };
}

function makeCandidate() {
  return {
    schema_version: 1,
    role_id: "psychology-human-factors-emotional-safety",
    scenario_id: "role02-feature-existence",
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
    platform_impact: ["AGENT_GOVERNANCE"],
    domain_impact: ["PRODUCT_DISCOVERY"],
    verification: ["Inspect the current route and run the bounded scenario."],
    unresolved_risks: ["Real user acceptance remains unknown."],
    self_reflection: "This conclusion is limited to supplied repository evidence.",
  };
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relativePath), "utf8"));
}
