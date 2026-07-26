import { z } from "zod";

export const SUBJECT_IDS = Object.freeze(["baseline", "candidate"]);
export const REACHABILITY = Object.freeze(["REACHABLE", "UNREACHABLE", "UNKNOWN"]);
export const CAPABILITY_DISPOSITIONS = Object.freeze([
  "IN_SCOPE",
  "EXCLUDED_WITH_EVIDENCE",
  "UNRESOLVED_CANDIDATE",
]);

const sha256 = z.string().regex(/^[a-f0-9]{64}$/, "must be a SHA-256 hash");
const subjectId = z.enum(SUBJECT_IDS);
const provenanceStage = z.object({ status: z.enum(["PASS", "FAIL", "UNVERIFIED", "NOT_ATTEMPTED"]), artifactSha256: sha256 }).strict();
const repository = z
  .object({
    commitSha256: sha256,
    treeSha256: sha256,
    gitStatusSha256: sha256.optional(),
    trackedDiffSha256: sha256.optional(),
  })
  .strict();

const subjectProvenance = z
  .object({ subjectId, repository, build: provenanceStage, deploy: provenanceStage })
  .strict()
  .superRefine((value, context) => {
    const hasStatusHash = Boolean(value.repository.gitStatusSha256);
    const hasDiffHash = Boolean(value.repository.trackedDiffSha256);
    if (value.subjectId === "candidate" && (!hasStatusHash || !hasDiffHash)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "candidate requires status and tracked-diff hashes" });
    }
    if (value.subjectId === "baseline" && (hasStatusHash || hasDiffHash)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline cannot carry candidate-only provenance" });
    }
  });

export const AuditManifestSchema = z
  .object({
    runId: z.string().min(1),
    schemaVersion: z.literal("1.0.0"),
    requestSha256: sha256,
    policySha256: sha256,
    toolInventorySha256: sha256,
    sourceLedgerSha256: sha256,
    redactionRules: z.array(z.enum(["NO_RAW_SENSITIVE_DATA", "HASH_ONLY_PROVENANCE"])).min(1),
    subjects: z.array(subjectProvenance).length(2),
    roleReceipts: z.array(z.object({ roleId: z.string().min(1), subjectId, receiptSha256: sha256 }).strict()),
  })
  .strict();

export const EvidenceSchema = z
  .object({
    evidenceId: z.string().min(1),
    subjectId,
    evidenceClass: z.enum(["SOURCE", "RUNTIME", "TEST", "SECURITY", "RELEASE"]),
    evidenceType: z.string().min(1),
    observedAt: z.string().datetime(),
    tool: z.object({ name: z.string().min(1), version: z.string().min(1) }).strict(),
    scope: z.object({ platforms: z.array(z.string().min(1)).min(1), deviceScope: z.string().min(1) }).strict(),
    result: z.enum(["PASS", "FAIL", "UNVERIFIED", "NOT_APPLICABLE"]),
    artifactSha256: sha256,
    privacyClass: z.enum(["METADATA_ONLY", "REDACTED", "PUBLIC_ARTIFACT"]),
    invalidatesOn: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const CapabilitySchema = z
  .object({
    capabilityId: z.string().min(1),
    subjectId,
    evidenceId: z.string().min(1),
    reachability: z.enum(REACHABILITY),
    disposition: z.enum(CAPABILITY_DISPOSITIONS),
    userJob: z.string().min(1),
    userRole: z.string().min(1),
    surfaces: z.array(z.string().min(1)).min(1),
    platforms: z.array(z.string().min(1)).min(1),
    locales: z.array(z.string().min(1)).min(1),
    cohorts: z.array(z.string().min(1)).min(1),
    trace: z.array(z.string().min(1)).min(1),
    permissions: z.array(z.string().min(1)).min(1),
    dataActions: z.array(z.string().min(1)).min(1),
    dependencies: z.array(z.string().min(1)).min(1),
    promises: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const DecisionSchema = z
  .object({
    decisionId: z.string().min(1),
    subjectId,
    capabilityId: z.string().min(1),
    evidenceId: z.string().min(1),
    disposition: z.enum(["APPROVED", "REJECTED", "DEFERRED_UNVERIFIED", "ESCALATED"]),
    rationale: z.string().min(1),
  })
  .strict();

const findingState = z.enum(["START", "DISCOVERED", "TRIAGED", "DECIDED", "IMPLEMENTING", "VERIFIED", "REJECTED", "BLOCKED", "ROLLED_BACK"]);

export const FindingHistorySchema = z
  .object({
    findingId: z.string().min(1),
    subjectId,
    capabilityId: z.string().min(1),
    transitions: z.array(z.object({ from: findingState, to: findingState }).strict()).min(1),
  })
  .strict();

export const AuditBundleSchema = z
  .object({
    manifest: AuditManifestSchema,
    evidence: z.array(EvidenceSchema),
    capabilities: z.array(CapabilitySchema),
    decisions: z.array(DecisionSchema),
    findingHistory: z.array(FindingHistorySchema),
  })
  .strict();
