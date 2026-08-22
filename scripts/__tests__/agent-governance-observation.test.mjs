import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path, { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const CORE_URL = pathToFileURL(
  resolve("scripts/persistent-agent-orchestra/governance-observation-core.mjs"),
).href;
const OBSERVATION_CLI = resolve("scripts/run-agent-governance-observation.mjs");
const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function makeRoot(prefix = "zenflow-governance-observation-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function loadCore() {
  return import(CORE_URL);
}

function createReceipt(core) {
  return core.createLocalObservationReceipt({
    now: new Date("2026-08-04T12:00:00.000Z"),
    hookRelativePath: ".codex/hooks/skill-router-gate.cjs",
    hookSource: "#!/usr/bin/env node\nprocess.stdout.write('{}\\n');\n",
    hookEventName: "PreToolUse",
    exitClass: "ALLOW",
    primaryDecision: "ALLOW",
  });
}

describe("agent governance local observation", () => {
  it("creates an allowlisted local-only receipt and rejects host or private fields", async () => {
    const core = await loadCore();
    const receipt = createReceipt(core);

    expect(core.validateLocalObservationReceipt(receipt).errors).toEqual([]);
    expect(receipt.evidence_class).toBe("LOCAL_PROCESS_OBSERVED");
    expect(receipt.host_runtime).toEqual({
      custom_profile_loading: "UNVERIFIED",
      effective_permissions: "UNVERIFIED",
      lifecycle_delivery: "UNVERIFIED",
    });
    expect(core.validateLocalObservationReceipt({
      ...receipt,
      host_runtime: { ...receipt.host_runtime, effective_permissions: "VERIFIED" },
    }).errors.join("\n")).toContain("effective_permissions must stay UNVERIFIED");
    expect(core.validateLocalObservationReceipt({ ...receipt, raw_prompt: "must not persist" }).errors.join("\n")).toContain(
      "unknown key",
    );
  });

  it("runs one controlled local hook process without creating an output receipt by default", async () => {
    const core = await loadCore();
    const root = makeRoot();
    const hookPath = join(root, ".codex", "hooks", "skill-router-gate.cjs");
    mkdirSync(path.dirname(hookPath), { recursive: true });
    writeFileSync(
      hookPath,
      [
        "process.stdin.resume();",
        "process.stdin.on('end', () => process.stdout.write(JSON.stringify({}) + '\\n'));",
      ].join("\n"),
      "utf8",
    );

    const receipt = await core.observeLocalSkillRoutingHook({
      rootDir: root,
      now: new Date("2026-08-04T12:00:00.000Z"),
    });

    expect(core.validateLocalObservationReceipt(receipt).errors).toEqual([]);
    expect(receipt.observation).toMatchObject({ hook_event_name: "PreToolUse", exit_class: "ALLOW" });
    expect(existsSync(join(root, "output", "agent-orchestra"))).toBe(false);
  });

  it("creates exactly one private receipt only at a new safe output path", async () => {
    const core = await loadCore();
    const root = makeRoot();
    const relativePath = "output/agent-orchestra/local-observation.json";

    await core.writeCreateOnlyObservationReceipt({ rootDir: root, relativePath, content: "{}\n" });
    const target = join(root, relativePath);
    expect(readFileSync(target, "utf8")).toBe("{}\n");
    expect(lstatSync(target).mode & 0o777).toBe(0o600);
    await expect(
      core.writeCreateOnlyObservationReceipt({ rootDir: root, relativePath, content: "replacement\n" }),
    ).rejects.toThrow("already exists");
    await expect(
      core.writeCreateOnlyObservationReceipt({
        rootDir: root,
        relativePath: "../outside.json",
        content: "{}\n",
      }),
    ).rejects.toThrow("output/agent-orchestra");
  });

  it("rejects an output directory symlink instead of escaping the worktree", async () => {
    const core = await loadCore();
    const root = makeRoot();
    const outside = makeRoot("zenflow-governance-observation-outside-");
    mkdirSync(join(root, "output"), { recursive: true });
    symlinkSync(outside, join(root, "output", "agent-orchestra"), "dir");

    await expect(
      core.writeCreateOnlyObservationReceipt({
        rootDir: root,
        relativePath: "output/agent-orchestra/local-observation.json",
        content: "{}\n",
      }),
    ).rejects.toThrow("symlink");
  });

  it("exposes the operator command as stdout JSON without an output argument", () => {
    const result = spawnSync(process.execPath, [OBSERVATION_CLI], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    const receipt = JSON.parse(result.stdout);
    expect(receipt.evidence_class).toBe("LOCAL_PROCESS_OBSERVED");
    expect(JSON.stringify(receipt)).not.toContain("raw_prompt");
  });
});
