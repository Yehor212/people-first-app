import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { enumerateProductCoherenceCandidates } from "../product-coherence/enumerators/index.mjs";
import {
  EXCLUSION_REASONS,
  validateInventoryReconciliation,
} from "../product-coherence/reconcile.mjs";

const SHA = "a".repeat(64);
const LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

describe("product coherence inventory v2", () => {
  it("derives stable IDs without the absolute root and orders output deterministically", async () => {
    const files = {
      "src/B.ts": 'export const CANVAS_ENABLED = true;\nconst route = { path: "/b" };\n',
      "src/a.ts":
        'export const useAccountStore = create(() => ({}));\nconst route = { path: "/a" };\n',
    };
    const firstRoot = await createRepository(files);
    const secondRoot = await createRepository(files);

    try {
      const first = await enumerateProductCoherenceCandidates(firstRoot, "candidate");
      const second = await enumerateProductCoherenceCandidates(secondRoot, "candidate");

      expect(first.candidates.length).toBeGreaterThan(0);
      expect(first.candidates).toEqual(second.candidates);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.candidates).toEqual([...first.candidates].sort(compareCandidates));
      expect(JSON.stringify(first)).not.toContain(firstRoot);
      expect(JSON.stringify(second)).not.toContain(secondRoot);
    } finally {
      await Promise.all([removeTree(firstRoot), removeTree(secondRoot)]);
    }
  });

  it("enumerates the required ZenFlow surface families without assigning product decisions", async () => {
    const localeFiles = Object.fromEntries(
      LOCALES.map((locale) => [
        `src/i18n/languages/${locale}.ts`,
        `export default { welcomeTitle: "${locale} private translation value" };\n`,
      ])
    );
    const root = await createRepository({
      ...localeFiles,
      "src/main.tsx": `
        const JOURNAL_ROUTE = { path: "/journal", element: JournalPage };
        const NAV_ITEMS = [{ id: "home" }];
        window.addEventListener("zenflow:deep-link", handleDeepLink);
        const CANVAS_ENABLED = true;
        navigator.serviceWorker.register("/sw.js");
        if (import.meta.env.DEV) logger.debug("dev only");
        export const App = () => (
          <FeatureFlagsProvider>
            <AdProvider><JournalPage /></AdProvider>
          </FeatureFlagsProvider>
        );
      `,
      "src/components/AuthGate.tsx": `
        export function AuthGate() {
          return <><OnboardingFlow /><AuthScreen /><ModalLayer /><RecoveryPanel /></>;
        }
      `,
      "src/components/state-of-mind/ValenceOrb.tsx":
        "export function ValenceOrb() { return <canvas />; }\n",
      "src/components/state-of-mind/MiniValenceOrb.tsx":
        "export function MiniValenceOrb() { return <canvas />; }\n",
      "src/pages/nav-v2/OrbPage.tsx": "export function OrbPage() { return <ValenceOrb />; }\n",
      "src/stores/appStore.ts": "export const useAppStore = create(() => ({}));\n",
      "src/stores/useHydrateUserData.ts":
        "export function useHydrateUserData() { return useIndexedDB(); }\n",
      "src/storage/db.ts": `
        const db = new Dexie("zenflow");
        db.version(2).stores({ moods: "id" }).upgrade(migrate);
      `,
      "src/lib/dataLifecycle.ts": `
        const deletionTrackerId = "permanent-id";
        export async function syncAccount() { return offlineQueue.flushDeadLetters(); }
        export async function exportData() {}
        export async function deleteAccount() {}
      `,
      "src/lib/integrations.ts": `
        const coach = AICoach.privateSearch(ragProvider, journalContext);
        AdMob.prepareRewardVideo();
        Analytics.logEvent("fixture");
        privacyConsent.request();
        rewardUser("fixture");
        notificationScheduler.scheduleReminder();
        hapticTap();
        appSound.play();
        openOsSettings();
      `,
      "src/i18n/rtl.ts": "export const isRtl = locale === 'ar';\nconst bidiIsolation = true;\n",
      "src/lib/observability.ts": "Sentry.captureException(error); logger.error(error);\n",
      "src/lib/background.ts":
        "setInterval(runBackgroundJob, 1000);\nApp.addListener('resume', resume);\n",
      "src/lib/dynamic.ts": "const modulePromise = import(featureModuleName);\n",
      "src/__tests__/runtime.test.ts": "it('observes recovery', () => expect(true).toBe(true));\n",
      "android/app/src/main/java/app/ZenPlugin.java": "final class ZenPlugin extends Plugin {}\n",
      "ios/App/App/ZenPlugin.swift": "final class ZenPlugin: CAPPlugin {}\n",
      "src-tauri/src/main.rs": "fn main() { tauri::Builder::default(); }\n",
      "capacitor.config.ts": "export default { plugins: { LocalNotifications: {} } };\n",
      "public/manifest.webmanifest": '{"name":"ZenFlow"}\n',
      "docs/STORE_LISTING.md": "ZenFlow public store promise and V1/V2 parity claim.\n",
      "docs/SUPPORT.md": "Public support and recovery promise.\n",
      "src/legacy/old-flow.ts": "/** @deprecated legacy flow */\nexport const oldFlow = true;\n",
      "src/generated/client.ts": "// generated source\nexport const client = {};\n",
      "public/assets/icon.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      "patches/@capacitor+local-notifications+8.1.0.patch": "diff --git a/a b/a\n",
    });

    try {
      const inventory = await enumerateProductCoherenceCandidates(root, "candidate");
      const kinds = new Set(inventory.candidates.map((candidate) => candidate.kind));

      for (const expectedKind of [
        "ROUTE",
        "FEATURE_FLAG",
        "PROVIDER",
        "ZUSTAND_STORE",
        "LOCALE_MODULE",
        "TRANSLATION_KEY",
        "NATIVE_PLATFORM",
        "PUBLIC_CLAIM",
        "NAVIGATION",
        "DEEP_LINK",
        "ONBOARDING",
        "AUTH",
        "MODAL_OVERLAY",
        "ERROR_RECOVERY",
        "UI_COMPONENT",
        "CANONICAL_ORB",
        "VERSIONED_UI",
        "BACKGROUND_WORK",
        "SERVICE_WORKER_PWA",
        "DEBUG_SURFACE",
        "HYDRATION_BRIDGE",
        "DEXIE_SCHEMA",
        "DATA_LIFECYCLE",
        "AI_COACH_RAG",
        "AD_ANALYTICS_CONSENT",
        "REWARDS",
        "NOTIFICATION_SOUND_HAPTIC",
        "RTL_BIDI",
        "TEST_REFERENCE",
        "OBSERVABILITY",
        "LEGACY_GENERATED",
        "ASSET",
        "PATCH",
        "PARSER_UNCERTAINTY",
      ]) {
        expect(kinds).toContain(expectedKind);
      }
      expect(
        new Set(
          inventory.candidates
            .filter((candidate) => candidate.kind === "LOCALE_MODULE")
            .map((candidate) => candidate.symbol)
        )
      ).toEqual(new Set(LOCALES));
      expect(
        inventory.candidates.filter((candidate) => candidate.kind === "TRANSLATION_KEY")
      ).toHaveLength(8);
      expect(JSON.stringify(inventory)).not.toMatch(
        /reachability|capabilityRole|productDisposition|decision/i
      );
    } finally {
      await removeTree(root);
    }
  });

  it("emits bounded metadata and hashes without leaking source snippets or values", async () => {
    const privateMarker = "DO_NOT_LEAK_PRIVATE_SOURCE_7C9A";
    const root = await createRepository({
      "src/routes.ts": `
        const privateNote = "${privateMarker}";
        const contact = "person@example.test";
        export const route = { path: "/private-route-value" };
      `,
    });

    try {
      const inventory = await enumerateProductCoherenceCandidates(root, "candidate");
      const serialized = JSON.stringify(inventory);
      expect(inventory.candidates.length).toBeGreaterThan(0);
      expect(serialized).not.toContain(privateMarker);
      expect(serialized).not.toContain("person@example.test");
      expect(serialized).not.toContain("/private-route-value");
      for (const candidate of inventory.candidates) {
        expect(Object.keys(candidate).sort()).toEqual(
          expect.arrayContaining([
            "candidateId",
            "enumerator",
            "evidenceSha256",
            "kind",
            "locator",
            "subjectId",
            "tags",
          ])
        );
        expect(candidate.evidenceSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(candidate.tags).toEqual(
          expect.objectContaining({
            domains: expect.any(Array),
            platforms: expect.any(Array),
            parser: expect.any(String),
          })
        );
        expect(candidate).not.toHaveProperty("source");
        expect(candidate).not.toHaveProperty("snippet");
        expect(candidate).not.toHaveProperty("value");
        expect(candidate).not.toHaveProperty("text");
      }
    } finally {
      await removeTree(root);
    }
  });

  it("rejects a tracked symlink that escapes the exact subject root", async () => {
    const root = await createRepository({});
    const outside = await mkdtemp(path.join(os.tmpdir(), "product-coherence-outside-"));
    try {
      const outsideFile = path.join(outside, "private.ts");
      await writeFile(outsideFile, "export const privateValue = true;\n");
      await symlink(outsideFile, path.join(root, "escape.ts"));
      runGit(root, ["add", "escape.ts"]);

      await expect(enumerateProductCoherenceCandidates(root, "candidate")).rejects.toThrow(
        /symlink.*escape|outside.*root/i
      );
    } finally {
      await Promise.all([removeTree(root), removeTree(outside)]);
    }
  });

  it("fails closed when a tracked file is path-swapped after opening", async () => {
    const root = await createRepository({
      "src/source.ts": 'export const route = { path: "/safe" };\n',
    });
    const outside = await mkdtemp(path.join(os.tmpdir(), "product-coherence-swap-outside-"));
    try {
      const target = path.join(root, "src/source.ts");
      const moved = path.join(root, "src/source.original.ts");
      const outsideFile = path.join(outside, "private.ts");
      await writeFile(outsideFile, "private source\n");

      await expect(
        enumerateProductCoherenceCandidates(root, "candidate", {
          testingHooks: {
            afterFileOpen: async (openedPath) => {
              if (path.basename(openedPath) !== "source.ts") return;
              await rename(target, moved);
              await symlink(outsideFile, target);
            },
          },
        })
      ).rejects.toThrow(/changed|identity|symlink|escape/i);
    } finally {
      await Promise.all([removeTree(root), removeTree(outside)]);
    }
  });

  it("hard-fails instead of silently truncating a file or candidate set", async () => {
    const root = await createRepository({
      "src/large.ts": `export const CANVAS_ENABLED = true;\n${"x".repeat(128)}\n`,
      "src/second.ts": 'export const route = { path: "/second" };\n',
    });

    try {
      await expect(
        enumerateProductCoherenceCandidates(root, "candidate", {
          limits: { maxFileBytes: 32 },
        })
      ).rejects.toThrow(/file byte limit/i);
      await expect(
        enumerateProductCoherenceCandidates(root, "candidate", {
          limits: { maxRows: 1 },
        })
      ).rejects.toThrow(/candidate row limit/i);
    } finally {
      await removeTree(root);
    }
  });

  it("does not inspect untracked files or trust a self-declared sanitized manifest", async () => {
    const patchBody = "DO_NOT_READ_UNTRACKED_PATCH_CONTENT_5F2D\n";
    const root = await createRepository({
      ".gitignore": ".env\n",
      "src/main.ts": "export const main = true;\n",
    });
    try {
      await mkdir(path.join(root, "patches"), { recursive: true });
      await writeFile(
        path.join(root, "patches/@capacitor+local-notifications+8.1.0.patch"),
        patchBody
      );
      await writeFile(path.join(root, ".env"), "SECRET_VALUE=not-read\n");

      const trackedOnly = await enumerateProductCoherenceCandidates(root, "candidate");
      expect(trackedOnly.untracked).toEqual({
        status: "BLOCKED_UNAVAILABLE",
        enumerated: 0,
        reasonCode: "SANITIZED_UNTRACKED_MANIFEST_REQUIRED",
      });
      expect(trackedOnly.candidates.some((candidate) => candidate.kind === "PATCH")).toBe(false);
      expect(JSON.stringify(trackedOnly)).not.toContain(patchBody.trim());
      expect(JSON.stringify(trackedOnly)).not.toContain("SECRET_VALUE");

      await expect(
        enumerateProductCoherenceCandidates(root, "candidate", {
          sanitizedUntrackedManifest: {
            subjectId: "candidate",
            validationStatus: "PASS",
            entries: [],
          },
        })
      ).rejects.toThrow(/verified provenance|adapter.*unavailable|self-declared/i);
    } finally {
      await removeTree(root);
    }
  });

  it("enumerates a sensitive tracked path without opening or exposing its contents", async () => {
    const privateMarker = "TRACKED_PRIVATE_CONFIG_MUST_NOT_BE_READ_91E4";
    const root = await createRepository({
      ".mcp.json": `{"placeholder":"${privateMarker}"}`,
      "src/main.ts": "export const main = true;\n",
    });

    try {
      const inventory = await enumerateProductCoherenceCandidates(root, "candidate", {
        testingHooks: {
          afterFileOpen: async (openedPath) => {
            if (path.basename(openedPath) === ".mcp.json") {
              throw new Error("sensitive tracked path was opened");
            }
          },
        },
      });

      expect(inventory.candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "SENSITIVE_FILE_NOT_READ",
            locator: ".mcp.json",
          }),
        ])
      );
      expect(inventory.stats.filesRead).toBe(1);
      expect(JSON.stringify(inventory)).not.toContain(privateMarker);
    } finally {
      await removeTree(root);
    }
  });
});

