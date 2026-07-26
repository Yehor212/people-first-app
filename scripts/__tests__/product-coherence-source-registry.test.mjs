import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  SOURCE_REGISTRY_LIMITS,
  SOURCE_REGISTRY_RELATIVE_PATH,
  loadSourceRegistry,
  validateSourceRegistry,
} from "../product-coherence/source-registry.mjs";

const REVIEW_CLOCK = new Date("2026-07-26T23:59:59.000Z");
const EXPECTED_SOURCES = Object.freeze({
  "iso-iec-25010-2023": "https://www.iso.org/standard/78176.html",
  "iso-iec-25019-2023": "https://www.iso.org/standard/78177.html",
  "iso-9241-11-2018": "https://www.iso.org/standard/63500.html",
  "iso-9241-110-2020": "https://www.iso.org/standard/75258.html",
  "iso-9241-210-2019": "https://www.iso.org/standard/77520.html",
  "w3c-wcag-22": "https://www.w3.org/TR/WCAG22/",
  "w3c-coga-usable-2021": "https://www.w3.org/TR/coga-usable/",
  "w3c-involving-users": "https://www.w3.org/WAI/planning/involving-users/",
  "apple-hig-settings": "https://developer.apple.com/design/human-interface-guidelines/settings",
  "apple-hig-notifications":
    "https://developer.apple.com/design/human-interface-guidelines/notifications/",
  "android-notification-channels":
    "https://developer.android.com/develop/ui/compose/notifications/channels",
  "android-post-notifications-permission":
    "https://developer.android.com/develop/ui/compose/notifications/notification-permission",
  "nist-ai-rmf-1-0": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf",
  "nist-ai-rmf-revision-status": "https://www.nist.gov/itl/ai-risk-management-framework",
  "nist-ai-rmf-genai-profile": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf",
  "owasp-llm-top-10-2025": "https://genai.owasp.org/llm-top-10/",
  "apple-app-review-guidelines": "https://developer.apple.com/app-store/review/guidelines/",
  "google-play-health-declaration":
    "https://support.google.com/googleplay/android-developer/answer/14738291?hl=en",
  "google-play-ai-generated-content-policy":
    "https://support.google.com/googleplay/android-developer/answer/13985936?hl=en",
});

