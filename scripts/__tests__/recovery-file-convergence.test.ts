import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

type RecoveryRecord = {
  sourceId: string;
  sourceKind:
    | "dirty-file"
    | "deletion-intent"
    | "historical-commit"
    | "historical-file"
    | "special-file"
    | "special-archive";
  packet?: string;
  path?: string;
  sourceSha256?: string;
  mainSha256?: string | null;
  secretMatches?: number;
};

function loadCore() {
  return require("../recovery-file-convergence-core.cjs") as {
    buildVariantGroups(records: RecoveryRecord[]): Array<{
      path: string;
      conflict: boolean;
      variants: Array<{ sha256: string; sourceIds: string[] }>;
    }>;
    collectPacketRecords(
      manifest: unknown,
      mainHashes: Record<string, string | null>,
    ): Array<RecoveryRecord & { disposition: string; changeKind: string }>;
    collectUniqueHeadShas(inventory: unknown): string[];
    collectSpecialRecords(
      manifest: unknown,
      mainHashes: Record<string, string | null>,
    ): Array<RecoveryRecord & { disposition: string; changeKind: string }>;
    parseNameStatusZ(text: string): Array<{
      status: string;
      path: string;
      previousPath?: string;
    }>;
    parseLsTreeZ(text: string): Record<string, string>;
    classifyMechanicalPolicy(record: RecoveryRecord): string;
    sanitizeLedgerRecord(record: RecoveryRecord): RecoveryRecord;
    summarizeLedger(records: Array<{ disposition: string }>): {
      total: number;
      byDisposition: Record<string, number>;
      open: number;
    };
    validateDecision(record: {
      disposition: string;
      evidence?: string[];
    }): void;
  };
}

describe("recovery file convergence policy", () => {
  it("excludes Kimi sources before they can reach semantic review", () => {
    const { classifyMechanicalPolicy } = loadCore();

    expect(
      classifyMechanicalPolicy({
        sourceId: "packet:kimi-audio",
        sourceKind: "dirty-file",
        packet: "people-first-app-codex-kimi-safe-sync-cc3b",
        path: "src/lib/example.ts",
        sourceSha256: "a".repeat(64),
        mainSha256: null,
      }),
    ).toBe("EXCLUDED_KIMI");
    expect(
      classifyMechanicalPolicy({
        sourceId: "file:kimi-review",
        sourceKind: "dirty-file",
        packet: "audio-review",
        path: "scripts/audio-review/cc0-kimi-audio-core.mjs",
        sourceSha256: "b".repeat(64),
        mainSha256: null,
      }),
    ).toBe("EXCLUDED_KIMI");
  });

  it.each([
    ".env",
    ".env.production",
    "android/key.properties",
    "android/release.jks",
    "android/zenflow-release.keystore",
    "config/service-account.json",
    "private/credentials.json",
  ])("excludes secret-bearing path %s", (path) => {
    const { classifyMechanicalPolicy } = loadCore();

    expect(
      classifyMechanicalPolicy({
        sourceId: `file:${path}`,
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path,
        sourceSha256: "c".repeat(64),
        mainSha256: null,
      }),
    ).toBe("EXCLUDED_SECRET_PRIVATE");
  });

  it("excludes a regular source file when the content probe found a secret", () => {
    const { classifyMechanicalPolicy } = loadCore();

    expect(
      classifyMechanicalPolicy({
        sourceId: "file:src/config.ts",
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path: "src/config.ts",
        sourceSha256: "d".repeat(64),
        mainSha256: null,
        secretMatches: 1,
      }),
    ).toBe("EXCLUDED_SECRET_PRIVATE");
  });

  it.each([
    "node_modules/pkg/index.js",
    "node_modules.baseline-vite-cache/.vite/deps/react.js",
    "android/app/build/outputs/apk/debug/app-debug.apk",
    "output/recovery/report.json",
    "coverage/index.html",
    "src/.dccache",
    ".codex-recovery/archive/src/App.tsx",
  ])("excludes generated or recovery-container path %s", (path) => {
    const { classifyMechanicalPolicy } = loadCore();

    expect(
      classifyMechanicalPolicy({
        sourceId: `file:${path}`,
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path,
        sourceSha256: "e".repeat(64),
        mainSha256: null,
      }),
    ).toBe("EXCLUDED_GENERATED_CACHE");
  });

  it("separates duplicate Finder copies from canonical logical paths", () => {
    const { classifyMechanicalPolicy } = loadCore();

    expect(
      classifyMechanicalPolicy({
        sourceId: "file:package-2",
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path: "package 2.json",
        sourceSha256: "f".repeat(64),
        mainSha256: null,
      }),
    ).toBe("EXCLUDED_DUPLICATE_COPY");
  });

  it("marks exact current content closed and sends changed content to review", () => {
    const { classifyMechanicalPolicy } = loadCore();
    const sha = "1".repeat(64);

    expect(
      classifyMechanicalPolicy({
        sourceId: "file:exact",
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path: "src/exact.ts",
        sourceSha256: sha,
        mainSha256: sha,
      }),
    ).toBe("ALREADY_CURRENT");
    expect(
      classifyMechanicalPolicy({
        sourceId: "file:changed",
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path: "src/changed.ts",
        sourceSha256: sha,
        mainSha256: "2".repeat(64),
      }),
    ).toBe("REVIEW_REQUIRED");
  });
});

