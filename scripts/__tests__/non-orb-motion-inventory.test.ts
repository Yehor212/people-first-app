import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(TEST_DIR, "../..");
const TOOL_PATH = join(ROOT_DIR, "tools/release/non-orb-motion-inventory.mjs");
const INVENTORY_PATH = join(ROOT_DIR, "docs/release/non-orb-motion-inventory.json");
const tempRoots: string[] = [];

interface Inventory {
  summary: {
    coveragePercent: number;
    validatorFailures: string[];
    motionOwnerRows: number;
    orbExclusionRows: number;
  };
  motionOwners: Array<Record<string, unknown>>;
  orbExclusions: Array<Record<string, unknown>>;
  sourceOracle: {
    candidateFileLedger: Array<{ file: string; ownerIds: string[] }>;
  };
}

function runTool(args: string[], input?: unknown) {
  return spawnSync(process.execPath, [TOOL_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
    input: input === undefined ? undefined : JSON.stringify(input) + "\n",
  });
}

function combined(result: ReturnType<typeof runTool>) {
  return result.stdout + "\n" + result.stderr;
}

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "zenflow-t191-motion-"));
  tempRoots.push(root);
  mkdirSync(join(root, "src/components/state-of-mind"), { recursive: true });
  writeFileSync(
    join(root, "src/main.tsx"),
    [
      'import { FixtureMotion } from "./FixtureMotion";',
      'import { ValenceOrb } from "./components/state-of-mind/ValenceOrb";',
      "void FixtureMotion;",
      "void ValenceOrb;",
      "",
    ].join("\n")
  );
  writeFileSync(
    join(root, "src/FixtureMotion.tsx"),
    [
      'import { motion } from "framer-motion";',
      "export function FixtureMotion() {",
      "  const timer = setTimeout(() => document.body.animate([{ opacity: 0 }, { opacity: 1 }]), 20);",
      "  clearTimeout(timer);",
      '  return <motion.div className="transition-opacity" animate={{ opacity: 1 }} />;',
      "}",
      "",
    ].join("\n")
  );
  writeFileSync(
    join(root, "src/components/state-of-mind/ValenceOrb.tsx"),
    [
      "export function ValenceOrb() {",
      "  const frame = requestAnimationFrame(() => undefined);",
      "  cancelAnimationFrame(frame);",
      '  return <canvas data-orb-renderer-tier="webgl-main" />;',
      "}",
      "",
    ].join("\n")
  );
  writeFileSync(join(root, "package.json"), '{"name":"t191-fixture","private":true}\n');
  return root;
}

afterEach(() => {
  while (tempRoots.length) rmSync(tempRoots.pop()!, { recursive: true, force: true });
});

describe("T191 non-orb motion inventory", () => {
  it("has a source-owned generator and canonical inventory", () => {
    expect(existsSync(TOOL_PATH), "T191 generator is absent").toBe(true);
    expect(existsSync(INVENTORY_PATH), "T191 canonical inventory is absent").toBe(true);
  });

  it("validates 100 percent discovery coverage with no validator failures", () => {
    const result = runTool(["--check"]);
    expect(combined(result)).toContain("PASS non-orb-motion-inventory");
    expect(result.status).toBe(0);

    const inventory = JSON.parse(readFileSync(INVENTORY_PATH, "utf8")) as Inventory;
    expect(inventory.summary.coveragePercent).toBe(100);
    expect(inventory.summary.validatorFailures).toEqual([]);
    expect(inventory.summary.motionOwnerRows).toBeGreaterThan(0);
    expect(inventory.summary.orbExclusionRows).toBeGreaterThan(0);
  }, 30_000);

  it("emits byte-identical deterministic output", () => {
    const first = runTool(["--print"]);
    const second = runTool(["--print"]);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  }, 30_000);

  it("detects a newly introduced reachable motion fixture and proof-binds the orb exclusion", () => {
    const root = fixtureRoot();
    const result = runTool(["--root", root, "--print"]);
    expect(result.status).toBe(0);
    const inventory = JSON.parse(result.stdout) as Inventory;

    expect(
      inventory.motionOwners.some(
        (row) => (row.source as { symbol?: string }).symbol === "FixtureMotion"
      )
    ).toBe(true);
    expect(
      inventory.orbExclusions.some(
        (row) => (row.source as { symbol?: string }).symbol === "ValenceOrb"
      )
    ).toBe(true);
    expect(inventory.summary.coveragePercent).toBe(100);
  });

  it("excludes generated Capacitor assets from the source inventory", () => {
    const root = fixtureRoot();
    const generatedDir = join(root, "android/app/src/main/assets/public/assets");
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(
      join(generatedDir, "generated.js"),
      "requestAnimationFrame(() => document.body.animate([]));\n"
    );

    const result = runTool(["--root", root, "--print"]);
    expect(result.status).toBe(0);
    const inventory = JSON.parse(result.stdout) as Inventory;
    expect(
      inventory.sourceOracle.candidateFileLedger.some((row) =>
        row.file.startsWith("android/app/src/main/assets/")
      )
    ).toBe(false);
  });

  it("rejects a proof-bound orb exclusion when it is mislabeled", () => {
    const inventory = JSON.parse(readFileSync(INVENTORY_PATH, "utf8")) as Inventory;
    const mutated = structuredClone(inventory);
    (mutated.orbExclusions[0] as { classification?: string }).classification = "non-orb";

    const result = runTool(["--check", "--stdin"], mutated);
    expect(result.status).not.toBe(0);
    expect(combined(result)).toContain("ORB_EXCLUSION_MISLABELED");
  }, 30_000);

  it("rejects a missing discovered motion owner", () => {
    const inventory = JSON.parse(readFileSync(INVENTORY_PATH, "utf8")) as Inventory;
    const mutated = structuredClone(inventory);
    mutated.motionOwners.splice(0, 1);

    const result = runTool(["--check", "--stdin"], mutated);
    expect(result.status).not.toBe(0);
    expect(combined(result)).toContain("MISSING_DISCOVERED_OWNER");
  }, 30_000);

  it("rejects an oracle classification that points to an unknown owner", () => {
    const inventory = JSON.parse(readFileSync(INVENTORY_PATH, "utf8")) as Inventory;
    const mutated = structuredClone(inventory);
    const classified = mutated.sourceOracle.candidateFileLedger.find(
      (row) => row.ownerIds.length > 0
    );
    expect(classified).toBeDefined();
    classified!.ownerIds[0] = "t191-owner-that-does-not-exist";

    const result = runTool(["--check", "--stdin"], mutated);
    expect(result.status).not.toBe(0);
    expect(combined(result)).toContain("SOURCE_ORACLE_UNKNOWN_OWNER");
  }, 30_000);
});
