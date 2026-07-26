import { z } from "zod";

export const SUBJECT_IDS = Object.freeze(["baseline", "candidate"]);

const sha256 = z.string().regex(/^[a-f0-9]{64}$/, "must be a SHA-256 hash");
const subjectId = z.enum(SUBJECT_IDS);

const candidateProvenance = z
  .object({
    gitStatusSha256: sha256,
    trackedDiffSha256: sha256,
  })
  .strict();

export const ManifestSchema = z
  .object({
    subjectId,
    subjectSnapshotSha256: sha256,
    candidateProvenance: candidateProvenance.optional(),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (manifest.subjectId === "candidate" && !manifest.candidateProvenance) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "candidate provenance is required" });
    }
    if (manifest.subjectId === "baseline" && manifest.candidateProvenance) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline cannot carry candidate provenance" });
    }
  });

export const EvidenceSchema = z
  .object({
    evidenceId: z.string().min(1),
    subjectId,
    locator: z.string().min(1),
  })
  .strict();

export const CapabilitySchema = z
  .object({
    capabilityId: z.string().min(1),
    subjectId,
    evidenceId: z.string().min(1),
    disposition: z.enum(["CLASSIFIED", "EXCLUDED", "UNRESOLVED"]),
  })
  .strict();

const findingStatus = z.enum(["OPEN", "VERIFIED", "RESOLVED", "REJECTED", "BLOCKED_UNVERIFIED"]);

export const FindingSchema = z
  .object({
    findingId: z.string().min(1),
    subjectId,
    capabilityId: z.string().min(1),
    transitions: z.array(z.object({ from: findingStatus, to: findingStatus }).strict()).min(1),
  })
  .strict();

export const AuditBundleSchema = z
  .object({
    manifests: z.array(ManifestSchema).length(2),
    evidence: z.array(EvidenceSchema),
    capabilities: z.array(CapabilitySchema),
    findings: z.array(FindingSchema),
  })
  .strict();