describe("product coherence inventory reconciliation", () => {
  it("reconciles every candidate exactly once and reports honest denominators", () => {
    const candidates = [candidate("test-1"), candidate("route-1")];
    const capabilities = [capability("cap-route-support"), capability("cap-route")];
    const evidence = [
      directEvidence("ev-test"),
      directEvidence("ev-route-z"),
      directEvidence("ev-route-a"),
    ];
    const reconciliations = [
      exclusion("test-1", "ev-test"),
      mapping("route-1", ["cap-route-support", "cap-route"], ["ev-route-z", "ev-route-a"]),
    ];

    expect(
      validateInventoryReconciliation({ candidates, capabilities, evidence, reconciliations })
    ).toEqual({
      ok: true,
      errors: [],
      rows: [
        {
          candidateId: "route-1",
          subjectId: "candidate",
          outcome: "MAPPED",
          capabilityIds: ["cap-route", "cap-route-support"],
          evidenceIds: ["ev-route-a", "ev-route-z"],
        },
        {
          candidateId: "test-1",
          subjectId: "candidate",
          outcome: "EXCLUDED",
          reason: "TEST_OR_FIXTURE_ONLY",
          evidenceIds: ["ev-test"],
          reviewer: "inventory reviewer",
          owner: "capability audit owner",
          invalidationTriggers: ["fixture becomes production-reachable"],
        },
      ],
      counts: {
        enumerated: 2,
        mapped: 1,
        excluded: 1,
        blocked: 0,
        unclassified: 0,
        unreconciled: 0,
      },
    });
    expect(EXCLUSION_REASONS).toContain("TEST_OR_FIXTURE_ONLY");
  });

  it("rejects cross-subject mappings", () => {
    const result = validateInventoryReconciliation({
      candidates: [candidate("route-1", "candidate")],
      capabilities: [capability("cap-route", "production-baseline")],
      evidence: [directEvidence("ev-route", "candidate")],
      reconciliations: [mapping("route-1", ["cap-route"], ["ev-route"], "candidate")],
    });

    expect(result.ok).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/cross-subject/i)])
    );
  });

  it("rejects duplicate mappings and duplicate capability references", () => {
    const result = validateInventoryReconciliation({
      candidates: [candidate("route-1")],
      capabilities: [capability("cap-route")],
      evidence: [directEvidence("ev-route")],
      reconciliations: [
        mapping("route-1", ["cap-route", "cap-route"], ["ev-route"]),
        mapping("route-1", ["cap-route"], ["ev-route"]),
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/duplicate reconciliation/i),
        expect.stringMatching(/duplicate capability/i),
      ])
    );
  });

  it("rejects an exclusion without same-subject direct evidence", () => {
    const missing = validateInventoryReconciliation({
      candidates: [candidate("test-1")],
      capabilities: [],
      evidence: [],
      reconciliations: [{ ...exclusion("test-1", "missing"), evidenceIds: [] }],
    });
    const inferred = validateInventoryReconciliation({
      candidates: [candidate("test-1")],
      capabilities: [],
      evidence: [{ ...directEvidence("ev-inferred"), evidenceClass: "INFERENCE" }],
      reconciliations: [exclusion("test-1", "ev-inferred")],
    });

    expect(missing.ok).toBe(false);
    expect(missing.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/direct evidence/i)])
    );
    expect(inferred.ok).toBe(false);
    expect(inferred.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/direct evidence/i)])
    );
  });

  it("rejects unknown or duplicate evidence IDs and fields outside the closed row union", () => {
    const unknown = validateInventoryReconciliation({
      candidates: [candidate("route-1")],
      capabilities: [capability("cap-route")],
      evidence: [],
      reconciliations: [mapping("route-1", ["cap-route"], ["missing-evidence"])],
    });
    const duplicateAndOpen = validateInventoryReconciliation({
      candidates: [candidate("route-1")],
      capabilities: [capability("cap-route")],
      evidence: [directEvidence("ev-route")],
      reconciliations: [
        {
          ...mapping("route-1", ["cap-route"], ["ev-route", "ev-route"]),
          disposition: "KEEP",
        },
      ],
    });

    expect(unknown.ok).toBe(false);
    expect(unknown.rows).toEqual([]);
    expect(unknown.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown direct evidence/i)])
    );
    expect(duplicateAndOpen.ok).toBe(false);
    expect(duplicateAndOpen.rows).toEqual([]);
    expect(duplicateAndOpen.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/duplicate.*evidence/i),
        expect.stringMatching(/unexpected field disposition/i),
      ])
    );
  });

  it("retains an explicit BLOCKED row but refuses audit closure", () => {
    const invalid = validateInventoryReconciliation({
      candidates: [candidate("unknown-1")],
      capabilities: [],
      evidence: [directEvidence("ev-blocker")],
      reconciliations: [blocked("unknown-1", "Runtime proof unavailable.", "", ["ev-blocker"])],
    });
    const valid = validateInventoryReconciliation({
      candidates: [candidate("unknown-1")],
      capabilities: [],
      evidence: [directEvidence("ev-blocker")],
      reconciliations: [
        blocked("unknown-1", "Runtime proof unavailable.", "runtime evidence owner", [
          "ev-blocker",
        ]),
      ],
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.rows).toEqual([]);
    expect(invalid.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/blocker.*owner/i)])
    );
    expect(valid.ok).toBe(false);
    expect(valid.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/audit closure.*blocked/i)])
    );
    expect(valid.rows).toEqual([
      {
        candidateId: "unknown-1",
        subjectId: "candidate",
        outcome: "BLOCKED",
        blocker: "Runtime proof unavailable.",
        owner: "runtime evidence owner",
        evidenceIds: ["ev-blocker"],
      },
    ]);
    expect(valid.counts).toEqual({
      enumerated: 1,
      mapped: 0,
      excluded: 0,
      blocked: 1,
      unclassified: 0,
      unreconciled: 0,
    });
  });

  it("rejects mapping through a BLOCKED_UNVERIFIED capability", () => {
    const result = validateInventoryReconciliation({
      candidates: [candidate("unknown-1")],
      capabilities: [
        {
          ...capability("cap-unknown"),
          productDisposition: "BLOCKED_UNVERIFIED",
          blocker: {
            summary: "Runtime proof unavailable.",
            owner: "runtime evidence owner",
          },
        },
      ],
      evidence: [directEvidence("ev-blocker")],
      reconciliations: [mapping("unknown-1", ["cap-unknown"], ["ev-blocker"])],
    });

    expect(result.ok).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.counts.unclassified).toBe(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/use a BLOCKED reconciliation/i)])
    );
  });

  it("rejects orphan reconciliations, unknown capability IDs, and unreconciled candidates", () => {
    const result = validateInventoryReconciliation({
      candidates: [candidate("route-1"), candidate("route-2")],
      capabilities: [capability("cap-route")],
      evidence: [directEvidence("ev-route")],
      reconciliations: [
        mapping("route-1", ["missing-capability"], ["ev-route"]),
        mapping("orphan-candidate", ["cap-route"], ["ev-route"]),
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.counts.unclassified).toBe(2);
    expect(result.counts.unreconciled).toBe(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unknown capability/i),
        expect.stringMatching(/orphan candidate/i),
        expect.stringMatching(/unreconciled/i),
      ])
    );
  });
});

