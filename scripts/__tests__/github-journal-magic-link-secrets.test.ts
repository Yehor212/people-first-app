import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/check-github-journal-magic-link-secrets.cjs";

const smtpSecrets = [
  "ZENFLOW_AUTH_SMTP_ADMIN_EMAIL",
  "ZENFLOW_AUTH_SMTP_HOST",
  "ZENFLOW_AUTH_SMTP_PORT",
  "ZENFLOW_AUTH_SMTP_USER",
  "ZENFLOW_AUTH_SMTP_PASS",
  "ZENFLOW_AUTH_SMTP_SENDER_NAME",
] as const;

function runWithFakeGh(options: {
  secrets: string[];
  variables: string[];
  required?: boolean;
}) {
  const binDir = mkdtempSync(join(tmpdir(), "zenflow-fake-gh-journal-"));
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
        ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_SECRETS_REQUIRED: options.required ? "true" : "",
      },
      encoding: "utf8",
    });
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
}


function runWithPresenceEnv(options: {
  presentSecrets: string[];
  presentVariables: string[];
  required?: boolean;
}) {
  const binDir = mkdtempSync(join(tmpdir(), "zenflow-no-gh-journal-"));
  try {
    const env: Record<string, string> = {
      ...process.env,
      PATH: binDir,
      ZENFLOW_GITHUB_REPO: "Yehor212/people-first-app",
      ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_FROM_ENV: "true",
      ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_SECRETS_REQUIRED: options.required ? "true" : "",
    };

    for (const name of options.presentSecrets) {
      env[`ZENFLOW_GITHUB_SECRET_${name}_PRESENT`] = "true";
    }
    for (const name of options.presentVariables) {
      env[`ZENFLOW_GITHUB_VARIABLE_${name}_PRESENT`] = "true";
    }

    return spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    });
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
}
describe("check-github-journal-magic-link-secrets", () => {
  it("is wired as npm scripts and checks journal Magic Link GitHub names without value fields", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const source = readFileSync(script, "utf8");

    expect(pkg.scripts?.["check:github-journal-magic-link-secrets"]).toBe(
      "node scripts/check-github-journal-magic-link-secrets.cjs",
    );
    expect(pkg.scripts?.["check:github-journal-magic-link-secrets:pass"]).toBe(
      "node scripts/check-github-journal-magic-link-secrets.cjs --require-pass",
    );
    expect(pkg.scripts?.["test:release-contracts"]).toContain("scripts/__tests__/github-journal-magic-link-secrets.test.ts");
    expect(source).toContain("SUPABASE_ACCESS_TOKEN");
    expect(source).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
    for (const name of smtpSecrets) expect(source).toContain(name);
    expect(source).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(source).toContain("VITE_SUPABASE_ANON_KEY");
    expect(source).toContain("SUPABASE_PROJECT_REF");
    expect(source).not.toContain("--json name,value");
    expect(source).not.toContain("valueRedactedLength");
  });

  it("reports PARTIAL by default when names are missing without printing values", () => {
    const result = runWithFakeGh({
      secrets: ["VITE_SUPABASE_URL", "SUPABASE_ACCESS_TOKEN"],
      variables: ["SUPABASE_PROJECT_REF"],
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-github] PARTIAL");
    expect(result.stdout).toContain("VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY");
    expect(result.stdout).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL");
    expect(result.stdout).toContain("ZENFLOW_AUTH_SMTP_PASS");
    expect(result.stdout).toContain("VITE_JOURNAL_MAGIC_LINK_LIVE_READY");
    expect(result.stdout).not.toContain("sbp_");
    expect(result.stdout).not.toContain("/auth/v1/verify");
    expect(result.stdout).toContain("docs/JOURNAL_MAGIC_LINK_LIVE_PROOF.md");
  });

  it("fails in required mode when names are missing", () => {
    const result = runWithFakeGh({
      secrets: ["VITE_SUPABASE_URL", "SUPABASE_ACCESS_TOKEN", "VITE_SUPABASE_PUBLISHABLE_KEY"],
      variables: ["SUPABASE_PROJECT_REF", "VITE_JOURNAL_MAGIC_LINK_LIVE_READY"],
      required: true,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[journal-magic-link-github] FAIL");
    expect(result.stdout).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL");
    expect(result.stdout).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL");
    expect(result.stdout).toContain("ZENFLOW_AUTH_SMTP_HOST");
  });

  it("passes when all required GitHub secret and variable names exist with the modern publishable key", () => {
    const result = runWithFakeGh({
      secrets: [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_ACCESS_TOKEN",
        "ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL",
        "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL",
        ...smtpSecrets,
      ],
      variables: [
        "SUPABASE_PROJECT_REF",
        "VITE_JOURNAL_MAGIC_LINK_LIVE_READY",
        "ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL",
      ],
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-github] PASS");
  });

  it("also accepts the legacy anon key while workflows migrate", () => {
    const result = runWithFakeGh({
      secrets: [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY",
        "SUPABASE_ACCESS_TOKEN",
        "ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL",
        "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL",
        ...smtpSecrets,
      ],
      variables: [
        "SUPABASE_PROJECT_REF",
        "VITE_JOURNAL_MAGIC_LINK_LIVE_READY",
        "ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL",
      ],
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-github] PASS");
  });
  it("uses GitHub Actions boolean presence flags without requiring gh or printing values", () => {
    const result = runWithPresenceEnv({
      presentSecrets: [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_ACCESS_TOKEN",
        "ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL",
      ],
      presentVariables: [
        "SUPABASE_PROJECT_REF",
        "VITE_JOURNAL_MAGIC_LINK_LIVE_READY",
        "ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL",
      ],
      required: true,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[journal-magic-link-github] FAIL");
    expect(result.stdout).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
    expect(result.stdout).not.toContain("/auth/v1/verify");
    expect(result.stdout).not.toContain("@example");
    expect(result.stderr).not.toContain("gh");
  });

  it("passes GitHub Actions boolean presence mode when all required names are present", () => {
    const result = runWithPresenceEnv({
      presentSecrets: [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_ACCESS_TOKEN",
        "ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL",
        "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL",
        ...smtpSecrets,
      ],
      presentVariables: [
        "SUPABASE_PROJECT_REF",
        "VITE_JOURNAL_MAGIC_LINK_LIVE_READY",
        "ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL",
      ],
      required: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-github] PASS");
  });
});
