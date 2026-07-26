import { z } from "zod";

export const SUBJECT_IDS = Object.freeze(["production-baseline", "candidate"]);
export const PLATFORM_RESULTS = Object.freeze(["PASS", "FAIL", "N/A", "UNVERIFIED"]);
export const AUDIT_PLATFORMS = Object.freeze([
  "WEB",
  "PWA",
  "ANDROID",
  "IOS",
  "DESKTOP",
  "STORE_RELEASE",
  "ACCESSIBILITY",
  "PERFORMANCE",
  "SECURITY_PRIVACY",
  "TESTING",
  "OPERATIONS",
]);
export const AUDIT_LOCALES = Object.freeze(["en", "uk", "es", "de", "fr", "ja", "ar", "he"]);
export const DEVICE_SCOPES = Object.freeze([
  "REPOSITORY_ONLY",
  "NOT_APPLICABLE",
  "DESKTOP_BROWSER",
  "MOBILE_BROWSER",
  "ANDROID_EMULATOR",
  "ANDROID_DEVICE",
  "IOS_SIMULATOR",
  "IOS_DEVICE",
  "DESKTOP_TAURI",
]);
export const ACCOUNT_COHORTS = Object.freeze([
  "ANONYMOUS",
  "GUEST",
  "AUTHENTICATED_SYNTHETIC",
  "DEDICATED_SYNC_SMOKE",
  "NOT_APPLICABLE",
]);
export const ROLE_IDS = Object.freeze([
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
]);
export const EVIDENCE_CLASSES = Object.freeze([
  "DIRECT_LOCAL",
  "DIRECT_RUNTIME",
  "AUTHORITATIVE_EXTERNAL",
  "HUMAN_RESEARCH",
  "INFERENCE",
  "UNKNOWN",
]);
export const EVIDENCE_TYPES = Object.freeze([
  "SOURCE_INSPECTION",
  "COMMAND_OUTPUT",
  "TEST_RESULT",
  "RUNTIME_TRACE",
  "SCREENSHOT",
  "SECURITY_SCAN",
  "AUTHORITATIVE_DOCUMENT",
  "HUMAN_RESEARCH_RECEIPT",
]);
export const REACHABILITY = Object.freeze([
  "SHIPPED_REACHABLE",
  "SHIPPED_BUT_HIDDEN_OR_BROKEN",
  "FEATURE_FLAGGED",
  "LEGACY_COMPATIBILITY",
  "INTERNAL_OR_DEBUG",
  "DEAD_OR_UNREACHABLE",
  "UNVERIFIED",
  "BACKGROUND_OR_PROVIDER_ONLY",
  "EXTERNAL_PROMISE_ONLY",
]);
export const CAPABILITY_ROLES = Object.freeze([
  "CORE_FREQUENT",
  "CORE_INFREQUENT",
  "SUPPORT_OR_RECOVERY",
  "TRUST_SAFETY_PRIVACY",
  "ACCESSIBILITY",
  "PERSONALIZATION",
  "ADVANCED_POWER_USER",
  "DELIGHT_OR_IDENTITY",
  "EXPERIMENTAL",
  "INTERNAL_ONLY",
]);
export const PRODUCT_DISPOSITIONS = Object.freeze([
  "KEEP",
  "KEEP_CRITICAL_RARE",
  "KEEP_AND_POLISH",
  "RENAME_OR_REFRAME",
  "SIMPLIFY",
  "MERGE",
  "SPLIT_CONCEPTS",
  "MOVE_TO_CONTEXT",
  "MOVE_TO_SYSTEM_SETTINGS",
  "REPLACE_WITH_SMART_DEFAULT",
  "PROGRESSIVE_DISCLOSURE",
  "INSTRUMENT_OR_TEST",
  "DEPRECATE_SAFELY",
  "REMOVE",
  "BLOCKED_UNVERIFIED",
]);

const sha256 = z.string().regex(/^[a-f0-9]{64}$/, "must be a SHA-256 hash");
const sha1Oid = z.string().regex(/^[a-f0-9]{40}$/, "must be a 40-hex Git SHA-1 object ID");
const sha256Oid = z.string().regex(/^[a-f0-9]{64}$/, "must be a 64-hex Git SHA-256 object ID");
const subjectId = z.enum(SUBJECT_IDS);
const platformResult = z.enum(PLATFORM_RESULTS);
const nonBlank = z
  .string()
  .min(1)
  .refine((value) => value === value.trim() && value.length > 0, "must be nonblank and trimmed");
const recordId = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9._:-]{0,127})$/i, "must be a safe single-line identifier");
const roleId = recordId.refine((value) => ROLE_IDS.includes(value), "must be a canonical role identifier");
const nonEmptyList = z.array(nonBlank).min(1);
const repositoryRelativePath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.startsWith("\\") &&
      !/^[a-z]:/i.test(value) &&
      !value.includes("\\") &&
      !value.includes("\u0000") &&
      value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    "must be a normalized repository-relative path",
  );