async function createRepository(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-v2-"));
  expect(runGit(root, ["init", "--quiet"]).status).toBe(0);
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
  expect(runGit(root, ["add", "--all"]).status).toBe(0);
  return root;
}

function runGit(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

async function removeTree(root) {
  await rm(root, { recursive: true, force: true });
}

function compareCandidates(left, right) {
  for (const field of ["locator", "enumerator", "kind", "symbol", "candidateId"]) {
    const result = Buffer.compare(
      Buffer.from(left[field] ?? "", "utf8"),
      Buffer.from(right[field] ?? "", "utf8")
    );
    if (result !== 0) return result;
  }
  return 0;
}

function candidate(candidateId, subjectId = "candidate") {
  return {
    candidateId,
    subjectId,
    enumerator: "fixture",
    kind: "ROUTE",
    locator: "src/main.tsx",
    evidenceSha256: SHA,
    tags: { domains: ["navigation"], platforms: ["WEB"], parser: "LEXICAL" },
  };
}

function capability(capabilityId, subjectId = "candidate") {
  return {
    capabilityId,
    subjectId,
    productDisposition: "KEEP",
  };
}

function directEvidence(evidenceId, subjectId = "candidate") {
  return {
    evidenceId,
    subjectId,
    evidenceClass: "DIRECT_LOCAL",
  };
}

function mapping(candidateId, capabilityIds, evidenceIds, subjectId = "candidate") {
  return {
    candidateId,
    subjectId,
    outcome: "MAPPED",
    capabilityIds,
    evidenceIds,
  };
}

function exclusion(candidateId, evidenceId, subjectId = "candidate") {
  return {
    candidateId,
    subjectId,
    outcome: "EXCLUDED",
    reason: "TEST_OR_FIXTURE_ONLY",
    evidenceIds: [evidenceId],
    reviewer: "inventory reviewer",
    owner: "capability audit owner",
    invalidationTriggers: ["fixture becomes production-reachable"],
  };
}

function blocked(candidateId, blocker, owner, evidenceIds, subjectId = "candidate") {
  return {
    candidateId,
    subjectId,
    outcome: "BLOCKED",
    blocker,
    owner,
    evidenceIds,
  };
}
