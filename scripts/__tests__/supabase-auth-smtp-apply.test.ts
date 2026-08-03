import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const smtpScript = "../apply-supabase-auth-smtp.cjs";

describe("apply-supabase-auth-smtp", () => {
  it("is wired as a package script and included in release-contract tests", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };

    expect(pkg.scripts?.["apply:supabase-auth-smtp"]).toBe("node scripts/apply-supabase-auth-smtp.cjs --apply");
    expect(pkg.scripts?.["check:supabase-auth-smtp"]).toBe("node scripts/apply-supabase-auth-smtp.cjs --dry-run");
    expect(pkg.scripts?.["test:release-contracts"]).toContain("scripts/__tests__/supabase-auth-smtp-apply.test.ts");
  });

  it("builds a safe Supabase Auth SMTP patch only after explicit confirmation", () => {
    const { buildSmtpPatchPacket } = require(smtpScript) as {
      buildSmtpPatchPacket: (env: Record<string, string>) => { errors: string[]; patch: Record<string, unknown> };
    };

    const missingConfirm = buildSmtpPatchPacket(validEnv({ ZENFLOW_AUTH_SMTP_CONFIRM_PRODUCTION: "" }));
    expect(missingConfirm.errors).toContain("ZENFLOW_AUTH_SMTP_CONFIRM_PRODUCTION must be true before applying production SMTP");

    const packet = buildSmtpPatchPacket(validEnv());
    expect(packet.errors).toEqual([]);
    expect(packet.patch).toMatchObject({
      external_email_enabled: true,
      mailer_secure_email_change_enabled: true,
      mailer_autoconfirm: false,
      smtp_admin_email: "no-reply@auth.zenflowapp.online",
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: "secret-smtp-password",
      smtp_sender_name: "ZenFlow",
      rate_limit_email_sent: 30,
    });
  });

  it("rejects placeholders, unsafe hosts, and invalid ports without echoing secret values", () => {
    const { buildSmtpPatchPacket, formatValidationErrors } = require(smtpScript) as {
      buildSmtpPatchPacket: (env: Record<string, string>) => { errors: string[]; patch: Record<string, unknown> };
      formatValidationErrors: (errors: string[]) => string[];
    };

    const packet = buildSmtpPatchPacket(validEnv({
      ZENFLOW_AUTH_SMTP_HOST: "https://smtp.example.com",
      ZENFLOW_AUTH_SMTP_PORT: "99999",
      ZENFLOW_AUTH_SMTP_PASS: "secret-smtp-password",
      ZENFLOW_AUTH_SMTP_USER: "your-smtp-user",
    }));
    const formatted = formatValidationErrors(packet.errors).join("\n");

    expect(packet.errors).toEqual(expect.arrayContaining([
      "ZENFLOW_AUTH_SMTP_HOST must be a hostname, not a URL",
      "ZENFLOW_AUTH_SMTP_PORT must be an integer from 1 to 65535",
      "ZENFLOW_AUTH_SMTP_USER is missing or placeholder",
    ]));
    expect(formatted).toContain("ZENFLOW_AUTH_SMTP_HOST");
    expect(formatted).not.toContain("secret-smtp-password");
  });



  it("does not verify custom SMTP from smtp_admin_email alone", () => {
    const { hasCustomSmtp } = require(smtpScript) as {
      hasCustomSmtp: (config: Record<string, unknown>) => boolean;
    };

    expect(hasCustomSmtp({ smtp_admin_email: "no-reply@auth.zenflowapp.online" })).toBe(false);
    expect(hasCustomSmtp({ smtp_host: "smtp.resend.com", smtp_admin_email: "no-reply@auth.zenflowapp.online" })).toBe(true);
  });

  it("verifies the hosted email send rate limit after applying SMTP", async () => {
    const { applySupabaseAuthSmtp } = require(smtpScript) as {
      applySupabaseAuthSmtp: (input: {
        env: Record<string, string>;
        dryRun: boolean;
        fetchImpl: typeof fetch;
      }) => Promise<{ status: string; lines: string[] }>;
    };
    let call = 0;
    const fetchImpl = (async () => {
      call += 1;
      return new Response(
        JSON.stringify(
          call === 1
            ? { ok: true }
            : { smtp_host: "smtp.resend.com", smtp_admin_email: "no-reply@auth.zenflowapp.online", rate_limit_email_sent: 2 },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await applySupabaseAuthSmtp({
      env: validEnv(),
      dryRun: false,
      fetchImpl,
    });

    expect(result.status).toBe("UNVERIFIED");
    expect(result.lines.join("\n")).toContain("email send rate limit");
  });

  it("dry-runs without network access and without printing SMTP credentials", async () => {
    const { applySupabaseAuthSmtp } = require(smtpScript) as {
      applySupabaseAuthSmtp: (input: {
        env: Record<string, string>;
        dryRun: boolean;
        fetchImpl: typeof fetch;
      }) => Promise<{ status: string; lines: string[] }>;
    };

    const result = await applySupabaseAuthSmtp({
      env: validEnv(),
      dryRun: true,
      fetchImpl: async () => {
        throw new Error("dry-run should not call fetch");
      },
    });

    expect(result.status).toBe("PASS");
    expect(result.lines.join("\n")).toContain("validated Supabase Auth SMTP patch packet");
    expect(result.lines.join("\n")).not.toContain("secret-smtp-password");
    expect(result.lines.join("\n")).not.toContain("resend");
  });

  it("surfaces sanitized Management API rejection diagnostics without leaking SMTP values", async () => {
    const { applySupabaseAuthSmtp, sanitizeSupabaseErrorText } = require(smtpScript) as {
      applySupabaseAuthSmtp: (input: {
        env: Record<string, string>;
        dryRun: boolean;
        fetchImpl: typeof fetch;
      }) => Promise<{ status: string; lines: string[] }>;
      sanitizeSupabaseErrorText: (text: string, env: Record<string, string>) => string;
    };
    const env = validEnv({
      SUPABASE_ACCESS_TOKEN: "sbp_live_1234567890abcdef1234567890abcdef", // gitleaks:allow - synthetic sanitizer fixture
      ZENFLOW_AUTH_SMTP_PASS: "re_secret_1234567890abcdef", // gitleaks:allow - synthetic sanitizer fixture
    });
    const rawBody = JSON.stringify({
      message:
        "SMTP sender no-reply@auth.zenflowapp.online for smtp.resend.com was rejected for user resend with password re_secret_1234567890abcdef",
      hint: "Verify sender domain before retrying https://example.invalid/debug",
    });

    expect(sanitizeSupabaseErrorText(rawBody, env)).toContain("Verify sender domain before retrying <url>");

    const result = await applySupabaseAuthSmtp({
      env,
      dryRun: false,
      fetchImpl: (async () => new Response(rawBody, { status: 400 })) as typeof fetch,
    });
    const output = result.lines.join("\n");

    expect(result.status).toBe("FAIL");
    expect(output).toContain("HTTP 400");
    expect(output).toContain("Verify sender domain before retrying <url>");
    expect(output).not.toContain("no-reply@auth.zenflowapp.online");
    expect(output).not.toContain("smtp.resend.com");
    expect(output).not.toContain("resend");
    expect(output).not.toContain("re_secret_1234567890abcdef");
    expect(output).not.toContain("sbp_live_1234567890abcdef1234567890abcdef");
  });

  it("applies SMTP settings with the Management API and verifies custom SMTP presence", async () => {
    const { applySupabaseAuthSmtp } = require(smtpScript) as {
      applySupabaseAuthSmtp: (input: {
        env: Record<string, string>;
        dryRun: boolean;
        fetchImpl: typeof fetch;
      }) => Promise<{ status: string; lines: string[] }>;
    };
    const calls: Array<{ url: string; init?: RequestInit; body?: Record<string, unknown> }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: String(url), init, body });
      return new Response(JSON.stringify({ smtp_host: "smtp.resend.com", smtp_admin_email: "no-reply@auth.zenflowapp.online", rate_limit_email_sent: 30 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await applySupabaseAuthSmtp({
      env: validEnv({ SUPABASE_MANAGEMENT_API_BASE_URL: "https://attacker.example/v1" }),
      dryRun: false,
      fetchImpl,
    });

    expect(result.status).toBe("PASS");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("https://api.supabase.com/v1/projects/bwgfslmxmueyglpumkbf/config/auth");
    expect(calls[1]?.url).toBe("https://api.supabase.com/v1/projects/bwgfslmxmueyglpumkbf/config/auth");
    expect(calls[0]?.init?.method).toBe("PATCH");
    expect(calls[0]?.body).toMatchObject({ smtp_pass: "secret-smtp-password", smtp_user: "resend", rate_limit_email_sent: 30 });
    expect(result.lines.join("\n")).not.toContain("secret-smtp-password");
    expect(result.lines.join("\n")).not.toContain("resend");
  });
});

function validEnv(extra: Record<string, string> = {}) {
  return {
    SUPABASE_ACCESS_TOKEN: "sbp_test_1234567890abcdef1234567890abcdef", // gitleaks:allow - synthetic test token
    SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
    ZENFLOW_AUTH_SMTP_CONFIRM_PRODUCTION: "true",
    ZENFLOW_AUTH_SMTP_ADMIN_EMAIL: "no-reply@auth.zenflowapp.online",
    ZENFLOW_AUTH_SMTP_HOST: "smtp.resend.com",
    ZENFLOW_AUTH_SMTP_PORT: "465",
    ZENFLOW_AUTH_SMTP_USER: "resend",
    ZENFLOW_AUTH_SMTP_PASS: "secret-smtp-password",
    ZENFLOW_AUTH_SMTP_SENDER_NAME: "ZenFlow",
    ...extra,
  };
}