describe("ProductCoherenceAudit authoritative source registry", () => {
  it("loads the exact approved denominator and returns a deterministic canonical digest", async () => {
    const loaded = await loadSourceRegistry({
      repositoryRoot: process.cwd(),
      now: REVIEW_CLOCK,
    });

    expect(loaded.registryPath).toBe(
      path.join(process.cwd(), ...SOURCE_REGISTRY_RELATIVE_PATH.split("/"))
    );
    expect(Object.fromEntries(loaded.registry.sources.map(({ id, url }) => [id, url]))).toEqual(
      EXPECTED_SOURCES
    );
    expect(loaded.registry.sources).toHaveLength(19);
    expect(loaded.registry.schemaVersion).toBe("1.0.0");
    expect(loaded.registry.registryVersion).toBe("2026-07-26.1");
    expect(loaded.registry.checkedAt).toBe("2026-07-26");
    expect(
      loaded.registry.sources.every(
        ({ checkedAt, retrievedAt, sourceMetadataSha256 }) =>
          checkedAt === "2026-07-26" &&
          retrievedAt === "2026-07-26" &&
          /^[a-f0-9]{64}$/.test(sourceMetadataSha256)
      )
    ).toBe(true);
    expect(loaded.digest).toMatch(/^[a-f0-9]{64}$/);

    const reordered = {
      sources: loaded.registry.sources.map((source) =>
        Object.fromEntries(Object.entries(source).reverse())
      ),
      checkedAt: loaded.registry.checkedAt,
      registryVersion: loaded.registry.registryVersion,
      registryId: loaded.registry.registryId,
      schemaVersion: loaded.registry.schemaVersion,
    };
    expect(validateSourceRegistry(reordered, { now: REVIEW_CLOCK }).digest).toBe(loaded.digest);
  });

  it("rejects a missing source, duplicate ID, duplicate URL, and substituted host", async () => {
    const registry = await readCanonicalRegistry();

    const missing = structuredClone(registry);
    missing.sources.pop();
    expect(() => validateSourceRegistry(missing, { now: REVIEW_CLOCK })).toThrow(
      /exactly 19|required source/i
    );

    const duplicateId = structuredClone(registry);
    duplicateId.sources.at(-1).id = duplicateId.sources[0].id;
    expect(() => validateSourceRegistry(duplicateId, { now: REVIEW_CLOCK })).toThrow(
      /duplicate source id/i
    );

    const duplicateUrl = structuredClone(registry);
    duplicateUrl.sources.at(-1).url = duplicateUrl.sources[0].url;
    expect(() => validateSourceRegistry(duplicateUrl, { now: REVIEW_CLOCK })).toThrow(
      /duplicate source url/i
    );

    const substitutedHost = structuredClone(registry);
    source(substitutedHost, "w3c-wcag-22").url = "https://example.com/TR/WCAG22/";
    expect(() => validateSourceRegistry(substitutedHost, { now: REVIEW_CLOCK })).toThrow(
      /official host|approved url/i
    );
  });

  it("rejects ISO full-text and normative overclaims", async () => {
    const registry = await readCanonicalRegistry();
    const iso = source(registry, "iso-iec-25010-2023");
    iso.classification = "normative";
    iso.contentAccess = "FULL_PUBLIC";
    iso.applicability = ["Clause 4 proves ZenFlow product quality conformance."];

    expect(() => validateSourceRegistry(registry, { now: REVIEW_CLOCK })).toThrow(
      /iso.*metadata.only|metadata.only.*iso/i
    );

    const missingWebLimit = await readCanonicalRegistry();
    source(missingWebLimit, "iso-iec-25010-2023").tradeoffsAndLimits = [
      "The catalogue abstract does not supply a clause-level requirement mapping.",
    ];
    expect(() => validateSourceRegistry(missingWebLimit, { now: REVIEW_CLOCK })).toThrow(
      /iso web.metadata limitation/i
    );
  });

  it("rejects treating the COGA usable note as normative or WCAG conformance evidence", async () => {
    const registry = await readCanonicalRegistry();
    const coga = source(registry, "w3c-coga-usable-2021");
    coga.classification = "normative";
    coga.tradeoffsAndLimits = ["Satisfying this source establishes WCAG conformance."];

    expect(() => validateSourceRegistry(registry, { now: REVIEW_CLOCK })).toThrow(
      /coga.*informative|informative.*coga/i
    );
  });

  it("rejects generic PASS claims and local-proof laundering", async () => {
    const registry = await readCanonicalRegistry();
    source(registry, "apple-hig-settings").applicability = [
      "PASS: ZenFlow settings comply with Apple guidance.",
    ];
    expect(() => validateSourceRegistry(registry, { now: REVIEW_CLOCK })).toThrow(
      /generic pass|pass claim/i
    );

    const localProof = await readCanonicalRegistry();
    source(localProof, "nist-ai-rmf-1-0").applicability = [
      "This source proves ZenFlow's local AI behavior is conformant and safe.",
    ];
    expect(() => validateSourceRegistry(localProof, { now: REVIEW_CLOCK })).toThrow(
      /local proof|prove.*zenflow|conformance laundering/i
    );
  });

  it("rejects future or impossible retrieval dates and unknown schema fields", async () => {
    const future = await readCanonicalRegistry();
    source(future, "w3c-wcag-22").retrievedAt = "2026-07-27";
    expect(() => validateSourceRegistry(future, { now: REVIEW_CLOCK })).toThrow(
      /future|retrieved/i
    );

    const impossible = await readCanonicalRegistry();
    source(impossible, "w3c-wcag-22").retrievedAt = "2026-02-30";
    expect(() => validateSourceRegistry(impossible, { now: REVIEW_CLOCK })).toThrow(
      /valid calendar date/i
    );

    const extended = await readCanonicalRegistry();
    source(extended, "w3c-wcag-22").localConformance = true;
    expect(() => validateSourceRegistry(extended, { now: REVIEW_CLOCK })).toThrow(
      /unknown field|exact fields/i
    );
  });

  it("rejects stale checks and a source metadata hash mismatch", async () => {
    const stale = await readCanonicalRegistry();
    stale.checkedAt = "2026-06-25";
    expect(() => validateSourceRegistry(stale, { now: REVIEW_CLOCK })).toThrow(/stale|fresh/i);

    const changedMetadata = await readCanonicalRegistry();
    source(changedMetadata, "owasp-llm-top-10-2025").title += " modified";
    expect(() => validateSourceRegistry(changedMetadata, { now: REVIEW_CLOCK })).toThrow(
      /source metadata sha256|source metadata hash/i
    );
  });

  it("requires concrete applicability plus edition and confirmation metadata", async () => {
    const noApplicability = await readCanonicalRegistry();
    source(noApplicability, "apple-hig-notifications").applicability = [];
    expect(() => validateSourceRegistry(noApplicability, { now: REVIEW_CLOCK })).toThrow(
      /applicability.*non-empty/i
    );

    const noEdition = await readCanonicalRegistry();
    delete source(noEdition, "w3c-wcag-22").edition;
    expect(() => validateSourceRegistry(noEdition, { now: REVIEW_CLOCK })).toThrow(
      /missing fields: edition/i
    );

    const staleConfirmation = await readCanonicalRegistry();
    source(staleConfirmation, "android-notification-channels").confirmation.asOf = "2026-07-25";
    expect(() => validateSourceRegistry(staleConfirmation, { now: REVIEW_CLOCK })).toThrow(
      /confirmation\.asOf must match checkedAt/i
    );
  });

  it("confines reads to a regular no-follow file below a real repository root", async () => {
    const fixture = await createRegistryFixture();
    const outside = path.join(fixture.parent, "outside.json");
    await writeFile(outside, JSON.stringify(await readCanonicalRegistry()), "utf8");
    try {
      await unlink(fixture.registryPath);
      await symlink(outside, fixture.registryPath);
      await expect(
        loadSourceRegistry({ repositoryRoot: fixture.root, now: REVIEW_CLOCK })
      ).rejects.toThrow(/symlink/i);

      await expect(
        loadSourceRegistry({
          repositoryRoot: fixture.root,
          registryPath: "../outside.json",
          now: REVIEW_CLOCK,
        })
      ).rejects.toThrow(/relative|repository root|traversal/i);
    } finally {
      await rm(fixture.parent, { recursive: true, force: true });
    }
  });

  it("rejects bounded-file violations and a path swap after no-follow open", async () => {
    const oversized = await createRegistryFixture();
    try {
      await writeFile(
        oversized.registryPath,
        " ".repeat(SOURCE_REGISTRY_LIMITS.maxBytes + 1),
        "utf8"
      );
      await expect(
        loadSourceRegistry({ repositoryRoot: oversized.root, now: REVIEW_CLOCK })
      ).rejects.toThrow(/maximum|too large|byte/i);
    } finally {
      await rm(oversized.parent, { recursive: true, force: true });
    }

    const raced = await createRegistryFixture();
    const outside = path.join(raced.parent, "replacement.json");
    await writeFile(outside, JSON.stringify(await readCanonicalRegistry()), "utf8");
    try {
      await expect(
        loadSourceRegistry({
          repositoryRoot: raced.root,
          now: REVIEW_CLOCK,
          testingHooks: {
            afterFileOpen: async () => {
              await unlink(raced.registryPath);
              await symlink(outside, raced.registryPath);
            },
          },
        })
      ).rejects.toThrow(/changed|race|symlink/i);
    } finally {
      await rm(raced.parent, { recursive: true, force: true });
    }
  });
});

async function readCanonicalRegistry() {
  const raw = await readFile(path.resolve(SOURCE_REGISTRY_RELATIVE_PATH), "utf8");
  return JSON.parse(raw);
}

function source(registry, id) {
  const match = registry.sources.find((entry) => entry.id === id);
  if (!match) throw new Error(`test fixture source is missing: ${id}`);
  return match;
}

async function createRegistryFixture() {
  const parent = await mkdtemp(path.join(os.tmpdir(), "zenflow-source-registry-"));
  const root = path.join(parent, "repository");
  const registryPath = path.join(root, ...SOURCE_REGISTRY_RELATIVE_PATH.split("/"));
  await mkdir(path.dirname(registryPath), { recursive: true });
  await writeFile(registryPath, JSON.stringify(await readCanonicalRegistry()), "utf8");
  return { parent, root, registryPath };
}