const gitRevision = z.discriminatedUnion("oidAlgorithm", [
  z.object({ oidAlgorithm: z.literal("sha1"), commitOid: sha1Oid }).strict(),
  z.object({ oidAlgorithm: z.literal("sha256"), commitOid: sha256Oid }).strict(),
]);

const repositoryProvenance = z
  .discriminatedUnion("oidAlgorithm", [
    z
      .object({
        oidAlgorithm: z.literal("sha1"),
        commitOid: sha1Oid,
        treeOid: sha1Oid,
        gitStatusSha256: sha256.optional(),
        trackedDiffSha256: sha256.optional(),
        sanitizedUntrackedManifestSha256: sha256.optional(),
        privacyScanReceiptSha256: sha256.optional(),
        candidateSnapshotSha256: sha256.optional(),
      })
      .strict(),
    z
      .object({
        oidAlgorithm: z.literal("sha256"),
        commitOid: sha256Oid,
        treeOid: sha256Oid,
        gitStatusSha256: sha256.optional(),
        trackedDiffSha256: sha256.optional(),
        sanitizedUntrackedManifestSha256: sha256.optional(),
        privacyScanReceiptSha256: sha256.optional(),
        candidateSnapshotSha256: sha256.optional(),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    const candidateFields = [
      "gitStatusSha256",
      "trackedDiffSha256",
      "sanitizedUntrackedManifestSha256",
      "privacyScanReceiptSha256",
      "candidateSnapshotSha256",
    ];
    const present = candidateFields.filter((field) => value[field] !== undefined);
    if (present.length !== 0 && present.length !== candidateFields.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "candidate provenance requires status, diff, sanitized-untracked, privacy-scan, and snapshot hashes together",
      });
    }
  });

const buildStage = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PASS"), artifactSha256: sha256, evidenceId: recordId }).strict(),
  z.object({ status: z.literal("FAIL"), reason: z.string().min(1), artifactSha256: sha256.optional() }).strict(),
  z.object({ status: z.literal("N/A"), reason: z.string().min(1) }).strict(),
  z.object({ status: z.literal("UNVERIFIED"), reason: z.string().min(1) }).strict(),
]);

const deployStage = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("PASS"),
      artifactSha256: sha256,
      publicUrl: z.string().url(),
      deployedRevision: gitRevision,
      evidenceId: recordId,
    })
    .strict(),
  z.object({ status: z.literal("FAIL"), reason: z.string().min(1), artifactSha256: sha256.optional() }).strict(),
  z.object({ status: z.literal("N/A"), reason: z.string().min(1) }).strict(),
  z.object({ status: z.literal("UNVERIFIED"), reason: z.string().min(1) }).strict(),
]);

const subjectProvenance = z
  .object({ subjectId, repository: repositoryProvenance, build: buildStage, deploy: deployStage })
  .strict()
  .superRefine((value, context) => {
    const candidateFieldsPresent = value.repository.gitStatusSha256 !== undefined;
    if (value.subjectId === "candidate" && !candidateFieldsPresent) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "candidate requires sanitized candidate provenance" });
    }
    if (value.subjectId === "production-baseline" && candidateFieldsPresent) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "production baseline cannot carry candidate-only provenance" });
    }
    if (value.subjectId === "production-baseline" && value.deploy.status !== "PASS") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "production baseline requires deployed-public provenance" });
    }
  });

export const AuditManifestSchema = z
  .object({
    runId: recordId,
    schemaVersion: z.literal("1.0.0"),
    requestSha256: sha256,
    policySha256: sha256,
    toolInventorySha256: sha256,
    sourceLedgerSha256: sha256,
    redactionRules: z
      .array(z.enum(["NO_RAW_SENSITIVE_PAYLOADS", "HASH_IDENTIFIERS"]))
      .min(1),
    subjects: z.array(subjectProvenance).length(2),
    roleReceipts: z
      .array(
        z
          .object({
            roleId,
            phase: z.enum(["INITIAL", "PASS_A", "PASS_B", "INTEGRATION"]),
            subjectIds: z.array(subjectId).min(1),
            verdict: z.enum(["GO", "STOP", "ASK"]),
            receiptSha256: sha256,
          })
          .strict(),
      )
      .length(12),
  })
  .strict();

const evidenceLocator = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("REPOSITORY_SOURCE"),
      path: repositoryRelativePath,
      revision: gitRevision,
      candidateSnapshotSha256: sha256.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("LOCAL_ARTIFACT"), path: repositoryRelativePath }).strict(),
  z.object({ kind: z.literal("AUTHORITATIVE_URL"), url: z.string().url() }).strict(),
  z.object({ kind: z.literal("HUMAN_RECEIPT"), receiptId: recordId }).strict(),
  z
    .object({
      kind: z.literal("UNVERIFIABLE_REFERENCE"),
      value: z.string().min(1),
      reason: z.string().min(1),
    })
    .strict(),
]);

