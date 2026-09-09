import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

type DiscoveryReport = {
  numPassedTests: number;
  numFailedTests: number;
  testResults: Array<{ name: string; status: string }>;
};

function runReleaseDiscoveryCase(failCanonicalTest: boolean) {
  const repositoryRoot = process.cwd();
  const packageJson = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  const command = packageJson.scripts["test:release-contracts"]
    .split("&&")
    .map((part) => part.trim())
    .find((part) => part.startsWith("vitest run "));
  if (!command) throw new Error("Release-contract Vitest run segment is missing");
  const tokens = (command.match(/'[^']*'|"[^"]*"|\S+/g) ?? []).map((token) =>
    /^["']/.test(token) ? token.slice(1, -1) : token,
  );
  const parent = resolve(repositoryRoot, "output/android-103ms/release-discovery-20260906/fixtures");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "run-"));
  const put = (file: string, content: string) => {
    const target = resolve(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, { mode: 0o600 });
  };
  const canonicalFiles = [
    "scripts/__tests__/production-data-integrity-workflow.test.ts",
    "scripts/__tests__/smoke-sync-account-boundary.test.ts",
  ];
  canonicalFiles.forEach((file, index) => {
    put(file, `import { expect, it } from "vitest";
it("canonical release contract", () => { expect(1).toBe(${failCanonicalTest && index === 0 ? 2 : 1}); });
`);
    put(`output/archive/${file}`, 'throw new Error("ARCHIVED_FIXTURE_MUST_NOT_EXECUTE");\n');
  });
  put("vitest.config.mts", 'export default { test: { environment: "node" } };\n');
  const reportPath = resolve(root, "run.json");
  // Exercise the actual package arguments. Only fixture root/config and report
  // destination differ; neither the required file list nor exclusions are injected.
  const result = spawnSync(process.execPath, [
    resolve(repositoryRoot, "node_modules/vitest/vitest.mjs"),
    ...tokens.slice(1),
    "--root", root,
    "--config", resolve(root, "vitest.config.mts"),
    "--maxWorkers=1",
    "--reporter=json",
    `--outputFile=${reportPath}`,
  ], { cwd: repositoryRoot, encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as DiscoveryReport;
  return {
    exitCode: result.status,
    report,
    files: report.testResults.map((entry) => relative(root, entry.name).replace(/\\/g, "/")).sort(),
  };
}

describe("package Vitest script isolation", () => {
  it("runs canonical release contracts without executing their archived copies", () => {
    const result = runReleaseDiscoveryCase(false);
    expect(result.exitCode).toBe(0);
    expect(result.report.numPassedTests).toBe(2);
    expect(result.report.numFailedTests).toBe(0);
    expect(result.files).toEqual([
      "scripts/__tests__/production-data-integrity-workflow.test.ts",
      "scripts/__tests__/smoke-sync-account-boundary.test.ts",
    ]);
  }, 30_000);

  it("still rejects a failing canonical release contract with archives present", () => {
    const result = runReleaseDiscoveryCase(true);
    expect(result.exitCode).toBe(1);
    expect(result.report.numPassedTests).toBe(1);
    expect(result.report.numFailedTests).toBe(1);
    expect(result.files).toEqual([
      "scripts/__tests__/production-data-integrity-workflow.test.ts",
      "scripts/__tests__/smoke-sync-account-boundary.test.ts",
    ]);
    expect(result.report.testResults.filter((entry) => entry.status === "failed")).toHaveLength(1);
  }, 30_000);

  it("keeps generated output trees outside repository-wide Vitest discovery", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    const discoveryScripts = ["test", "test:coverage"];
    const unsafeScripts = discoveryScripts.filter((name) => {
      const command = packageJson.scripts?.[name] ?? "";
      return !/\bvitest\s+run\b/.test(command) ||
        !/--exclude\s+(["'])output\/\*\*\1/.test(command);
    });

    expect(unsafeScripts).toEqual([]);
  });

  it("keeps local recovery copies outside every Vitest discovery path", () => {
    const config = readFileSync(
      resolve(process.cwd(), "vitest.config.ts"),
      "utf8"
    );

    expect(config).toContain('".codex-recovery/**"');
  });
});
