import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/check-journal-magic-link-live.cjs";
const scriptPath = join(process.cwd(), script);
const runbookPath = join(process.cwd(), "docs/JOURNAL_MAGIC_LINK_LIVE_PROOF.md");
const proofStatusPath = join(process.cwd(), "docs/JOURNAL_MAGIC_LINK_LIVE_PROOF_STATUS.json");
const releaseChecklistPath = join(process.cwd(), "docs/RELEASE_CHECKLIST.md");
const journalWebAuthBases = ["https://yehor212.github.io/people-first-app", "https://zenflow.app"];
const journalV2Routes = ["orb", "habits", "diary", "planning", "settings"];

function requiredHostedJournalRedirects() {
  return [
    ...journalWebAuthBases.flatMap((base) => [
      `${base}/?journalReset=*`,
      ...journalV2Routes.flatMap((route) => [
        `${base}/${route}?nav=v2&journalReset=*`,
        `${base}/${route}?nav=v2&navLayout=phone&journalReset=*`,
        `${base}/${route}?nav=v2&navLayout=web&journalReset=*`,
      ]),
    ]),
    "com.zenflow.app://login-callback?journalReset=*",
  ].join(",");
}

const require = createRequire(import.meta.url);
const {
  buildJournalMagicLinkRedirectTo,
  checkJournalMagicLinkLive,
  inspectCapturedMagicLinkUrl,
  inspectHostedAuthConfig,
} = require("../check-journal-magic-link-live.cjs") as {
  buildJournalMagicLinkRedirectTo?: (input?: { baseUrl?: string; nonce?: string }) => string;
  checkJournalMagicLinkLive?: (input?: {
    env?: NodeJS.ProcessEnv;
    rootDir?: string;
    fetchImpl?: typeof fetch;
    clientFactory?: (url: string, key: string) => { auth: { signInWithOtp: (payload: unknown) => Promise<{ error: unknown }> } };
  }) => Promise<{ status: string; message: string; exitCode: number; failures?: string[]; unverified?: string[] }>;
  inspectCapturedMagicLinkUrl?: (url: string, expectedNonce: string) => string[];
  inspectHostedAuthConfig?: (
    config: Record<string, unknown>,
    options?: { requireCustomSmtp?: boolean },
  ) => string[];
};
const {
  evaluateJournalMagicLinkProofStatus,
  REQUIRED_ITEM_IDS,
} = require("../check-journal-magic-link-proof-status.cjs") as {
  evaluateJournalMagicLinkProofStatus?: (
    input: unknown,
    options?: { requirePass?: boolean; maxPassAgeDays?: number; now?: Date },
  ) => { ok: boolean; passReady: boolean; issues: Array<{ code: string; itemId?: string }>; items: Array<{ id: string; status: string }> };
  REQUIRED_ITEM_IDS?: string[];
};

