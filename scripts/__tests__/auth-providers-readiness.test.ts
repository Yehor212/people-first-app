import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = "scripts/check-auth-providers.cjs";

function runReadiness(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script, "--strict"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      FACEBOOK_APP_SECRET: "",
      TELEGRAM_CLIENT_SECRET: "",
      APPLE_CLIENT_SECRET: "",
      APPLE_PRIVATE_KEY: "",
      SUPABASE_ACCESS_TOKEN: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("check-auth-providers public key readiness", () => {
  it("does not treat .env.example placeholders as live Supabase config", () => {
    const result = runReadiness();

    expect(result.stdout).toContain("Supabase public client key is not configured");
    expect(result.stdout).not.toContain(
      "Supabase publishable key is configured without printing it"
    );
  });

  it("treats a missing Apple provider flag as enabled by the app default", () => {
    const result = runReadiness({
      VITE_ENABLE_APPLE_AUTH: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.stdout).toContain("Apple public auth flag is enabled");
    expect(result.stdout).not.toContain("Apple public auth flag is disabled");
  });

  it("accepts a modern Supabase publishable key without requiring the legacy anon key", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.stdout).toContain("Supabase publishable key is configured with authenticated RLS evidence");
    expect(result.stdout).not.toContain("Supabase anon key is not configured");
  });

  it("requires authenticated RLS evidence for strict Supabase publishable-key readiness", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
      ZENFLOW_SUPABASE_RLS_EVIDENCE_FILE: "supabase/migrations/missing-authenticated-rls.sql",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Supabase publishable key RLS evidence is missing");
  });

  it("requires the modern publishable key in strict mode instead of legacy-only anon config", () => {
    const result = runReadiness({
      VITE_SUPABASE_ANON_KEY: "legacy_anon_fixture_key",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "Strict Supabase readiness requires VITE_SUPABASE_PUBLISHABLE_KEY"
    );
  });

  it("requires manual identity linking for Telegram account linking readiness", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.stdout).toContain("Local Supabase manual identity linking is enabled");
  });

  it("requires the Telegram OIDC compatibility endpoint to be public and documented", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.stdout).toContain(
      "Telegram OIDC compatibility function is public for Supabase Auth discovery"
    );
    expect(result.stdout).toContain("Telegram Supabase discovery override is documented");
  });

  it("keeps Facebook public login behind the Meta readiness gate", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
      VITE_FACEBOOK_PUBLIC_ACCESS_READY: "",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Facebook Meta public access readiness gate is documented");
    expect(result.stdout).toContain("Facebook Meta public access readiness flag is not enabled");
  });

  it("keeps Apple public login behind the hosted readiness gate", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
      VITE_APPLE_PUBLIC_ACCESS_READY: "",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Apple hosted public access readiness gate is documented");
    expect(result.stdout).toContain("Apple hosted public access readiness flag is not enabled");
  });

  it("requires GitHub builds to pass the Apple hosted readiness flag", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("GitHub Pages deploy passes Apple hosted readiness flag");
    expect(result.stdout).toContain("V2 preview deploy passes Apple hosted readiness flag");
    expect(result.stdout).toContain("Visual regression build passes Apple hosted readiness flag");
  });

  it("requires GitHub builds to pass the Facebook Meta readiness flag", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("GitHub Pages deploy passes Facebook Meta readiness flag");
    expect(result.stdout).toContain("V2 preview deploy passes Facebook Meta readiness flag");
    expect(result.stdout).toContain("Visual regression build passes Facebook Meta readiness flag");
  });

  it("requires GitHub builds to keep Telegram public auth enabled by default", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("GitHub Pages deploy defaults Telegram public auth on");
    expect(result.stdout).toContain("V2 preview deploy defaults Telegram public auth on");
    expect(result.stdout).toContain("Visual regression build defaults Telegram public auth on");
  });

  it("requires GitHub Pages deploy to run hosted auth live checks", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const packageJson = readFileSync("package.json", "utf8");
    const hostedAuthStep = workflow.slice(
      workflow.indexOf("name: Check hosted auth providers"),
      workflow.indexOf("name: Check journal Magic Link GitHub name inventory"),
    );
    const journalMagicLinkInventoryStep = workflow.slice(
      workflow.indexOf("name: Check journal Magic Link GitHub name inventory"),
      workflow.indexOf("name: Check journal Magic Link live readiness"),
    );
    const journalMagicLinkStep = workflow.slice(
      workflow.indexOf("name: Check journal Magic Link live readiness"),
      workflow.indexOf("name: Check journal Magic Link proof status"),
    );
    const journalMagicLinkProofStatusStep = workflow.slice(
      workflow.indexOf("name: Check journal Magic Link proof status"),
      workflow.indexOf("name: Check Supabase publishable key readiness"),
    );

    expect(packageJson).toContain('"check:journal-magic-link-live"');
    expect(packageJson).toContain('"check:journal-magic-link-proof-status"');
    expect(packageJson).toContain('"check:journal-magic-link-proof-status:pass"');
    expect(packageJson).toContain('"check:github-journal-magic-link-secrets"');
    expect(packageJson).toContain('"check:github-journal-magic-link-secrets:pass"');
    expect(workflow).toContain("npm run check:facebook-auth-public");
    expect(workflow).toContain("npm run check:facebook-auth-live");
    expect(workflow).toContain("npm run check:apple-auth-public");
    expect(workflow).toContain("npm run check:apple-auth-live");
    expect(workflow).toContain("npm run check:journal-magic-link-live");
    expect(workflow).toContain("npm run check:github-journal-magic-link-secrets");
    expect(workflow).toContain("npm run check:telegram-oidc-live");
    expect(workflow).toContain("secrets.VITE_SUPABASE_ANON_KEY != ''");
    expect(workflow).toContain("ZENFLOW_FACEBOOK_AUTH_LIVE_REQUIRED");
    expect(workflow).toContain("ZENFLOW_APPLE_AUTH_PUBLIC_REQUIRED");
    expect(workflow).toContain("ZENFLOW_APPLE_AUTH_LIVE_REQUIRED");
    expect(workflow).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED");
    expect(hostedAuthStep).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
    expect(journalMagicLinkInventoryStep).toContain("ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_FROM_ENV: true");
    expect(journalMagicLinkInventoryStep).toContain("secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL != ''");
    expect(journalMagicLinkInventoryStep).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}");
    expect(journalMagicLinkStep).toContain(
      "if: github.event_name != 'pull_request' && (github.event_name != 'workflow_dispatch' || github.ref == 'refs/heads/main')"
    );
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: false");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_SMTP_REQUIRED");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: false");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL");
    expect(journalMagicLinkStep).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}");
    expect(journalMagicLinkStep).not.toContain("vars.ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL == 'true'");
    expect(journalMagicLinkProofStatusStep).toContain("npm run check:journal-magic-link-proof-status");
    expect(journalMagicLinkProofStatusStep).toContain("npm run check:journal-magic-link-proof-status:pass");
    expect(journalMagicLinkProofStatusStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_STATUS_REQUIRED");
    expect(journalMagicLinkProofStatusStep).toContain("vars.VITE_JOURNAL_MAGIC_LINK_LIVE_READY == 'true' && github.ref == 'refs/heads/main'");
    expect(journalMagicLinkProofStatusStep).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF }}");
    expect(workflow).toContain("ZENFLOW_TELEGRAM_OIDC_LIVE_REQUIRED: true");
  });

  it("requires GitHub Pages deploy to verify the live Telegram bot profile photo when the bot token is configured", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");

    expect(workflow).toContain("TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_AUTH_BOT_TOKEN }}");
    expect(workflow).toContain(
      "ZENFLOW_TELEGRAM_BOT_PROFILE_PHOTO_REQUIRED: ${{ secrets.TELEGRAM_AUTH_BOT_TOKEN != '' }}"
    );
    expect(workflow).toContain("npm --prefix tools/telegram-control run check:bot-profile-photo");

    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });
    expect(result.stdout).toContain(
      "GitHub Pages deploy verifies the approved Telegram bot profile photo"
    );
  });

  it("requires GitHub Pages deploy to verify the public Telegram bot profile photo without secrets", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");

    expect(workflow).toContain(
      "npm --prefix tools/telegram-control run check:public-bot-profile-photo"
    );

    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });
    expect(result.stdout).toContain(
      "GitHub Pages deploy verifies the public Telegram bot profile photo without secrets"
    );
  });
  it("requires V2 preview deploy to verify the live Telegram bot profile photo when the bot token is configured", () => {
    const workflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(workflow).toContain("TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_AUTH_BOT_TOKEN }}");
    expect(workflow).toContain(
      "ZENFLOW_TELEGRAM_BOT_PROFILE_PHOTO_REQUIRED: ${{ secrets.TELEGRAM_AUTH_BOT_TOKEN != '' }}"
    );
    expect(workflow).toContain("npm --prefix tools/telegram-control run check:bot-profile-photo");

    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });
    expect(result.stdout).toContain(
      "V2 preview deploy verifies the approved Telegram bot profile photo"
    );
  });

  it("requires V2 preview deploy to verify the public Telegram bot profile photo without secrets", () => {
    const workflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(workflow).toContain(
      "npm --prefix tools/telegram-control run check:public-bot-profile-photo"
    );

    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });
    expect(result.stdout).toContain(
      "V2 preview deploy verifies the public Telegram bot profile photo without secrets"
    );
  });
  it("requires V2 preview deploy to run hosted auth live checks", () => {
    const workflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");
    const hostedAuthStep = workflow.slice(
      workflow.indexOf("name: Check hosted auth providers for V2 preview"),
      workflow.indexOf("name: Check journal Magic Link GitHub name inventory for V2 preview"),
    );
    const journalMagicLinkPreviewInventoryStep = workflow.slice(
      workflow.indexOf("name: Check journal Magic Link GitHub name inventory for V2 preview"),
      workflow.indexOf("name: Check journal Magic Link live readiness for V2 preview"),
    );
    const journalMagicLinkStep = workflow.slice(
      workflow.indexOf("name: Check journal Magic Link live readiness for V2 preview"),
      workflow.indexOf("name: Check journal Magic Link proof status for V2 preview"),
    );
    const journalMagicLinkProofStatusStep = workflow.slice(
      workflow.indexOf("name: Check journal Magic Link proof status for V2 preview"),
      workflow.indexOf("name: Check Sentry readiness for V2 preview"),
    );

    expect(workflow).toContain("Check hosted auth providers for V2 preview");
    expect(workflow).toContain("npm run check:facebook-auth-public");
    expect(workflow).toContain("npm run check:facebook-auth-live");
    expect(workflow).toContain("npm run check:apple-auth-public");
    expect(workflow).toContain("npm run check:apple-auth-live");
    expect(workflow).toContain("npm run check:journal-magic-link-live");
    expect(workflow).toContain("npm run check:telegram-oidc-live");
    expect(workflow).toContain("secrets.VITE_SUPABASE_ANON_KEY != ''");
    expect(workflow).toContain("ZENFLOW_FACEBOOK_AUTH_LIVE_REQUIRED");
    expect(workflow).toContain("ZENFLOW_APPLE_AUTH_PUBLIC_REQUIRED");
    expect(workflow).toContain("ZENFLOW_APPLE_AUTH_LIVE_REQUIRED");
    expect(workflow).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED");
    expect(hostedAuthStep).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
    expect(journalMagicLinkPreviewInventoryStep).toContain("working-directory: v2-src");
    expect(journalMagicLinkPreviewInventoryStep).toContain("ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_FROM_ENV: true");
    expect(journalMagicLinkPreviewInventoryStep).toContain("secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL != ''");
    expect(journalMagicLinkPreviewInventoryStep).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}");
    expect(journalMagicLinkStep).toContain("if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'");
    expect(journalMagicLinkStep).toContain("working-directory: v2-src");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: false");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_SMTP_REQUIRED");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: false");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL");
    expect(journalMagicLinkStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL");
    expect(journalMagicLinkStep).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}");
    expect(journalMagicLinkStep).not.toContain("vars.ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL == 'true'");
    expect(journalMagicLinkProofStatusStep).toContain("working-directory: v2-src");
    expect(journalMagicLinkProofStatusStep).toContain("npm run check:journal-magic-link-proof-status");
    expect(journalMagicLinkProofStatusStep).toContain("npm run check:journal-magic-link-proof-status:pass");
    expect(journalMagicLinkProofStatusStep).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_STATUS_REQUIRED");
    expect(journalMagicLinkProofStatusStep).toContain("vars.VITE_JOURNAL_MAGIC_LINK_LIVE_READY == 'true' && github.ref == 'refs/heads/main'");
    expect(journalMagicLinkProofStatusStep).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF }}");
    expect(workflow).toContain("ZENFLOW_TELEGRAM_OIDC_LIVE_REQUIRED: true");
  });

  it("requires general auth readiness to include the Facebook live OAuth gate", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("GitHub Pages deploy runs Facebook live OAuth readiness check");
  });

  it("requires general auth readiness to include the Apple public and hosted live gates", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("GitHub Pages deploy runs Apple public Auth readiness check");
    expect(result.stdout).toContain("GitHub Pages deploy runs Apple hosted Auth readiness check");
    expect(result.stdout).toContain(
      "GitHub Pages deploy gates Apple public Auth readiness before public exposure"
    );
    expect(result.stdout).toContain(
      "GitHub Pages deploy gates Apple hosted Auth readiness before public exposure"
    );
  });

  it("requires general auth readiness to include the journal Magic Link live gate", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("GitHub Pages deploy runs journal Magic Link live readiness check");
    expect(result.stdout).toContain("V2 preview deploy runs journal Magic Link live readiness check");
    expect(result.stdout).toContain("GitHub Pages deploy runs journal Magic Link proof-status check");
    expect(result.stdout).toContain("V2 preview deploy runs journal Magic Link proof-status check");
    expect(result.stdout).toContain(
      "GitHub Pages deploy gates journal Magic Link live proof before public release claims",
    );
    expect(result.stdout).toContain(
      "GitHub Pages deploy gates journal Magic Link proof-status PASS before live-ready release claims",
    );
  });

  it("requires GitHub Pages public auth smoke to exercise Facebook when Meta readiness is enabled", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");

    expect(workflow).toContain("FACEBOOK_READY");
    expect(workflow).toContain('if [ "$FACEBOOK_READY" = "true" ]; then');
    expect(workflow).toContain('expected_providers="google,facebook,telegram"');
    expect(workflow).toContain('click_providers="google,facebook,telegram"');
    expect(workflow).toContain('forbidden_providers="facebook"');
    expect(workflow).toContain('ZENFLOW_PUBLIC_AUTH_EXPECTED_PROVIDERS="$expected_providers"');
    expect(workflow).toContain('ZENFLOW_PUBLIC_AUTH_CLICK_PROVIDERS="$click_providers"');
    expect(workflow).toContain('ZENFLOW_PUBLIC_AUTH_FORBIDDEN_PROVIDERS="$forbidden_providers"');
  });

  it("requires GitHub Pages public auth smoke to exercise Apple when hosted readiness is enabled", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");

    expect(workflow).toContain("APPLE_READY");
    expect(workflow).toContain('if [ "$APPLE_READY" = "true" ]; then');
    expect(workflow).toContain('expected_providers="${expected_providers},apple"');
    expect(workflow).toContain('click_providers="${click_providers},apple"');
    expect(workflow).toContain(
      'forbidden_providers="${forbidden_providers:+${forbidden_providers},}apple"'
    );
    expect(workflow).toContain('ZENFLOW_PUBLIC_AUTH_EXPECTED_PROVIDERS="$expected_providers"');
    expect(workflow).toContain('ZENFLOW_PUBLIC_AUTH_CLICK_PROVIDERS="$click_providers"');
    expect(workflow).toContain('ZENFLOW_PUBLIC_AUTH_FORBIDDEN_PROVIDERS="$forbidden_providers"');
  });
  it("requires GitHub Pages public auth smoke to cover all canonical V2 phone entrypoints", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(workflow).toContain(
      "ZENFLOW_PUBLIC_AUTH_ADDITIONAL_PATHS: orb/?nav=v2&navLayout=phone,habits/?nav=v2&navLayout=phone,diary/?nav=v2&navLayout=phone,planning/?nav=v2&navLayout=phone,settings/?nav=v2&navLayout=phone"
    );
    expect(result.stdout).toContain(
      "GitHub Pages public auth smoke covers canonical V2 phone entrypoints"
    );
  });

  it("requires GitHub deploy builds to pass the modern Supabase publishable key", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "GitHub Pages deploy passes the modern Supabase publishable key"
    );
    expect(result.stdout).toContain("V2 preview deploy passes the modern Supabase publishable key");
  });

  it("reports Apple public access as ready only when the hosted readiness flag is true", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
      VITE_APPLE_PUBLIC_ACCESS_READY: "true",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Apple hosted public access readiness flag is enabled");
  });

  it("reports Facebook public access as ready only when the Meta readiness flag is true", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
      VITE_FACEBOOK_PUBLIC_ACCESS_READY: "true",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Facebook Meta public access readiness flag is enabled");
  });

  it("requires Facebook OAuth to request Supabase-required email and public_profile scopes", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Facebook OAuth requests Supabase-required email and public_profile scopes"
    );
  });

  it("requires Telegram bot profile photo setup to use the approved ZenFlow logo", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Telegram bot profile photo uses the approved ZenFlow logo");
  });

  it("requires a live Telegram bot profile photo verifier", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Telegram bot profile photo live verifier is registered");
  });

  it("requires a no-secret public Telegram bot profile photo verifier", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Telegram bot profile photo public verifier is registered");
  });

  it("requires Supabase Facebook auth to allow email-optional identities", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Local Supabase Facebook provider allows users without email");
  });

  it("documents the Facebook scope contract beside email_optional", () => {
    const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

    expect(supabaseConfig).toContain(
      "Facebook OAuth requests email and public_profile; email remains optional"
    );
    expect(supabaseConfig).toContain("email_optional = true");
  });

  it("fails strict readiness when server-only Supabase secrets are present locally", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_fixture_that_must_not_print",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "[FAIL] SUPABASE_SERVICE_ROLE_KEY is present outside the app dashboards"
    );
    expect(result.stdout).not.toContain("service_role_fixture_that_must_not_print");
  });
});