export const EvidenceSchema = z
  .object({
    evidenceId: recordId,
    subjectId,
    evidenceClass: z.enum(EVIDENCE_CLASSES),
    evidenceType: z.enum(EVIDENCE_TYPES),
    locator: evidenceLocator,
    observedAt: z.string().datetime(),
    tool: z.object({ name: z.string().min(1), version: z.string().min(1) }).strict(),
    scope: z
      .object({
        platforms: z.array(z.enum(AUDIT_PLATFORMS)).min(1),
        deviceScope: z.enum(DEVICE_SCOPES),
        accountCohort: z.enum(ACCOUNT_COHORTS),
      })
      .strict(),
    result: platformResult,
    artifactSha256: sha256,
    privacyClass: z.enum(["PUBLIC", "REDACTED_METADATA", "SENSITIVE_NOT_CAPTURED"]),
    invalidationTriggers: nonEmptyList,
  })
  .strict();

const traceNode = z
  .object({
    kind: z.enum(["ENTRYPOINT", "ROUTE", "SOURCE", "COMPONENT", "PROVIDER", "STORAGE", "EXTERNAL"]),
    locator: nonBlank,
    evidenceId: recordId,
  })
  .strict();

const blocker = z.object({ summary: nonBlank, owner: nonBlank }).strict();

export const CapabilitySchema = z
  .object({
    capabilityId: recordId,
    subjectId,
    reachability: z.enum(REACHABILITY),
    capabilityRole: z.enum(CAPABILITY_ROLES),
    productDisposition: z.enum(PRODUCT_DISPOSITIONS),
    blocker: blocker.optional(),
    userJob: z.string().min(1),
    userRole: z.string().min(1),
    surfaces: nonEmptyList,
    platforms: z.array(z.enum(AUDIT_PLATFORMS)).min(1),
    locales: z.array(z.enum(AUDIT_LOCALES)).min(1),
    cohorts: nonEmptyList,
    trace: z.array(traceNode).min(1),
    permissions: nonEmptyList,
    dataActions: z
      .array(
        z.enum([
          "NONE",
          "READ_LOCAL",
          "WRITE_LOCAL",
          "SYNC_REMOTE",
          "EXPORT",
          "ANALYTICS",
          "ADVERTISING",
          "AI_PROCESSING",
        ]),
      )
      .min(1),
    dependencies: nonEmptyList,
    promises: nonEmptyList,
    evidenceIds: nonEmptyList,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.productDisposition === "BLOCKED_UNVERIFIED" && !value.blocker) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocker"], message: "BLOCKED_UNVERIFIED requires blocker and owner" });
    }
    if (value.productDisposition !== "BLOCKED_UNVERIFIED" && value.blocker) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocker"], message: "blocker is only valid for BLOCKED_UNVERIFIED" });
    }
  });

const decisionOption = z
  .object({
    optionId: recordId,
    disposition: z.enum(PRODUCT_DISPOSITIONS),
    description: z.string().min(1),
  })
  .strict();

export const DecisionSchema = z
  .object({
    decisionId: recordId,
    subjectId,
    capabilityId: recordId,
    observation: z.string().min(1),
    hypothesis: z.string().min(1),
    options: z.array(decisionOption).min(2),
    selectedDecision: z
      .object({
        optionId: recordId,
        disposition: z.enum(PRODUCT_DISPOSITIONS),
        rationale: z.string().min(1),
      })
      .strict(),
    blocker: blocker.optional(),
    rejectedAlternatives: z
      .array(z.object({ optionId: recordId, reason: nonBlank }).strict())
      .min(1),
    priority: z.enum(["P0", "P1", "P2", "P3"]),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
    hardGates: nonEmptyList,
    owner: nonBlank,
    affectedCohorts: nonEmptyList,
    acceptanceCriteria: nonEmptyList,
    killCriteria: nonEmptyList,
    rollbackCriteria: nonEmptyList,
    metrics: z
      .array(z.object({ metricId: recordId, target: nonBlank }).strict())
      .min(1),
    tradeOffs: nonEmptyList,
    evidenceIds: nonEmptyList,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.selectedDecision.disposition === "BLOCKED_UNVERIFIED" && !value.blocker) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocker"], message: "BLOCKED_UNVERIFIED requires decision blocker and owner" });
    }
    if (value.selectedDecision.disposition !== "BLOCKED_UNVERIFIED" && value.blocker) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocker"], message: "decision blocker is only valid for BLOCKED_UNVERIFIED" });
    }
  });

const historyState = z.enum([
  "DISCOVERED",
  "TRIAGED",
  "DECIDED",
  "IMPLEMENTING",
  "VERIFIED",
  "REJECTED",
  "BLOCKED",
  "ROLLED_BACK",
]);

export const FindingHistorySchema = z
  .object({
    findingId: recordId,
    subjectId,
    capabilityId: recordId,
    decisionId: recordId,
    events: z
      .array(
        z
          .object({
            sequence: z.number().int().nonnegative(),
            state: historyState,
            observedAt: z.string().datetime(),
            evidenceIds: nonEmptyList,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const AuditBundleSchema = z
  .object({
    manifest: AuditManifestSchema,
    evidence: z.array(EvidenceSchema).min(1),
    capabilities: z.array(CapabilitySchema).min(1),
    decisions: z.array(DecisionSchema).min(1),
    findingHistory: z.array(FindingHistorySchema).min(1),
  })
  .strict();