function runReadinessInFixture(files: Record<string, string>, env: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), "journal-magic-link-live-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(scriptPath, join(root, script));
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(root, file), content);
  }

  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: "",
      SUPABASE_PROJECT_REF: "",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_SUPABASE_ANON_KEY: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("check-journal-magic-link-live", () => {
  it("accepts the committed journal Magic Link completion audit after external proof exists", () => {
    expect(typeof evaluateJournalMagicLinkProofStatus).toBe("function");
    expect(REQUIRED_ITEM_IDS).toEqual([
      "app_side_reset_guard",
      "ci_secret_scope",
      "github_secret_and_var_names",
      "operator_runbook",
      "hosted_supabase_config",
      "smoke_email_delivery",
      "captured_verify_url_consumed",
      "subagent_reapproval",
    ]);

    const statusPacket = JSON.parse(readFileSync(proofStatusPath, "utf8")) as {
      schemaVersion?: string;
      overallStatus?: string;
      items?: Array<{ id?: string; status?: string; checkedAt?: string; evidence?: string; verification?: string }>;
    };
    const items = statusPacket.items || [];
    const byId = new Map(items.map((item) => [item.id, item]));

    expect(statusPacket.schemaVersion).toBe("zenflow-journal-magic-link-live-proof/v1");
    expect(statusPacket.overallStatus).toBe("PASS");
    expect([...byId.keys()]).toEqual([
      "app_side_reset_guard",
      "ci_secret_scope",
      "github_secret_and_var_names",
      "operator_runbook",
      "hosted_supabase_config",
      "smoke_email_delivery",
      "captured_verify_url_consumed",
      "subagent_reapproval",
    ]);

    for (const item of items.filter((entry) => entry.status === "PASS")) {
      expect(item.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.evidence || "").toMatch(/runtime proof|test|contract|runbook/i);
      expect(item.verification || "").toMatch(/npm|docs\/|\.github|Subagent/i);
    }

    for (const requiredId of REQUIRED_ITEM_IDS || []) {
      expect(byId.get(requiredId)?.status).toBe("PASS");
    }
    expect(JSON.stringify(statusPacket)).not.toMatch(/access_token=[A-Za-z0-9._-]+/);
    expect(JSON.stringify(statusPacket)).not.toMatch(/refresh_token=[A-Za-z0-9._-]+/);

    const report = evaluateJournalMagicLinkProofStatus?.(statusPacket, {
      requirePass: false,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    expect(report).toMatchObject({ ok: true, passReady: true, issues: [] });

    const requiredReport = evaluateJournalMagicLinkProofStatus?.(statusPacket, {
      requirePass: true,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    expect(requiredReport).toMatchObject({ ok: true, passReady: true, issues: [] });
  });

  it("rejects premature PASS and accepts a fully proven synthetic status packet", () => {
    const basePacket = JSON.parse(readFileSync(proofStatusPath, "utf8"));
    const premature = {
      ...basePacket,
      overallStatus: "PASS",
      items: basePacket.items.map((item: { id: string; checkedAt?: string }, index: number) => {
        if (index !== 0) return item;
        const { checkedAt: _checkedAt, ...rest } = item;
        return { ...rest, status: "UNVERIFIED" };
      }),
    };

    expect(evaluateJournalMagicLinkProofStatus?.(premature)?.issues).toContainEqual(
      expect.objectContaining({ code: "premature_overall_pass" }),
    );

    const complete = {
      ...basePacket,
      overallStatus: "PASS",
      items: basePacket.items.map((item: { id: string }) => ({
        ...item,
        status: "PASS",
        checkedAt: "2026-07-04",
        evidence: `Fresh verified proof recorded for ${item.id}.`,
        verification: "npm run check:journal-magic-link-live && npm run check:journal-magic-link-proof-status:pass",
        ownerAction: `Re-check ${item.id} before future journal Magic Link release claims.`,
      })),
    };

    expect(evaluateJournalMagicLinkProofStatus?.(complete, {
      requirePass: true,
      now: new Date("2026-07-04T12:00:00.000Z"),
    })).toMatchObject({ ok: true, passReady: true, issues: [] });
  });

  it("writes a secret-free runtime PASS proof status packet after live workflow proof", () => {
    const root = mkdtempSync(join(tmpdir(), "journal-magic-link-proof-status-"));
    const output = join(root, "runtime-proof.json");
    const result = spawnSync(process.execPath, ["scripts/write-journal-magic-link-proof-status.cjs", "--file", output], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_RUN_URL:
          "https://github.com/Yehor212/people-first-app/actions/runs/123456789",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const packet = JSON.parse(readFileSync(output, "utf8"));
    const evaluation = evaluateJournalMagicLinkProofStatus?.(packet, { requirePass: true });
    const serializedPacket = JSON.stringify(packet);

    expect(packet.overallStatus).toBe("PASS");
    expect(evaluation?.ok).toBe(true);
    expect(evaluation?.passReady).toBe(true);
    expect(serializedPacket).not.toMatch(/token(?:_hash)?=/i);
    expect(serializedPacket).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });

  it("keeps the journal Magic Link live proof runbook wired to release readiness", () => {
    const runbook = readFileSync(runbookPath, "utf8");
    const releaseChecklist = readFileSync(releaseChecklistPath, "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(releaseChecklist).toContain("docs/JOURNAL_MAGIC_LINK_LIVE_PROOF.md");
    expect(packageJson.scripts["check:journal-magic-link-proof-status"]).toBe(
      "node scripts/check-journal-magic-link-proof-status.cjs",
    );
    expect(packageJson.scripts["check:journal-magic-link-proof-status:pass"]).toBe(
      "node scripts/check-journal-magic-link-proof-status.cjs --require-pass",
    );
    expect(packageJson.scripts["write:journal-magic-link-proof-status"]).toBe(
      "node scripts/write-journal-magic-link-proof-status.cjs",
    );
    expect(packageJson.scripts["check:github-journal-magic-link-secrets"]).toBe(
      "node scripts/check-github-journal-magic-link-secrets.cjs",
    );
    expect(packageJson.scripts["check:github-journal-magic-link-secrets:pass"]).toBe(
      "node scripts/check-github-journal-magic-link-secrets.cjs --require-pass",
    );
    expect(packageJson.scripts["check:supabase-auth-smtp"]).toBe("node scripts/apply-supabase-auth-smtp.cjs --dry-run");
    expect(packageJson.scripts["apply:supabase-auth-smtp"]).toBe("node scripts/apply-supabase-auth-smtp.cjs --apply");
    expect(runbook).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED=true npm run check:journal-magic-link-live");
    expect(runbook).toContain("npm run check:github-journal-magic-link-secrets");
    expect(runbook).toContain("npm run check:github-journal-magic-link-secrets:pass");
    expect(runbook).toContain("npm run check:journal-magic-link-proof-status");
    expect(runbook).toContain("npm run check:journal-magic-link-proof-status:pass");
    expect(runbook).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
    expect(runbook).toContain("ZENFLOW_GITHUB_SECRET_CLEANUP_TOKEN");
    expect(runbook).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL=true");
    expect(runbook).toContain("custom SMTP configured");
    expect(runbook).toContain("npm run check:supabase-auth-smtp");
    expect(runbook).toContain("npm run apply:supabase-auth-smtp");
    expect(runbook).toContain("ZENFLOW_AUTH_SMTP_CONFIRM_PRODUCTION");
    expect(runbook).toContain("ZENFLOW_AUTH_SMTP_ADMIN_EMAIL");
    expect(runbook).toContain("ZENFLOW_AUTH_SMTP_HOST");
    expect(runbook).toContain("ZENFLOW_AUTH_SMTP_PORT");
    expect(runbook).toContain("ZENFLOW_AUTH_SMTP_USER");
    expect(runbook).toContain("ZENFLOW_AUTH_SMTP_PASS");
    expect(runbook).toContain("ZENFLOW_AUTH_SMTP_SENDER_NAME");
    expect(runbook).toContain("reputable free SMTP tier");
    expect(runbook).toContain("must stay `UNVERIFIED` for live readiness");
    expect(runbook).not.toContain("accepted SMTP/rate-limit decision");
    expect(runbook).toContain("Supabase `/auth/v1/verify` URL");
    expect(runbook).toContain("Clear or rotate `ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL`");
    expect(runbook).not.toMatch(/access_token=[A-Za-z0-9._-]+/);
    expect(runbook).not.toMatch(/refresh_token=[A-Za-z0-9._-]+/);
  });

  it("reports UNVERIFIED when hosted Supabase proof inputs are missing", () => {
    const result = runReadinessInFixture({});

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-live] UNVERIFIED");
    expect(result.stdout).toContain("SUPABASE_ACCESS_TOKEN");
    expect(result.stdout).toContain("SUPABASE_PROJECT_REF");
  });

  it("exits non-zero in required mode when live proof is unavailable", () => {
    const result = runReadinessInFixture({}, { ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: "true" });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[journal-magic-link-live] UNVERIFIED");
  });

  it("builds a redirect URL with a journalReset proof nonce", () => {
    expect(typeof buildJournalMagicLinkRedirectTo).toBe("function");

    const redirectTo = buildJournalMagicLinkRedirectTo?.({
      baseUrl: "https://yehor212.github.io/people-first-app/diary?nav=v2&navLayout=phone",
      nonce: "abc123",
    });

    expect(redirectTo).toBe(
      "https://yehor212.github.io/people-first-app/diary?nav=v2&navLayout=phone&journalReset=abc123",
    );
  });

  it("requires hosted redirects for every journal Magic Link entrypoint", () => {
    expect(typeof inspectHostedAuthConfig).toBe("function");

    const failures = inspectHostedAuthConfig?.({
      external_email_enabled: true,
      uri_allow_list: [
        "https://yehor212.github.io/people-first-app/?journalReset=*",
        "com.zenflow.app://login-callback?journalReset=*",
      ].join(","),
    });

    expect(failures).toContain(
      "Missing hosted journal Magic Link redirect URL: https://yehor212.github.io/people-first-app/diary?nav=v2&navLayout=phone&journalReset=*",
    );
  });

  it("accepts compact first-party hosted redirect wildcard coverage", () => {
    expect(typeof inspectHostedAuthConfig).toBe("function");

    const failures = inspectHostedAuthConfig?.({
      external_email_enabled: true,
      uri_allow_list: [
        "https://yehor212.github.io/people-first-app/?journalReset=*",
        "https://yehor212.github.io/people-first-app/*\\?*journalReset=*",
        "https://zenflow.app/?journalReset=*",
        "https://zenflow.app/*\\?*journalReset=*",
        "com.zenflow.app://login-callback?journalReset=*",
      ].join(","),
    });

    expect(failures).not.toEqual(
      expect.arrayContaining([expect.stringContaining("Missing hosted journal Magic Link redirect URL")]),
    );
  });

  it("requires custom SMTP evidence for production live mode", () => {
    expect(typeof inspectHostedAuthConfig).toBe("function");

    const failures = inspectHostedAuthConfig?.(
      {
        external_email_enabled: true,
        uri_allow_list: requiredHostedJournalRedirects(),
      },
      { requireCustomSmtp: true },
    );

    expect(failures).toContain("Hosted Supabase custom SMTP is not configured for production Magic Link delivery");
  });

  it("requires a production email send rate limit for production live mode", () => {
    expect(typeof inspectHostedAuthConfig).toBe("function");

    const failures = inspectHostedAuthConfig?.(
      {
        external_email_enabled: true,
        uri_allow_list: requiredHostedJournalRedirects(),
        smtp_host: "smtp.resend.com",
        smtp_admin_email: "no-reply@auth.zenflowapp.online",
        rate_limit_email_sent: 2,
      },
      { requireCustomSmtp: true },
    );

    expect(failures).toContain("Hosted Supabase email send rate limit is below 30 per hour");
  });



  it("does not accept smtp_admin_email by itself as custom SMTP proof", () => {
    expect(typeof inspectHostedAuthConfig).toBe("function");

    const requiredRedirects = requiredHostedJournalRedirects();

    const adminOnlyFailures = inspectHostedAuthConfig?.(
      {
        external_email_enabled: true,
        uri_allow_list: requiredRedirects,
        smtp_admin_email: "no-reply@auth.zenflowapp.online",
      },
      { requireCustomSmtp: true },
    );
    expect(adminOnlyFailures).toContain("Hosted Supabase custom SMTP is not configured for production Magic Link delivery");

    const hostAndAdminFailures = inspectHostedAuthConfig?.(
      {
        external_email_enabled: true,
        uri_allow_list: requiredRedirects,
        smtp_host: "smtp.resend.com",
        smtp_admin_email: "no-reply@auth.zenflowapp.online",
      },
      { requireCustomSmtp: true },
    );
    expect(hostAndAdminFailures).not.toContain("Hosted Supabase custom SMTP is not configured for production Magic Link delivery");

    const nestedHostOnlyFailures = inspectHostedAuthConfig?.(
      {
        external_email_enabled: true,
        uri_allow_list: requiredRedirects,
        auth: { email: { smtp: { host: "smtp.resend.com" } } },
      },
      { requireCustomSmtp: true },
    );
    expect(nestedHostOnlyFailures).toContain("Hosted Supabase custom SMTP is not configured for production Magic Link delivery");

    const nestedUserOnlyFailures = inspectHostedAuthConfig?.(
      {
        external_email_enabled: true,
        uri_allow_list: requiredRedirects,
        auth: { email: { smtp: { user: "resend" } } },
      },
      { requireCustomSmtp: true },
    );
    expect(nestedUserOnlyFailures).toContain("Hosted Supabase custom SMTP is not configured for production Magic Link delivery");

    const nestedCompleteFailures = inspectHostedAuthConfig?.(
      {
        external_email_enabled: true,
        uri_allow_list: requiredRedirects,
        auth: { email: { smtp: { host: "smtp.resend.com", user: "resend" } } },
      },
      { requireCustomSmtp: true },
    );
    expect(nestedCompleteFailures).not.toContain("Hosted Supabase custom SMTP is not configured for production Magic Link delivery");
  });

  it("validates captured email or callback URLs contain the expected journalReset proof", () => {
    expect(typeof inspectCapturedMagicLinkUrl).toBe("function");

    const failures = inspectCapturedMagicLinkUrl?.(
      "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3Dabc123",
      "abc123",
    );

    expect(failures).toEqual([]);
  });

  it("accepts Supabase verify links that use token_hash instead of token", () => {
    expect(typeof inspectCapturedMagicLinkUrl).toBe("function");

    const failures = inspectCapturedMagicLinkUrl?.(
      "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token_hash=secret-hash&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3Dhash123",
      "hash123",
    );

    expect(failures).toEqual([]);
  });

  it("accepts delivered Magic Links from the project custom Supabase Auth domain", () => {
    expect(typeof inspectCapturedMagicLinkUrl).toBe("function");

    const failures = inspectCapturedMagicLinkUrl?.(
      "https://api.zenflowapp.online/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3Dcustom123",
      "custom123",
    );

    expect(failures).toEqual([]);
  });

  it("rejects delivered Magic Links that redirect to zenflow.app until the custom domain is live", () => {
    expect(typeof inspectCapturedMagicLinkUrl).toBe("function");

    const failures = inspectCapturedMagicLinkUrl?.(
      "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fzenflow.app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3Dzenflow123",
      "zenflow123",
    );

    expect(failures).toContain("Captured Magic Link proof URL is not a trusted ZenFlow or Supabase callback");
  });

  it("rejects Supabase verify links without an email token", () => {
    expect(typeof inspectCapturedMagicLinkUrl).toBe("function");

    const failures = inspectCapturedMagicLinkUrl?.(
      "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3Dabc123",
      "abc123",
    );

    expect(failures).toContain("Captured Magic Link proof URL is not a trusted ZenFlow or Supabase callback");
  });

  it("rejects captured URLs that only forge the smoke nonce on an untrusted host", () => {
    expect(typeof inspectCapturedMagicLinkUrl).toBe("function");

    const failures = inspectCapturedMagicLinkUrl?.(
      "https://evil.example/reset?journalReset=00000000000000000000000000000000",
      "00000000000000000000000000000000",
    );

    expect(failures).toContain("Captured Magic Link proof URL is not a trusted ZenFlow or Supabase callback");
  });

  it("rejects trusted callback URLs that were not captured as Supabase verify links", () => {
    expect(typeof inspectCapturedMagicLinkUrl).toBe("function");

    const failures = inspectCapturedMagicLinkUrl?.(
      "https://yehor212.github.io/people-first-app/diary?nav=v2&navLayout=phone&journalReset=abc123",
      "abc123",
    );

    expect(failures).toContain(
      "Captured Magic Link proof must be the Supabase verify URL from the delivered email",
    );
  });

  it("rejects Supabase verify links whose redirect_to is outside canonical journal callback routes", () => {
    expect(typeof inspectCapturedMagicLinkUrl).toBe("function");

    const failures = inspectCapturedMagicLinkUrl?.(
      "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app-unexpected%3FjournalReset%3Dabc123",
      "abc123",
    );

    expect(failures).toContain("Captured Magic Link proof URL is not a trusted ZenFlow or Supabase callback");
  });

  it("requires captured Supabase verify URL consumption before live-required PASS", async () => {
    expect(typeof checkJournalMagicLinkLive).toBe("function");

    const result = await checkJournalMagicLinkLive?.({
      env: {
        SUPABASE_ACCESS_TOKEN: "sbp_secret_not_printed",
        SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
        SUPABASE_MANAGEMENT_API_BASE_URL: "https://attacker.example/v1",
        VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
        ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL: "journal-smoke@example.com",
        ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
          "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
      },
      fetchImpl: (async (url: URL | RequestInfo) => {
        if (String(url).includes("/config/auth")) {
          return new Response(JSON.stringify({
            external_email_enabled: true,
            mailer_smtp_host: "smtp.example.com",
            mailer_smtp_admin_email: "no-reply@auth.zenflowapp.online",
            rate_limit_email_sent: 30,
            uri_allow_list: requiredHostedJournalRedirects(),
          }), { status: 200, headers: { "content-type": "application/json" } });
        }

        return new Response(JSON.stringify({ external_email: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
      clientFactory: () => ({
        auth: {
          signInWithOtp: async () => ({ error: null }),
        },
      }),
    });

    expect(result).toMatchObject({ status: "UNVERIFIED", exitCode: 2 });
    expect(result?.unverified).toContain(
      "Captured Supabase verify URL was not consumed; set ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL=true and ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL=true for full live proof",
    );
  });

  it("can return PASS when hosted config, SMTP, smoke send, and consumed captured URL proof are all present", async () => {
    expect(typeof checkJournalMagicLinkLive).toBe("function");
    const requests: string[] = [];

    const result = await checkJournalMagicLinkLive?.({
      env: {
        SUPABASE_ACCESS_TOKEN: "sbp_secret_not_printed",
        SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
        VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
        ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL: "journal-smoke@example.com",
        ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
          "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
      },
      fetchImpl: (async (url: URL | RequestInfo) => {
        requests.push(String(url));
        if (String(url).includes("/config/auth")) {
          return new Response(JSON.stringify({
            external_email_enabled: true,
            mailer_smtp_host: "smtp.example.com",
            mailer_smtp_admin_email: "no-reply@auth.zenflowapp.online",
            rate_limit_email_sent: 30,
            uri_allow_list: requiredHostedJournalRedirects(),
          }), { status: 200, headers: { "content-type": "application/json" } });
        }

        if (String(url).startsWith("https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify")) {
          return new Response(null, {
            status: 303,
            headers: {
              location:
                "https://yehor212.github.io/people-first-app/diary?nav=v2&navLayout=phone&journalReset=00000000000000000000000000000000&code=auth-code",
            },
          });
        }

        if (String(url).includes("/auth/v1/settings")) {
          return new Response(JSON.stringify({ external_email: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response("not found", { status: 404 });
      }) as typeof fetch,
      clientFactory: () => ({
        auth: {
          signInWithOtp: async () => ({ error: null }),
        },
      }),
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(requests).toEqual([
      "https://api.supabase.com/v1/projects/bwgfslmxmueyglpumkbf/config/auth",
      "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/settings",
      "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
    ]);
  });

  it("consumes the captured verify URL before sending a new smoke Magic Link", async () => {
    expect(typeof checkJournalMagicLinkLive).toBe("function");
    const order: string[] = [];

    const result = await checkJournalMagicLinkLive?.({
      env: {
        SUPABASE_ACCESS_TOKEN: "sbp_secret_not_printed",
        SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
        VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
        ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL: "journal-smoke@example.com",
        ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
          "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
      },
      fetchImpl: (async (url: URL | RequestInfo) => {
        const href = String(url);
        if (href.includes("/config/auth")) {
          return new Response(JSON.stringify({
            external_email_enabled: true,
            mailer_smtp_host: "smtp.example.com",
            mailer_smtp_admin_email: "no-reply@auth.zenflowapp.online",
            rate_limit_email_sent: 30,
            uri_allow_list: requiredHostedJournalRedirects(),
          }), { status: 200, headers: { "content-type": "application/json" } });
        }

        if (href.startsWith("https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify")) {
          order.push("consume-captured-url");
          return new Response(null, {
            status: 303,
            headers: {
              location:
                "https://yehor212.github.io/people-first-app/diary?nav=v2&navLayout=phone&journalReset=00000000000000000000000000000000&code=auth-code",
            },
          });
        }

        if (href.includes("/auth/v1/settings")) {
          return new Response(JSON.stringify({ external_email: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response("not found", { status: 404 });
      }) as typeof fetch,
      clientFactory: () => ({
        auth: {
          signInWithOtp: async () => {
            order.push("send-smoke-link");
            return { error: null };
          },
        },
      }),
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(order).toEqual(["consume-captured-url", "send-smoke-link"]);
  });

  it("fails consumed captured proof when Supabase verify does not redirect to the trusted journal callback", async () => {
    expect(typeof checkJournalMagicLinkLive).toBe("function");

    const result = await checkJournalMagicLinkLive?.({
      env: {
        ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
          "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
      },
      fetchImpl: (async () => new Response(null, {
        status: 302,
        headers: {
          location: "https://evil.example/callback?journalReset=00000000000000000000000000000000&code=auth-code",
        },
      })) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "FAIL", exitCode: 1 });
    expect(result?.failures).toContain(
      "Consumed Supabase verify URL did not redirect to the trusted journal callback with auth proof",
    );
  });

  it("fails consumed captured proof when Supabase redirects to zenflow.app while the custom domain is not live", async () => {
    expect(typeof checkJournalMagicLinkLive).toBe("function");

    const result = await checkJournalMagicLinkLive?.({
      env: {
        ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
          "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
      },
      fetchImpl: (async () => new Response(null, {
        status: 302,
        headers: {
          location:
            "https://zenflow.app/diary?nav=v2&navLayout=phone&journalReset=00000000000000000000000000000000&code=auth-code",
        },
      })) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "FAIL", exitCode: 1 });
    expect(result?.failures).toContain(
      "Consumed Supabase verify URL did not redirect to the trusted journal callback with auth proof",
    );
  });
  it("fails consumed captured proof when Supabase redirects outside canonical journal callback routes", async () => {
    expect(typeof checkJournalMagicLinkLive).toBe("function");

    const result = await checkJournalMagicLinkLive?.({
      env: {
        ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
          "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
      },
      fetchImpl: (async () => new Response(null, {
        status: 302,
        headers: {
          location:
            "https://yehor212.github.io/people-first-app-unexpected?journalReset=00000000000000000000000000000000&code=auth-code",
        },
      })) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "FAIL", exitCode: 1 });
    expect(result?.failures).toContain(
      "Consumed Supabase verify URL did not redirect to the trusted journal callback with auth proof",
    );
  });

  it("sends the smoke Magic Link only behind explicit send and real-email consent", async () => {
    expect(typeof checkJournalMagicLinkLive).toBe("function");
    const calls: unknown[] = [];

    const result = await checkJournalMagicLinkLive?.({
      env: {
        VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
        ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL: "true",
        ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL: "journal-smoke@example.com",
        ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
          "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
      },
      clientFactory: () => ({
        auth: {
          signInWithOtp: async (payload: unknown) => {
            calls.push(payload);
            return { error: null };
          },
        },
      }),
    });

    expect(result).toMatchObject({ status: "UNVERIFIED", exitCode: 0 });
    expect(calls).toEqual([
      {
        email: "journal-smoke@example.com",
        options: {
          shouldCreateUser: false,
          emailRedirectTo:
            "https://yehor212.github.io/people-first-app/diary?nav=v2&navLayout=phone&journalReset=00000000000000000000000000000000",
        },
      },
    ]);
  });
});
