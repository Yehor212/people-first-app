import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  checkWorkspace,
  isExactIsoDate,
  syncWorkspace,
  validateRegistry,
} from "../persistent-agent-orchestra/registry-core.mjs";

const REPO_ROOT = process.cwd();
const FIXED_NOW = new Date("2026-07-13T05:00:00.000Z");
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })),
  );
});

describe("persistent agent orchestra registry", () => {
  it("accepts the canonical exact-ten registry", async () => {
    const registry = await readCanonicalRegistry();
    const waivers = await readCanonicalWaivers();

    expect(validateRegistry(registry, { now: FIXED_NOW, waivers })).toEqual({
      errors: [],
      warnings: [],
    });
    expect(registry.roles).toHaveLength(10);
    expect(registry.roles.map((role) => role.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it.each([
    ["nine roles", (registry) => registry.roles.pop(), "exactly 10"],
    ["eleven roles", (registry) => registry.roles.push({ ...registry.roles[8], slot: 11 }), "exactly 10"],
    ["duplicate slot", (registry) => { registry.roles[1].slot = 1; }, "duplicate role slot"],
    ["duplicate id", (registry) => { registry.roles[1].id = registry.roles[0].id; }, "duplicate role id"],
    ["duplicate runtime name", (registry) => { registry.roles[1].runtime_name = registry.roles[0].runtime_name; }, "duplicate runtime_name"],
    ["missing blind pass A", (registry) => { delete registry.roles[9].review_protocol.pass_a; }, "role 10 pass_a"],
    ["missing blind pass B", (registry) => { delete registry.roles[9].review_protocol.pass_b; }, "role 10 pass_b"],
  ])("rejects %s", async (_label, mutate, expectedMessage) => {
    const registry = await readCanonicalRegistry();
    mutate(registry);

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain(expectedMessage);
  });

  it("validates calendar dates without Date.parse normalization", () => {
    expect(isExactIsoDate("2026-02-28")).toBe(true);
    expect(isExactIsoDate("2026-02-29")).toBe(false);
    expect(isExactIsoDate("2024-02-29")).toBe(true);
    expect(isExactIsoDate("2026-02-31")).toBe(false);
    expect(isExactIsoDate("2026-2-03")).toBe(false);
  });

  it("fails a stale operational source without a valid external waiver", async () => {
    const registry = await readCanonicalRegistry();
    registry.source_review.sources[0].reviewed_on = "2020-01-01";

    const result = validateRegistry(registry, {
      now: FIXED_NOW,
      waivers: await readCanonicalWaivers(),
    });

    expect(result.errors.join("\n")).toContain("stale source");
  });

  it("writes and checks a complete deterministic workspace", async () => {
    const rootDir = await createWorkspace();

    await syncWorkspace({ rootDir, mode: "write", now: FIXED_NOW });
    const result = await checkWorkspace({ rootDir, now: FIXED_NOW });

    expect(result.errors).toEqual([]);
    expect(result.profilePaths).toHaveLength(10);
  });

  it("fails closed when a required generated profile is missing", async () => {
    const rootDir = await createGeneratedWorkspace();
    await unlink(path.join(rootDir, ".codex/agents/10-independent-blind-spot-sentinel.toml"));

    const result = await checkWorkspace({ rootDir, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("missing managed artifact");
  });

  it("rejects an undeclared project profile", async () => {
    const rootDir = await createGeneratedWorkspace();
    await writeFile(
      path.join(rootDir, ".codex/agents/11-generic-reviewer.toml"),
      'name = "zenflow-11-generic-reviewer"\n',
      "utf8",
    );

    const result = await checkWorkspace({ rootDir, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("undeclared project profile");
  });

  it("rejects byte drift in a generated profile", async () => {
    const rootDir = await createGeneratedWorkspace();
    const profilePath = path.join(rootDir, ".codex/agents/02-psychology-human-factors-emotional-safety.toml");
    const current = await readFile(profilePath, "utf8");
    await writeFile(profilePath, `${current}\n# hand edited\n`, "utf8");

    const result = await checkWorkspace({ rootDir, now: FIXED_NOW });

    expect(result.errors.join("\n")).toContain("managed artifact drift");
  });
});

async function readCanonicalRegistry() {
  return JSON.parse(
    await readFile(path.join(REPO_ROOT, "config/persistent-agent-orchestra.json"), "utf8"),
  );
}

async function readCanonicalWaivers() {
  return JSON.parse(
    await readFile(
      path.join(REPO_ROOT, "config/persistent-agent-orchestra.source-waivers.json"),
      "utf8",
    ),
  );
}

async function createWorkspace() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "zenflow-agent-orchestra-"));
  temporaryRoots.push(rootDir);
  await mkdir(path.join(rootDir, "config"), { recursive: true });
  await mkdir(path.join(rootDir, "docs/ai"), { recursive: true });
  await writeFile(
    path.join(rootDir, "config/persistent-agent-orchestra.json"),
    await readFile(path.join(REPO_ROOT, "config/persistent-agent-orchestra.json"), "utf8"),
    "utf8",
  );
  await writeFile(
    path.join(rootDir, "config/persistent-agent-orchestra.source-waivers.json"),
    await readFile(
      path.join(REPO_ROOT, "config/persistent-agent-orchestra.source-waivers.json"),
      "utf8",
    ),
    "utf8",
  );
  return rootDir;
}

async function createGeneratedWorkspace() {
  const rootDir = await createWorkspace();
  await syncWorkspace({ rootDir, mode: "write", now: FIXED_NOW });
  return rootDir;
}
