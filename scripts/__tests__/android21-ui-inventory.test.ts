import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(TEST_DIR, "../..");
const INVENTORY_PATH = join(ROOT_DIR, "docs/release/android-2.1-ui-inventory.json");
const VALIDATOR_PATH = join(ROOT_DIR, "tools/release/android21-ui-inventory.mjs");
const artifactsPresent = existsSync(INVENTORY_PATH) && existsSync(VALIDATOR_PATH);

interface SurfaceFixture {
  source: {
    sha256: string;
    locators: Array<{ token: string }>;
  };
  focus: { restore?: unknown };
  platformImpact: Record<string, unknown>;
  verification: Record<string, unknown>;
}

interface InventoryFixture {
  surfaces: SurfaceFixture[];
  destinations: Array<{ route: Record<string, unknown> }>;
  exclusions: Array<{ proof: unknown[] }>;
}

function runValidator(inventory?: InventoryFixture) {
  const args = [VALIDATOR_PATH, "--check"];
  if (inventory) args.push("--stdin");
  return spawnSync(process.execPath, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    input: inventory ? JSON.stringify(inventory) : undefined,
  });
}

function withInventoryFixture(
  mutate: (inventory: InventoryFixture) => void,
  assertion: (result: ReturnType<typeof runValidator>) => void
) {
  const inventory = JSON.parse(readFileSync(INVENTORY_PATH, "utf8")) as InventoryFixture;
  mutate(inventory);
  assertion(runValidator(inventory));
}

function combinedOutput(result: ReturnType<typeof runValidator>) {
  return `${result.stdout}\n${result.stderr}`;
}

describe("T181 Android 2.1 UI ownership inventory", () => {
  it("exists with its source-owned validator", () => {
    expect(existsSync(INVENTORY_PATH), "T181 canonical inventory is absent").toBe(true);
    expect(existsSync(VALIDATOR_PATH), "T181 validator is absent").toBe(true);
  });
});

const describeArtifacts = artifactsPresent ? describe : describe.skip;

describeArtifacts("T181 inventory contract and negative controls", () => {
  it("accepts the current exhaustive inventory", () => {
    const result = runValidator();

    expect(combinedOutput(result)).toContain("PASS android21-ui-inventory");
    expect(result.status).toBe(0);
  });

  it("rejects a missing discovered owner", () => {
    withInventoryFixture(
      (inventory) => inventory.surfaces.splice(0, 1),
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toContain("MISSING_DISCOVERED_OWNER");
      }
    );
  });

  it("rejects duplicate stable IDs and owner locators", () => {
    withInventoryFixture(
      (inventory) => inventory.surfaces.push(structuredClone(inventory.surfaces[0])),
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toMatch(/DUPLICATE_(?:ID|OWNER_LOCATOR)/);
      }
    );
  });

  it("rejects a stale source hash", () => {
    withInventoryFixture(
      (inventory) => {
        inventory.surfaces[0].source.sha256 = "0".repeat(64);
      },
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toContain("STALE_SOURCE_HASH");
      }
    );
  });

  it("rejects a stale source locator token", () => {
    withInventoryFixture(
      (inventory) => {
        inventory.surfaces[0].source.locators[0].token = "__missing_t181_locator__";
      },
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toContain("STALE_SOURCE_LOCATOR");
      }
    );
  });

  it("rejects a row that drops a mandatory ownership field", () => {
    withInventoryFixture(
      (inventory) => {
        delete inventory.surfaces[0].focus.restore;
      },
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toContain("MISSING_FIELD");
      }
    );
  });

  it("rejects drift from the exact five-destination contract", () => {
    withInventoryFixture(
      (inventory) => {
        inventory.destinations[0].route.destination = "overview";
      },
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toContain("FIVE_DESTINATION_CONTRACT");
      }
    );
  });

  it("rejects a missing platform applicability row", () => {
    withInventoryFixture(
      (inventory) => {
        delete inventory.surfaces[0].platformImpact.desktop;
      },
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toContain("PLATFORM_MATRIX");
      }
    );
  });

  it("rejects fabricated human or runtime PASS evidence", () => {
    withInventoryFixture(
      (inventory) => {
        inventory.surfaces[0].verification.humanAssistiveTechnology = "PASS";
      },
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toContain("UNSUPPORTED_HUMAN_PASS");
      }
    );
  });

  it("rejects an excluded source candidate without proof", () => {
    withInventoryFixture(
      (inventory) => {
        inventory.exclusions[0].proof = [];
      },
      (result) => {
        expect(result.status).not.toBe(0);
        expect(combinedOutput(result)).toContain("EXCLUSION_WITHOUT_PROOF");
      }
    );
  });
});
