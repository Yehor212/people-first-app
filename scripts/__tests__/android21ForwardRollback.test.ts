import Dexie, { type Table } from "dexie";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const requireForTest = createRequire(import.meta.url);
const { findForwardOnlySchemaIssues } = requireForTest(
  join(process.cwd(), "scripts/check-forward-only-schema.cjs"),
) as {
  findForwardOnlySchemaIssues(options: { rootDir: string }): Array<{
    code: string;
    file: string;
  }>;
};

class V11FixtureDB extends Dexie {
  settings!: Table<{ key: string; value: unknown }, string>;
  automationTransactions!: Table<{ id: string; ownerUserId: string }, string>;
  automationHistoryMarkers!: Table<{ ownerUserId: string; historyGeneration: number }, string>;
  automationRemoteEvents!: Table<{ id: string; ownerUserId: string }, string>;

  constructor(name: string) {
    super(name);
    this.version(10).stores({ settings: "key" });
    this.version(11).stores({
      settings: "key",
      automationTransactions: "id, ownerUserId",
      automationHistoryMarkers: "ownerUserId, historyGeneration",
      automationRemoteEvents: "id, ownerUserId",
    });
  }
}

class LegacyV10FixtureDB extends Dexie {
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor(name: string) {
    super(name);
    this.version(10).stores({ settings: "key" });
  }
}

const fixtureRoots: string[] = [];

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeFixture(root: string, relativePath: string, source: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
}

function createForwardOnlyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "android-forward-rollback-"));
  fixtureRoots.push(root);
  writeFixture(
    root,
    "src/storage/db.ts",
    `export const ZENFLOW_SCHEMA_VERSION = 11;
     this.version(11).stores({
       automationTransactions: "id",
       automationHistoryMarkers: "ownerUserId",
       automationRemoteEvents: "id",
     });
     await db.automationTransactions.clear();
     await db.automationHistoryMarkers.clear();
     await db.automationRemoteEvents.clear();`,
  );
  writeFixture(
    root,
    "docs/CROSS_PLATFORM_RELEASE.md",
    "forward_schema_floor: 11\nlegacy_v10_rollback: forbidden\nrollback_artifact: v11-aware-or-newer\n",
  );
  return root;
}

describe("Android 2.1 forward-only rollback", () => {
  it("upgrades a v10 database to v11 and reopens the current schema without losing legacy rows", async () => {
    const databaseName = `ZenFlowUpgrade-${crypto.randomUUID()}`;
    const legacy = new LegacyV10FixtureDB(databaseName);
    await legacy.open();
    await legacy.settings.put({ key: "legacy-setting", value: "preserved" });
    legacy.close();

    const upgraded = new V11FixtureDB(databaseName);
    await upgraded.open();
    await expect(upgraded.settings.get("legacy-setting")).resolves.toEqual({
      key: "legacy-setting",
      value: "preserved",
    });
    await expect(upgraded.automationTransactions.count()).resolves.toBe(0);
    await expect(upgraded.automationHistoryMarkers.count()).resolves.toBe(0);
    await expect(upgraded.automationRemoteEvents.count()).resolves.toBe(0);
    upgraded.close();

    const reopened = new V11FixtureDB(databaseName);
    try {
      await reopened.open();
      expect(reopened.verno).toBe(11);
      await expect(reopened.settings.get("legacy-setting")).resolves.toBeDefined();
    } finally {
      reopened.close();
      await Dexie.delete(databaseName);
    }
  });

  it("demonstrates that a legacy v10 clear leaves unknown v11 account stores behind", async () => {
    const databaseName = `ZenFlowForwardRollback-${crypto.randomUUID()}`;
    const current = new V11FixtureDB(databaseName);
    await current.open();
    await current.settings.put({ key: "account", value: "owner-a" });
    await current.automationTransactions.put({ id: "tx-a", ownerUserId: "owner-a" });
    await current.automationHistoryMarkers.put({ ownerUserId: "owner-a", historyGeneration: 1 });
    await current.automationRemoteEvents.put({ id: "event-a", ownerUserId: "owner-a" });
    current.close();

    const legacy = new LegacyV10FixtureDB(databaseName);
    await legacy.open();
    expect(legacy.tables.map(({ name }) => name)).not.toContain("automationTransactions");
    expect(legacy.tables.map(({ name }) => name)).not.toContain("automationRemoteEvents");
    await legacy.settings.clear();
    legacy.close();

    const reopened = new V11FixtureDB(databaseName);
    try {
      await reopened.open();
      await expect(reopened.settings.count()).resolves.toBe(0);
      await expect(reopened.automationTransactions.count()).resolves.toBe(1);
      await expect(reopened.automationHistoryMarkers.count()).resolves.toBe(1);
      await expect(reopened.automationRemoteEvents.count()).resolves.toBe(1);
    } finally {
      reopened.close();
      await Dexie.delete(databaseName);
    }
  });

  it("accepts only a v11-aware clear path and forward-only release policy", () => {
    const root = createForwardOnlyFixture();

    expect(findForwardOnlySchemaIssues({ rootDir: root })).toEqual([]);
  });

  it("rejects a v10 rollback policy after v11 distribution", () => {
    const root = createForwardOnlyFixture();
    writeFixture(
      root,
      "docs/CROSS_PLATFORM_RELEASE.md",
      "forward_schema_floor: 10\nlegacy_v10_rollback: allowed\nrollback_artifact: v10\n",
    );

    expect(findForwardOnlySchemaIssues({ rootDir: root }).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "FORWARD_SCHEMA_FLOOR_INVALID",
        "LEGACY_V10_ROLLBACK_ALLOWED",
        "ROLLBACK_ARTIFACT_SCHEMA_UNSAFE",
      ]),
    );
  });

  it("binds the repository release policy to its current v11 clear implementation", () => {
    expect(findForwardOnlySchemaIssues({ rootDir: process.cwd() })).toEqual([]);
  });
});
