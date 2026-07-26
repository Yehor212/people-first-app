import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { enumerateProductCoherenceInventory } from "../product-coherence/inventory-v2/index.mjs";
import {
  assertInventoryClosure,
  reconcileInventoryCandidates,
  reconcileInventorySet,
} from "../product-coherence/reconcile/index.mjs";

const EXPECTED_ENUMERATORS = [
  "navigation",
  "surfaces-orbs",
  "gates-providers-background",
  "state-storage-sync",
  "ai-ads-notifications",
  "native-platform",
  "i18n-public-claims",
  "tests-observability-recovery",
  "legacy-assets",
];

describe("ProductCoherenceInventory v2", () => {
  it("emits deterministic, subject-bound factual candidates for every required ZenFlow inventory family", async () => {
    const root = await createZenFlowFixture();
    try {
      const first = await enumerateProductCoherenceInventory({ rootDirectory: root, subjectId: "candidate" });
      const second = await enumerateProductCoherenceInventory({ rootDirectory: root, subjectId: "candidate" });

      expect(second).toEqual(first);
      expect(first.subjectId).toBe("candidate");
      expect([...new Set(first.candidates.map((candidate) => candidate.enumerator))].sort()).toEqual(
        [...EXPECTED_ENUMERATORS].sort(),
      );
      expect(first.candidates).toEqual(
        [...first.candidates].sort((left, right) => Buffer.compare(Buffer.from(left.candidateId), Buffer.from(right.candidateId))),
      );
      expect(first.candidates.every((candidate) => candidate.subjectId === "candidate")).toBe(true);
      expect(first.candidates.every((candidate) => candidate.candidateId.startsWith("pci2-"))).toBe(true);
      expect(first.candidates.every((candidate) => candidate.contentSnippet === undefined)).toBe(true);
      expect(JSON.stringify(first)).not.toMatch(/productDisposition|\bKEEP\b|\bREMOVE\b/);
      expect(first.summary.totalCandidates).toBe(first.candidates.length);
      expect(first.summary.byEnumerator.map((row) => row.enumerator)).toEqual(EXPECTED_ENUMERATORS);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("never follows a symlink or exposes secret-looking source content in inventory facts", async () => {
    const root = await createZenFlowFixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "product-coherence-inventory-v2-outside-"));
    try {
      await writeFile(path.join(root, ".env"), "API_TOKEN=sk-private-example-token\n");
      await writeFile(path.join(outside, "private.ts"), "const secret = 'sk-private-example-token';\n");
      await symlink(path.join(outside, "private.ts"), path.join(root, "src", "linked.ts"));

      const inventory = await enumerateProductCoherenceInventory({ rootDirectory: root, subjectId: "candidate" });
      const serialized = JSON.stringify(inventory);
      expect(inventory.candidates.some((candidate) => candidate.path === "src/linked.ts")).toBe(false);
      expect(serialized).not.toContain("sk-private-example-token");
      expect(serialized).not.toContain(".env");
    } finally {
      await Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]);
    }
  });

  it("requires every candidate to map exactly once to a same-subject capability or evidence-backed exclusion", async () => {
    const root = await createZenFlowFixture();
    try {
      const inventory = await enumerateProductCoherenceInventory({
        rootDirectory: root,
        subjectId: "production-baseline",
      });
      const [firstCandidate, ...remainingCandidates] = inventory.candidates;
      const input = {
        inventory,
        evidence: [{ subjectId: "production-baseline", evidenceId: "fixture-evidence" }],
        capabilities: [{ subjectId: "production-baseline", capabilityId: "navigation-shell" }],
        capabilityMappings: [
          {
            subjectId: "production-baseline",
            candidateId: firstCandidate.candidateId,
            capabilityId: "navigation-shell",
          },
        ],
        exclusions: remainingCandidates.map((candidate) => ({
          subjectId: "production-baseline",
          candidateId: candidate.candidateId,
          reason: "Fixture source is an enumeration probe, not a separately auditable product capability.",
          evidenceIds: ["fixture-evidence"],
        })),
      };

      const reconciliation = reconcileInventoryCandidates(input);
      expect(reconciliation.ok).toBe(true);
      expect(reconciliation.rows).toHaveLength(EXPECTED_ENUMERATORS.length);
      expect(reconciliation.rows.every((row) => row.unclassifiedCandidateCount === 0)).toBe(true);
      expect(() => assertInventoryClosure(reconciliation)).not.toThrow();

      const duplicate = reconcileInventoryCandidates({
        ...input,
        exclusions: [
          ...input.exclusions,
          {
            subjectId: "production-baseline",
            candidateId: firstCandidate.candidateId,
            reason: "A duplicate must never silently close the inventory.",
            evidenceIds: ["fixture-evidence"],
          },
        ],
      });
      expect(duplicate.ok).toBe(false);
      expect(duplicate.errors).toContain(`candidate ${firstCandidate.candidateId} is classified more than once`);

      const crossSubject = reconcileInventoryCandidates({
        ...input,
        capabilityMappings: [
          { ...input.capabilityMappings[0], subjectId: "candidate" },
        ],
      });
      expect(crossSubject.ok).toBe(false);
      expect(crossSubject.errors.join("\n")).toMatch(/same subject|candidate subject/i);

      const missingEvidence = reconcileInventoryCandidates({
        ...input,
        exclusions: input.exclusions.map((row, index) => (index === 0 ? { ...row, evidenceIds: [] } : row)),
      });
      expect(missingEvidence.ok).toBe(false);
      expect(missingEvidence.errors.join("\n")).toMatch(/evidence/i);

      const unknownEvidence = reconcileInventoryCandidates({
        ...input,
        evidence: [],
      });
      expect(unknownEvidence.ok).toBe(false);
      expect(unknownEvidence.errors.join("\n")).toMatch(/evidence.*fixture-evidence|fixture-evidence.*evidence/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps production-baseline and candidate reconciliation counts separate", async () => {
    const root = await createZenFlowFixture();
    try {
      const inventories = await Promise.all(
        ["production-baseline", "candidate"].map((subjectId) =>
          enumerateProductCoherenceInventory({ rootDirectory: root, subjectId }),
        ),
      );
      const result = reconcileInventorySet({
        inventories,
        capabilities: inventories.map((inventory) => ({
          subjectId: inventory.subjectId,
          capabilityId: `capability-${inventory.subjectId}`,
        })),
        evidence: inventories.map((inventory) => ({
          subjectId: inventory.subjectId,
          evidenceId: `evidence-${inventory.subjectId}`,
        })),
        capabilityMappings: inventories.map((inventory) => ({
          subjectId: inventory.subjectId,
          candidateId: inventory.candidates[0].candidateId,
          capabilityId: `capability-${inventory.subjectId}`,
        })),
        exclusions: inventories.flatMap((inventory) =>
          inventory.candidates.slice(1).map((candidate) => ({
            subjectId: inventory.subjectId,
            candidateId: candidate.candidateId,
            reason: "Fixture source is not a separately auditable capability.",
            evidenceIds: [`evidence-${inventory.subjectId}`],
          })),
        ),
      });

      expect(result.ok).toBe(true);
      expect(result.rows).toHaveLength(EXPECTED_ENUMERATORS.length * 2);
      expect(new Set(result.rows.map((row) => row.subjectId))).toEqual(
        new Set(["production-baseline", "candidate"]),
      );
      expect(() => assertInventoryClosure(result)).not.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createZenFlowFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-inventory-v2-"));
  const files = {
    "src/pages/Index.tsx": "<Route path=\"/orb\" /><NavV2Orchestrator />\n",
    "src/components/state-of-mind/ValenceOrb.tsx": "export function ValenceOrb() { return null; }\n",
    "src/contexts/FeatureFlagsContext.tsx": "export const FeatureFlagsContext = createContext({});\n",
    "src/providers/AdProvider.tsx": "export const AdProvider = ({ children }) => children;\n",
    "src/stores/userDataStore.ts": "export const useUserDataStore = create(() => ({}));\n",
    "src/storage/db.ts": "export const db = new Dexie('zenflow');\nexport const syncQueue = [];\n",
    "src/lib/coach.ts": "export const aiCoach = 'AI Coach';\nexport const notification = LocalNotifications;\n",
    "android/app/src/main/java/com/zenflow/app/MainActivity.java": "@CapacitorPlugin(name = \"ZenFlow\") class MainActivity {}\n",
    "android/app/src/main/AndroidManifest.xml": "<manifest><uses-permission android:name=\"POST_NOTIFICATIONS\" /></manifest>\n",
    "src/i18n/languages/ar.ts": "export const ar = { title: 'ZenFlow' };\n",
    "public/privacy-policy.html": "<main>Privacy and support</main>\n",
    "scripts/__tests__/sync-recovery.test.mjs": "it('recovers queue', () => {});\n",
    "src/observability/recovery.ts": "export const recoverDeadLetter = () => {};\n",
    "src/components/legacy/OldMoodCard.tsx": "export const LegacyMoodCard = () => null;\n",
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const absolute = path.join(root, relativePath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
  const sound = path.join(root, "public/sounds/feedback/cue.mp3");
  await mkdir(path.dirname(sound), { recursive: true });
  await writeFile(sound, Buffer.from([0, 1, 2, 3]));
  return root;
}