describe("recovery variant grouping", () => {
  it("deduplicates identical blobs and exposes conflicting variants deterministically", () => {
    const { buildVariantGroups } = loadCore();
    const shared = "a".repeat(64);
    const alternate = "b".repeat(64);

    expect(
      buildVariantGroups([
        {
          sourceId: "packet:z",
          sourceKind: "dirty-file",
          path: "src/shared.ts",
          sourceSha256: shared,
        },
        {
          sourceId: "packet:a",
          sourceKind: "dirty-file",
          path: "src/shared.ts",
          sourceSha256: shared,
        },
        {
          sourceId: "packet:m",
          sourceKind: "dirty-file",
          path: "src/shared.ts",
          sourceSha256: alternate,
        },
        {
          sourceId: "packet:single",
          sourceKind: "dirty-file",
          path: "src/alpha.ts",
          sourceSha256: "c".repeat(64),
        },
      ]),
    ).toEqual([
      {
        path: "src/alpha.ts",
        conflict: false,
        variants: [{ sha256: "c".repeat(64), sourceIds: ["packet:single"] }],
      },
      {
        path: "src/shared.ts",
        conflict: true,
        variants: [
          { sha256: shared, sourceIds: ["packet:a", "packet:z"] },
          { sha256: alternate, sourceIds: ["packet:m"] },
        ],
      },
    ]);
  });
});

describe("recovery ledger validation", () => {
  it("requires concrete evidence for semantic closure", () => {
    const { validateDecision } = loadCore();

    expect(() => validateDecision({ disposition: "MERGED", evidence: [] })).toThrow(
      /evidence/i,
    );
    expect(() =>
      validateDecision({
        disposition: "SUPERSEDED_WITH_EVIDENCE",
        evidence: ["src/current.ts#current invariant"],
      }),
    ).not.toThrow();
  });

  it("rejects absolute paths from durable ledger records", () => {
    const { sanitizeLedgerRecord } = loadCore();

    expect(() =>
      sanitizeLedgerRecord({
        sourceId: "/private/example/source",
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path: "src/current.ts",
        sourceSha256: "a".repeat(64),
      }),
    ).toThrow(/absolute/i);
  });

  it("summarizes closed and open records without treating exclusions as open", () => {
    const { summarizeLedger } = loadCore();

    expect(
      summarizeLedger([
        { disposition: "MERGED" },
        { disposition: "ALREADY_CURRENT" },
        { disposition: "EXCLUDED_KIMI" },
        { disposition: "REVIEW_REQUIRED" },
      ]),
    ).toEqual({
      total: 4,
      byDisposition: {
        ALREADY_CURRENT: 1,
        EXCLUDED_KIMI: 1,
        MERGED: 1,
        REVIEW_REQUIRED: 1,
      },
      open: 1,
    });
  });
});

