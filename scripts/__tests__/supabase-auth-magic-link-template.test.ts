import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const templateScript = "../apply-supabase-auth-magic-link-template.cjs";

describe("scanner-safe Supabase Magic Link template", () => {
  it("is wired into package scripts and the manual live-proof workflow", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    const workflow = readFileSync(
      ".github/workflows/journal-magic-link-live-proof.yml",
      "utf8",
    );

    expect(pkg.scripts?.["check:supabase-auth-magic-link-template"]).toBe(
      "node scripts/apply-supabase-auth-magic-link-template.cjs --dry-run",
    );
    expect(pkg.scripts?.["apply:supabase-auth-magic-link-template"]).toBe(
      "node scripts/apply-supabase-auth-magic-link-template.cjs --apply",
    );
    expect(workflow).toContain("npm run check:supabase-auth-magic-link-template");
    expect(workflow).toContain("npm run apply:supabase-auth-magic-link-template");
  });

  it("builds an explicit-action fragment link without embedding a consuming URL", () => {
    const { buildMagicLinkTemplatePatch } = require(templateScript) as {
      buildMagicLinkTemplatePatch: (env: Record<string, string>) => {
        errors: string[];
        patch: Record<string, string>;
      };
    };
    const packet = buildMagicLinkTemplatePatch(validEnv());
    const html = packet.patch.mailer_templates_magic_link_content;

    expect(packet.errors).toEqual([]);
    expect(html).toContain("{{ .RedirectTo }}#zenflowConfirm=1");
    expect(html).toContain("token_hash={{ .TokenHash }}");
    expect(html).toContain("type=email");
    expect(html).not.toContain("{{ .ConfirmationURL }}");
  });

  it("rejects hosted config that still sends a consuming confirmation URL", () => {
    const { inspectHostedMagicLinkTemplate } = require(templateScript) as {
      inspectHostedMagicLinkTemplate: (config: Record<string, unknown>) => string[];
    };

    expect(
      inspectHostedMagicLinkTemplate({
        mailer_templates_magic_link_content:
          '<a href="{{ .ConfirmationURL }}">Sign in</a>',
      }),
    ).toContain("Hosted Magic Link template is not scanner-safe");
  });

  it("patches, reads back, and verifies the hosted template without logging credentials", async () => {
    const { applySupabaseAuthMagicLinkTemplate } = require(templateScript) as {
      applySupabaseAuthMagicLinkTemplate: (options: {
        env: Record<string, string>;
        dryRun: boolean;
        fetchImpl: typeof fetch;
      }) => Promise<{ status: string; lines: string[] }>;
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mailer_templates_magic_link_content:
              '<a href="{{ .RedirectTo }}#zenflowConfirm=1&amp;token_hash={{ .TokenHash }}&amp;type=email">Continue</a>',
          }),
          { status: 200 },
        ),
      );

    const result = await applySupabaseAuthMagicLinkTemplate({
      env: validEnv(),
      dryRun: false,
      fetchImpl,
    });

    expect(result.status).toBe("PASS");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
    expect(result.lines.join("\n")).not.toContain(validEnv().SUPABASE_ACCESS_TOKEN);
  });
});

function validEnv(): Record<string, string> {
  return {
    SUPABASE_ACCESS_TOKEN: "sbp_test_1234567890abcdef1234567890abcdef",
    SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
    ZENFLOW_AUTH_MAGIC_LINK_TEMPLATE_CONFIRM_PRODUCTION: "true",
  };
}
