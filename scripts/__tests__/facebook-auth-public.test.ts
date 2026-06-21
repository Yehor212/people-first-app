import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/check-facebook-auth-public.cjs";
const scriptPath = join(process.cwd(), script);
const require = createRequire(import.meta.url);
const { checkFacebookAuthPublic, inspectPublicAuthSettings } =
  require("../check-facebook-auth-public.cjs") as {
    checkFacebookAuthPublic?: (input?: {
      env?: NodeJS.ProcessEnv;
      rootDir?: string;
      fetchImpl?: typeof fetch;
    }) => Promise<{ status: string; message: string; exitCode: number }>;
    inspectPublicAuthSettings?: (settings: Record<string, unknown>) => string[];
  };

function runPublicCheck(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_ANON_KEY: "",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_SUPABASE_ANON_KEY: "",
      ZENFLOW_FACEBOOK_AUTH_PUBLIC_REQUIRED: "",
      ...env,
    },
    encoding: "utf8",
  });
}

function runPublicCheckInFixture(files: Record<string, string>, env: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), "facebook-auth-public-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(scriptPath, join(root, script));
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(root, file), content);
  }

  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_ANON_KEY: "",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_SUPABASE_ANON_KEY: "",
      ZENFLOW_FACEBOOK_AUTH_PUBLIC_REQUIRED: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("check-facebook-auth-public", () => {
  it("reports UNVERIFIED without failing when public Supabase env is missing and bundle discovery is disabled", () => {
    const result = runPublicCheckInFixture({}, { ZENFLOW_FACEBOOK_AUTH_PUBLIC_DISCOVERY: "false" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[facebook-auth-public] UNVERIFIED");
    expect(result.stdout).toContain("VITE_SUPABASE_URL");
    expect(result.stdout).toContain("VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY");
  });

  it("exits non-zero in required mode when public Supabase env is missing", () => {
    const result = runPublicCheckInFixture(
      {},
      {
        ZENFLOW_FACEBOOK_AUTH_PUBLIC_REQUIRED: "true",
        ZENFLOW_FACEBOOK_AUTH_PUBLIC_DISCOVERY: "false",
      }
    );

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[facebook-auth-public] UNVERIFIED");
  });

  it("does not treat .env.example placeholders as live public Supabase config", () => {
    const result = runPublicCheckInFixture(
      {
        ".env.example": [
          "VITE_SUPABASE_URL=https://your-project-ref.supabase.co",
          "VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key",
        ].join("\n"),
      },
      { ZENFLOW_FACEBOOK_AUTH_PUBLIC_DISCOVERY: "false" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[facebook-auth-public] UNVERIFIED");
  });

  it("requires public Supabase Auth settings to expose Facebook", () => {
    expect(typeof inspectPublicAuthSettings).toBe("function");

    const failures = inspectPublicAuthSettings?.({ external: { facebook: false, google: true } });

    expect(failures).toEqual(["Facebook provider is disabled in public Supabase Auth settings"]);
  });

  it("passes when public Supabase Auth settings expose Facebook", async () => {
    expect(typeof checkFacebookAuthPublic).toBe("function");
    const publicKey = "sb_publishable_fixture_key_must_not_print";
    const requests: Array<{ url: string; headerValue?: string }> = [];

    const result = await checkFacebookAuthPublic?.({
      env: {
        VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
      },
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        requests.push({ url: String(url), headerValue: headers?.apikey });
        return new Response(JSON.stringify({ external: { facebook: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(result?.message).not.toContain(publicKey);
    expect(requests).toEqual([
      {
        url: "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/settings",
        headerValue: publicKey,
      },
    ]);
  });

  it("can verify hosted Facebook auth from the deployed app bundle without printing the public key", async () => {
    expect(typeof checkFacebookAuthPublic).toBe("function");
    const publicKey = "sb_publishable_bundle_key_must_not_print";
    const requests: Array<{ url: string; headerValue?: string }> = [];

    const result = await checkFacebookAuthPublic?.({
      env: {
        ZENFLOW_FACEBOOK_AUTH_PUBLIC_APP_URL: "https://yehor212.github.io/people-first-app/",
      },
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        const rawUrl = String(url);
        if (rawUrl === "https://yehor212.github.io/people-first-app/") {
          return new Response(
            [
              '<link rel="modulepreload" href="/people-first-app/assets/supabaseClient-fixture.js">',
              '<script type="module" src="/people-first-app/assets/index-fixture.js"></script>',
            ].join(""),
            {
              status: 200,
              headers: { "content-type": "text/html" },
            }
          );
        }

        if (rawUrl === "https://yehor212.github.io/people-first-app/assets/index-fixture.js") {
          return new Response("import './supabaseClient-fixture.js';", {
            status: 200,
            headers: { "content-type": "application/javascript" },
          });
        }

        if (
          rawUrl === "https://yehor212.github.io/people-first-app/assets/supabaseClient-fixture.js"
        ) {
          return new Response(
            `const supabaseUrl="https://api.zenflowapp.online";const supabaseKey="${publicKey}";`,
            {
              status: 200,
              headers: { "content-type": "application/javascript" },
            }
          );
        }

        const headers = init?.headers as Record<string, string>;
        requests.push({ url: rawUrl, headerValue: headers?.apikey });
        return new Response(JSON.stringify({ external: { facebook: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(result?.message).not.toContain(publicKey);
    expect(requests).toEqual([
      {
        url: "https://api.zenflowapp.online/auth/v1/settings",
        headerValue: publicKey,
      },
    ]);
  });

  it("falls back to the canonical deployed app bundle when local public env is absent", async () => {
    expect(typeof checkFacebookAuthPublic).toBe("function");
    const publicKey = "sb_publishable_default_bundle_key_must_not_print";
    const requests: Array<{ url: string; headerValue?: string }> = [];

    const result = await checkFacebookAuthPublic?.({
      env: {
        SUPABASE_URL: "",
        SUPABASE_PUBLISHABLE_KEY: "",
        SUPABASE_ANON_KEY: "",
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
        VITE_SUPABASE_ANON_KEY: "",
        ZENFLOW_FACEBOOK_AUTH_PUBLIC_APP_URL: "",
        ZENFLOW_PUBLIC_AUTH_URL: "",
      },
      rootDir: mkdtempSync(join(tmpdir(), "facebook-auth-public-empty-")),
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        const rawUrl = String(url);
        if (rawUrl === "https://yehor212.github.io/people-first-app/") {
          return new Response(
            [
              '<link rel="modulepreload" href="/people-first-app/assets/supabaseClient-fixture.js">',
              '<script type="module" src="/people-first-app/assets/index-fixture.js"></script>',
            ].join(""),
            {
              status: 200,
              headers: { "content-type": "text/html" },
            }
          );
        }

        if (rawUrl === "https://yehor212.github.io/people-first-app/assets/index-fixture.js") {
          return new Response("import './supabaseClient-fixture.js';", {
            status: 200,
            headers: { "content-type": "application/javascript" },
          });
        }

        if (
          rawUrl === "https://yehor212.github.io/people-first-app/assets/supabaseClient-fixture.js"
        ) {
          return new Response(
            `const supabaseUrl="https://api.zenflowapp.online";const supabaseKey="${publicKey}";`,
            {
              status: 200,
              headers: { "content-type": "application/javascript" },
            }
          );
        }

        const headers = init?.headers as Record<string, string>;
        requests.push({ url: rawUrl, headerValue: headers?.apikey });
        return new Response(JSON.stringify({ external: { facebook: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(result?.message).not.toContain(publicKey);
    expect(requests).toEqual([
      {
        url: "https://api.zenflowapp.online/auth/v1/settings",
        headerValue: publicKey,
      },
    ]);
  });

  it("does not print public API key values in CLI output", () => {
    const publicKey = "sb_publishable_fixture_key_must_not_print";
    const result = runPublicCheck({
      VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
      ZENFLOW_FACEBOOK_AUTH_PUBLIC_OFFLINE: "true",
    });

    expect(result.stdout).not.toContain(publicKey);
    expect(result.stderr).not.toContain(publicKey);
  });
});
