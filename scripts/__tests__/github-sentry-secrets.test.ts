import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/check-github-sentry-secrets.cjs";

function runWithFakeGh(options: {
  secrets: string[];
  variables: string[];
  required?: boolean;
}) {
  const binDir = mkdtempSync(join(tmpdir(), "zenflow-fake-gh-"));
  const ghPath = join(binDir, "gh");
  const fakeGh = [
    "#!/usr/bin/env node",
    "const args = process.argv.slice(2);",
    "if (args[0] === \"repo\" && args[1] === \"view\") { process.stdout.write(\"Yehor212/people-first-app\\n\"); process.exit(0); }",
    "if (args[0] === \"secret\" && args[1] === \"list\") { process.stdout.write(" + JSON.stringify(JSON.stringify(options.secrets.map((name) => ({ name })))) + "); process.exit(0); }",
    "if (args[0] === \"variable\" && args[1] === \"list\") { process.stdout.write(" + JSON.stringify(JSON.stringify(options.variables.map((name) => ({ name })))) + "); process.exit(0); }",
    "process.stderr.write(\"unexpected gh args: \" + args.join(\" \"));",
    "process.exit(2);",
  ].join("\n");
  writeFileSync(ghPath, fakeGh, { mode: 0o755 });

  try {
    return spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: binDir + ":" + (process.env.PATH || ""),
        ZENFLOW_GITHUB_REPO: "",
        ZENFLOW_GITHUB_SENTRY_SECRETS_REQUIRED: options.required ? "true" : "",
      },
      encoding: "utf8",
    });
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
}

describe("check-github-sentry-secrets", () => {
  it("is wired as an npm script and checks the Sentry CI names without value fields", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const source = readFileSync(script, "utf8");

    expect(pkg.scripts?.["check:github-sentry-secrets"]).toBe("node scripts/check-github-sentry-secrets.cjs");
    expect(source).toContain("SENTRY_AUTH_TOKEN");
    expect(source).toContain("VITE_SENTRY_DSN");
    expect(source).toContain("SENTRY_ORG");
    expect(source).toContain("SENTRY_PROJECT");
    expect(source).not.toContain("--json name,value");
    expect(source).not.toContain("valueRedactedLength");
  });

  it("reports PARTIAL by default when names are missing without printing values", () => {
    const result = runWithFakeGh({
      secrets: ["VITE_SENTRY_DSN"],
      variables: [],
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[sentry-github] PARTIAL");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).toContain("SENTRY_ORG");
    expect(result.stdout).toContain("SENTRY_PROJECT");
    expect(result.stdout).not.toContain("sntrys_");
    expect(result.stdout).toContain("docs/SENTRY_LIVE_PROOF.md");
  });

  it("fails in required mode when names are missing", () => {
    const result = runWithFakeGh({
      secrets: ["VITE_SENTRY_DSN"],
      variables: ["SENTRY_ORG"],
      required: true,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[sentry-github] FAIL");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).toContain("SENTRY_PROJECT");
  });

  it("passes when all required GitHub secret and variable names exist", () => {
    const result = runWithFakeGh({
      secrets: ["VITE_SENTRY_DSN", "SENTRY_AUTH_TOKEN"],
      variables: ["SENTRY_ORG", "SENTRY_PROJECT"],
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[sentry-github] PASS");
  });
});