describe("recovery source collection", () => {
  it("collects every exported dirty variant and deletion intent without locators", () => {
    const { collectPacketRecords } = loadCore();
    const exactSha = "1".repeat(64);
    const changedSha = "2".repeat(64);
    const manifest = {
      packetReports: [
        {
          packet: "safe-packet",
          status: "MATERIALIZED",
          source: "/private/example/worktree",
          entries: [
            {
              path: "src/exact.ts",
              disposition: "exported-non-main-variant",
              sha256: exactSha,
              output: "packets/safe/files/src/exact.ts",
            },
            {
              path: "src/changed.ts",
              disposition: "exported-non-main-variant",
              sha256: changedSha,
              output: "packets/safe/files/src/changed.ts",
            },
            {
              path: "src/deleted.ts",
              disposition: "deleted-in-working-variant",
            },
            {
              path: "src/already.ts",
              disposition: "byte-identical-to-main",
            },
          ],
        },
        {
          packet: "people-first-app-codex-kimi-safe-sync",
          status: "MATERIALIZED",
          entries: [
            {
              path: "src/kimi.ts",
              disposition: "exported-non-main-variant",
              sha256: "3".repeat(64),
              output: "packets/kimi/files/src/kimi.ts",
            },
          ],
        },
      ],
    };

    expect(
      collectPacketRecords(manifest, {
        "src/exact.ts": exactSha,
        "src/changed.ts": "4".repeat(64),
        "src/deleted.ts": "5".repeat(64),
        "src/kimi.ts": null,
      }),
    ).toEqual([
      {
        sourceId: `dirty-file:people-first-app-codex-kimi-safe-sync:src/kimi.ts:${"3".repeat(12)}`,
        sourceKind: "dirty-file",
        packet: "people-first-app-codex-kimi-safe-sync",
        path: "src/kimi.ts",
        sourceSha256: "3".repeat(64),
        mainSha256: null,
        changeKind: "file-variant",
        disposition: "EXCLUDED_KIMI",
      },
      {
        sourceId: `dirty-file:safe-packet:src/changed.ts:${changedSha.slice(0, 12)}`,
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path: "src/changed.ts",
        sourceSha256: changedSha,
        mainSha256: "4".repeat(64),
        changeKind: "file-variant",
        disposition: "REVIEW_REQUIRED",
      },
      {
        sourceId: "deletion-intent:safe-packet:src/deleted.ts",
        sourceKind: "deletion-intent",
        packet: "safe-packet",
        path: "src/deleted.ts",
        mainSha256: "5".repeat(64),
        changeKind: "delete",
        disposition: "REVIEW_REQUIRED",
      },
      {
        sourceId: `dirty-file:safe-packet:src/exact.ts:${exactSha.slice(0, 12)}`,
        sourceKind: "dirty-file",
        packet: "safe-packet",
        path: "src/exact.ts",
        sourceSha256: exactSha,
        mainSha256: exactSha,
        changeKind: "file-variant",
        disposition: "ALREADY_CURRENT",
      },
    ]);
  });

  it("collects unique commit heads deterministically", () => {
    const { collectUniqueHeadShas } = loadCore();

    expect(
      collectUniqueHeadShas({
        refs: [
          { classification: "IN_MAIN", head: "f".repeat(40) },
          { classification: "UNIQUE_COMMITS", head: "b".repeat(40) },
          { classification: "UNIQUE_COMMITS", head: "a".repeat(40) },
          { classification: "UNIQUE_COMMITS", head: "b".repeat(40) },
        ],
      }),
    ).toEqual(["a".repeat(40), "b".repeat(40)]);
  });

  it("collects special file variants and excludes the Kimi archive", () => {
    const { collectSpecialRecords } = loadCore();
    const sha = "9".repeat(64);

    expect(
      collectSpecialRecords(
        {
          special: {
            originalPatch: {
              entries: [
                {
                  path: "scripts/current.mjs",
                  disposition: "exported-non-main-variant",
                  sha256: sha,
                  output: "special/original/files/scripts/current.mjs",
                },
              ],
            },
            archives: [
              { name: "kimi-untracked", extractedRegularFiles: 23 },
              { name: "epic002-patch-lane", extractedRegularFiles: 25721 },
            ],
          },
        },
        { "scripts/current.mjs": null },
      ),
    ).toEqual([
      {
        sourceId: "special-archive:epic002-patch-lane",
        sourceKind: "special-archive",
        packet: "epic002-patch-lane",
        changeKind: "archive",
        extractedRegularFiles: 25721,
        disposition: "REVIEW_REQUIRED",
      },
      {
        sourceId: "special-archive:kimi-untracked",
        sourceKind: "special-archive",
        packet: "kimi-untracked",
        changeKind: "archive",
        extractedRegularFiles: 23,
        disposition: "EXCLUDED_KIMI",
      },
      {
        sourceId: `special-file:original-vscode-dirty:scripts/current.mjs:${sha.slice(0, 12)}`,
        sourceKind: "special-file",
        packet: "original-vscode-dirty",
        path: "scripts/current.mjs",
        sourceSha256: sha,
        mainSha256: null,
        changeKind: "file-variant",
        disposition: "REVIEW_REQUIRED",
      },
    ]);
  });

  it("parses add, delete, and rename records from nul-delimited Git output", () => {
    const { parseNameStatusZ } = loadCore();

    expect(
      parseNameStatusZ(
        [
          "A",
          "src/added.ts",
          "D",
          "src/deleted.ts",
          "R098",
          "src/old name.ts",
          "src/new name.ts",
          "",
        ].join("\0"),
      ),
    ).toEqual([
      { status: "A", path: "src/added.ts" },
      { status: "D", path: "src/deleted.ts" },
      {
        status: "R098",
        path: "src/new name.ts",
        previousPath: "src/old name.ts",
      },
    ]);
  });

  it("maps Git tree paths to blob ids without per-file subprocesses", () => {
    const { parseLsTreeZ } = loadCore();

    expect(
      parseLsTreeZ(
        [
          `100644 blob ${"a".repeat(40)}\tsrc/alpha.ts`,
          `100755 blob ${"b".repeat(40)}\tscripts/run.mjs`,
          `160000 commit ${"c".repeat(40)}\tvendor/submodule`,
          "",
        ].join("\0"),
      ),
    ).toEqual({
      "scripts/run.mjs": "b".repeat(40),
      "src/alpha.ts": "a".repeat(40),
    });
  });
});

