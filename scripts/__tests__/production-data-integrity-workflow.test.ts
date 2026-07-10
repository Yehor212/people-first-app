import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW = ".github/workflows/production-data-integrity.yml";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function jobBody(workflow: string, jobId: string): string {
  const start = workflow.indexOf(`  ${jobId}:\n`);
  expect(start, `missing job ${jobId}`).toBeGreaterThanOrEqual(0);
  const remainder = workflow.slice(start + jobId.length + 4);
  const nextJob = remainder.search(/^  [a-zA-Z0-9_-]+:\n/m);
  return nextJob < 0 ? remainder : remainder.slice(0, nextJob);
}

function expectSourceBeforeBuildBeforeBundle(body: string, buildCommand: RegExp) {
  const sourceIndex = body.indexOf("npm run check:production-data-integrity");
  const buildMatch = buildCommand.exec(body);
  const bundleIndex = body.indexOf("npm run check:production-data-integrity:bundle");
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  expect(buildMatch?.index ?? -1).toBeGreaterThan(sourceIndex);
  expect(bundleIndex).toBeGreaterThan(buildMatch?.index ?? -1);
}

describe("production-data-integrity CI contract", () => {
  it("provides stable local scripts and orders source and bundle checks around the build", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(packageJson.scripts["check:production-data-integrity"]).toBe(
      "node scripts/check-production-data-integrity.cjs --all",
    );
    expect(packageJson.scripts["check:production-data-integrity:diff"]).toBe(
      "node scripts/check-production-data-integrity.cjs --diff",
    );
    expect(packageJson.scripts["check:production-data-integrity:staged"]).toBe(
      "node scripts/check-production-data-integrity.cjs --staged",
    );
    expect(packageJson.scripts["check:production-data-integrity:bundle"]).toBe(
      "node scripts/check-production-data-integrity.cjs --all --bundle dist",
    );

    const preflight = packageJson.scripts["ci:preflight"];
    const sourceIndex = preflight.indexOf("npm run check:production-data-integrity");
    const buildIndex = preflight.indexOf("npm run build");
    const bundleIndex = preflight.indexOf("npm run check:production-data-integrity:bundle");
    expect(sourceIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(sourceIndex);
    expect(bundleIndex).toBeGreaterThan(buildIndex);
  });

  it("ships one unskippable least-privilege check named production-data-integrity", () => {
    expect(existsSync(WORKFLOW)).toBe(true);
    const workflow = read(WORKFLOW);

    for (const marker of [
      "pull_request:",
      "push:",
      "merge_group:",
      "workflow_dispatch:",
      "branches: [main]",
      "permissions:\n  contents: read",
      "name: production-data-integrity",
      "npx vitest run --configLoader runner scripts/__tests__/production-data-integrity.test.ts scripts/__tests__/production-data-integrity-hook.test.ts scripts/__tests__/production-data-integrity-workflow.test.ts",
      "node scripts/check-production-data-integrity.cjs --all",
      "npm run build",
      "node scripts/check-production-data-integrity.cjs --all --bundle dist",
      "public/pdi-ci-source-canary.json",
      "dist/assets/pdi-ci-bundle-canary.txt",
      'finding.ruleId === "PDI002" && finding.path === canaryPath',
      'finding.ruleId === "PDI009" && finding.path === canaryPath',
      'result.status !== 1 || report.status !== "FAIL" || !exact',
      "fs.rmSync(canaryPath, { force: true })",
      "persist-credentials: false",
    ]) {
      expect(workflow).toContain(marker);
    }

    expect(workflow).not.toMatch(/\bpull_request_target\s*:/);
    expect(workflow).not.toMatch(/\bcontinue-on-error\s*:/);
    expect(workflow).not.toContain("|| true");
    expect(workflow).not.toMatch(/^\s+paths(?:-ignore)?:/m);
    expect(workflow).not.toMatch(/^\s{4}if:/m);
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toMatch(/run:\s*(?:echo|printf).*production-data-integrity/i);
    expect(workflow).not.toContain("run: npm run check:production-data-integrity");

    const testsIndex = workflow.indexOf("npx vitest run --configLoader runner scripts/__tests__/production-data-integrity.test.ts");
    const sourceIndex = workflow.indexOf("node scripts/check-production-data-integrity.cjs --all");
    const buildIndex = workflow.indexOf("npm run build");
    const bundleIndex = workflow.indexOf("node scripts/check-production-data-integrity.cjs --all --bundle dist");
    expect(testsIndex).toBeGreaterThanOrEqual(0);
    expect(sourceIndex).toBeGreaterThan(testsIndex);
    expect(buildIndex).toBeGreaterThan(sourceIndex);
    expect(bundleIndex).toBeGreaterThan(buildIndex);

    const actionRefs = [...workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)].map((match) => match[1]);
    expect(actionRefs.length).toBeGreaterThanOrEqual(2);
    expect(actionRefs.every((ref) => /^[a-f0-9]{40}$/.test(ref))).toBe(true);

    const exactJobNames = readdirSync(".github/workflows")
      .filter((name) => /\.ya?ml$/.test(name))
      .flatMap((name) => read(join(".github/workflows", name)).match(/^\s{4}name:\s*production-data-integrity\s*$/gm) ?? []);
    expect(exactJobNames).toHaveLength(1);
  });

  it("runs the same gate in every production-capable build lifecycle", () => {
    const deploy = read(".github/workflows/deploy.yml");
    expectSourceBeforeBuildBeforeBundle(jobBody(deploy, "build"), /run: npm run build(?:\n|$)/);
    expectSourceBeforeBuildBeforeBundle(jobBody(deploy, "android-gate"), /run: npm run build:android(?:\n|$)/);
    expectSourceBeforeBuildBeforeBundle(jobBody(deploy, "ios-gate"), /run: npm run build:ios(?:\n|$)/);

    const preview = read(".github/workflows/deploy-v2-preview.yml");
    expectSourceBeforeBuildBeforeBundle(jobBody(preview, "build-preview"), /run: npm run build(?:\n|$)/);

    const desktop = read(".github/workflows/desktop-release.yml");
    expectSourceBeforeBuildBeforeBundle(jobBody(desktop, "windows-signed-release"), /run: npm run desktop:build(?:\n|$)/);
  });

  it("keeps enforcement visible to drift, release-contract, and agent-context checks", () => {
    const drift = read(".github/workflows/drift-checks.yml");
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const agentContext = read("scripts/check-agent-context.mjs");
    const enforcement = read("scripts/check-enforcement-health.ts");

    expect(drift).toContain("production-data-integrity");
    expect(drift).toContain("npm run check:production-data-integrity");
    expect(packageJson.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/production-data-integrity-workflow.test.ts",
    );
    expect(agentContext).toContain("assertProductionDataIntegrityContract");
    expect(enforcement).toContain("production-data-integrity-gate.cjs");
    expect(enforcement).toContain("production-data-integrity");
  });
});
