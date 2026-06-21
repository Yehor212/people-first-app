import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/check-facebook-auth-live.cjs";

describe("Facebook live auth readiness", () => {
  it("detects the Meta invalid-scope email error before public exposure", async () => {
    const { detectFacebookOAuthProblem } =
      await import("../../scripts/check-facebook-auth-live.cjs");

    expect(
      detectFacebookOAuthProblem({
        currentHost: "www.facebook.com",
        externalText:
          "Invalid Scopes: email. This message is only shown to developers. Users of your app will ignore these permissions if present.",
      })
    ).toMatchObject({
      reason: "facebook_invalid_scope_email",
    });
  });

  it("passes when Facebook shows a normal login page without provider errors", async () => {
    const { inspectFacebookOAuthPage } = await import("../../scripts/check-facebook-auth-live.cjs");

    expect(
      inspectFacebookOAuthPage({
        finalUrl: "https://www.facebook.com/login.php?skip_api_login=1",
        externalText: "Log in to Facebook",
      })
    ).toMatchObject({
      ok: true,
      status: "PASS",
    });
  });

  it("falls back to a safe redirect probe when browser inspection is unavailable", async () => {
    const { checkFacebookAuthLive } = await import("../../scripts/check-facebook-auth-live.cjs");

    const result = await checkFacebookAuthLive({
      env: {
        VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
      },
      rootDir: process.cwd(),
      probeImpl: async () => {
        throw new Error("Executable doesn't exist at /tmp/chromium");
      },
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://www.facebook.com/login.php?skip_api_login=1" },
        }),
    });

    expect(result).toMatchObject({
      status: "PASS",
      exitCode: 0,
      reason: "facebook_redirect_reachable",
    });
    expect(result.message).toContain("redirects to Meta");
  });

  it("does not print OAuth URLs or keys when live config is missing", () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_that_must_not_print",
        VITE_SUPABASE_ANON_KEY: "legacy_fixture_that_must_not_print",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[facebook-auth-live] UNVERIFIED");
    expect(result.stdout).not.toContain("sb_publishable_fixture_that_must_not_print");
    expect(result.stdout).not.toContain("legacy_fixture_that_must_not_print");
    expect(result.stdout).not.toContain("/auth/v1/authorize");
  });

  it("adds npm and GitHub Pages CI coverage for the live Facebook check", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");

    expect(packageJson.scripts["check:facebook-auth-live"]).toBe(
      "node scripts/check-facebook-auth-live.cjs"
    );
    expect(workflow).toContain("npm run check:facebook-auth-live");
    expect(workflow).toContain("ZENFLOW_FACEBOOK_AUTH_LIVE_REQUIRED");
    expect(workflow).toContain("vars.VITE_FACEBOOK_PUBLIC_ACCESS_READY == 'true'");
  });
});