describe("recovery convergence CLI", () => {
  it("writes a sanitized real-Git ledger with packet and historical counts", () => {
    const root = mkdtempSync(join(tmpdir(), "zenflow-recovery-ledger-"));
    try {
      execFileSync("git", ["init", "-q", root]);
      execFileSync("git", ["-C", root, "config", "user.name", "Test User"]);
      execFileSync("git", ["-C", root, "config", "user.email", "test@example.invalid"]);
      writeFileSync(join(root, "current.txt"), "base\n", "utf8");
      execFileSync("git", ["-C", root, "add", "current.txt"]);
      execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
      const baseSha = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
      writeFileSync(join(root, "current.txt"), "current\n", "utf8");
      writeFileSync(join(root, "historical.txt"), "history\n", "utf8");
      execFileSync("git", ["-C", root, "add", "current.txt", "historical.txt"]);
      execFileSync("git", ["-C", root, "commit", "-qm", "feature"]);
      const mainSha = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();

      const sourceSha = require("node:crypto")
        .createHash("sha256")
        .update("current\n")
        .digest("hex");
      const manifestPath = join(root, "manifest.json");
      const inventoryPath = join(root, "inventory.json");
      const outputPath = join(root, "ledger.json");
      writeFileSync(
        manifestPath,
        JSON.stringify({
          packetReports: [
            {
              packet: "safe-packet",
              status: "MATERIALIZED",
              source: "/private/example/worktree",
              entries: [
                {
                  path: "current.txt",
                  disposition: "exported-non-main-variant",
                  sha256: sourceSha,
                  output: "/private/example/recovery/current.txt",
                },
                {
                  path: "removed.txt",
                  disposition: "deleted-in-working-variant",
                },
              ],
            },
          ],
        }),
        "utf8",
      );
      writeFileSync(
        inventoryPath,
        JSON.stringify({
          refs: [{ classification: "UNIQUE_COMMITS", head: mainSha }],
        }),
        "utf8",
      );

      execFileSync(
        process.execPath,
        [
          "scripts/recovery-file-convergence.mjs",
          "--manifest",
          manifestPath,
          "--inventory",
          inventoryPath,
          "--repo",
          root,
          "--base-sha",
          baseSha,
          "--main-sha",
          mainSha,
          "--output",
          outputPath,
        ],
        { cwd: process.cwd() },
      );

      const text = readFileSync(outputPath, "utf8");
      const ledger = JSON.parse(text) as {
        schema: string;
        summary: {
          dirtyVariants: number;
          deletionIntents: number;
          historicalCommits: number;
          historicalFileChanges: number;
          open: number;
        };
        packetRecords: Array<{ disposition: string; path: string }>;
      };
      expect(text).not.toContain("/private/example");
      expect(ledger.schema).toBe("zenflow-recovery-file-convergence-v1");
      expect(ledger.summary).toMatchObject({
        dirtyVariants: 1,
        deletionIntents: 1,
        historicalCommits: 1,
        historicalFileChanges: 2,
        open: 0,
      });
      expect(ledger.packetRecords).toEqual([
        expect.objectContaining({ path: "current.txt", disposition: "ALREADY_CURRENT" }),
        expect.objectContaining({ path: "removed.txt", disposition: "ALREADY_CURRENT" }),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
