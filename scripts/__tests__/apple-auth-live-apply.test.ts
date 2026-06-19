import { spawn } from "node:child_process";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/apply-apple-auth-live.cjs";
const scriptPath = join(process.cwd(), script);
const generatorScript = "scripts/generate-apple-client-secret.cjs";
const generatorScriptPath = join(process.cwd(), generatorScript);
const require = createRequire(import.meta.url);
const { applyAppleAuthLive, buildPatchBody } = require("../apply-apple-auth-live.cjs") as {
  applyAppleAuthLive: (input?: {
    env?: NodeJS.ProcessEnv;
    rootDir?: string;
    fetchImpl?: typeof fetch;
  }) => Promise<{ status: string; message: string; exitCode: number }>;
  buildPatchBody: (
    existingConfig: Record<string, unknown>,
    appleClientId: string,
    appleSecret: string,
    additionalClientIds: string,
  ) => Record<string, unknown>;
};

function testSecretFixture(...parts: string[]) {
  return parts.join("_");
}

function createPrivateKeyFixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
  };
}

function decodeJwtPart<T>(jwt: string, index: number): T {
  const part = jwt.split(".")[index];
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

function verifyEs256Jwt(jwt: string, publicKeyPem: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = jwt.split(".");
  const verifier = createVerify("SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  return verifier.verify(
    { key: publicKeyPem, dsaEncoding: "ieee-p1363" },
    Buffer.from(encodedSignature, "base64url"),
  );
}

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runScript(env: NodeJS.ProcessEnv = {}, cwd = process.cwd()): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      env: {
        ...process.env,
        PROJECT_REF: "",
        SUPABASE_ACCESS_TOKEN: "",
        SUPABASE_APPLE_CLIENT_ID: "",
        SUPABASE_APPLE_CLIENT_SECRET: "",
        SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS: "",
        SUPABASE_MANAGEMENT_API_BASE_URL: "",
        ZENFLOW_APPLE_AUTH_APPLY_CONFIRM: "",
        ...env,
      },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function runScriptInFixture(files: Record<string, string>, env: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), "apple-auth-apply-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(scriptPath, join(root, script));
  copyFileSync(generatorScriptPath, join(root, generatorScript));
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(root, file), content);
  }
  return runScript(env, root);
}

describe("apply-apple-auth-live", () => {
  it("preserves existing Apple additional client IDs when adding native bundle IDs", () => {
    const patch = buildPatchBody(
      {
        uri_allow_list: "",
        external_apple_additional_client_ids: "com.zenflow.app.ios, com.zenflow.app.watch",
      },
      "com.zenflow.app.web",
      "apple-secret-fixture",
      "com.zenflow.app.ios,com.zenflow.app.android",
    );

    expect(patch.external_apple_additional_client_ids).toBe(
      "com.zenflow.app.ios,com.zenflow.app.watch,com.zenflow.app.android",
    );
  });

  it("reports UNVERIFIED when required hosted Apple Auth inputs are missing", async () => {
    const result = await runScriptInFixture({});

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[apple-auth-apply] UNVERIFIED");
    expect(result.stdout).toContain("SUPABASE_ACCESS_TOKEN");
    expect(result.stdout).toContain("SUPABASE_APPLE_CLIENT_ID");
    expect(result.stdout).toContain("SUPABASE_APPLE_CLIENT_SECRET");
  });

  it("applies Apple Auth config through the Supabase Management API without returning secrets", async () => {
    const accessToken = testSecretFixture("sbp", "fixture", "must", "stay", "hidden");
    const appleSecret = testSecretFixture("apple", "fixture", "must", "stay", "hidden");
    const requests: Array<{ method: string; url: string; body: string }> = [];
    const responses = [
      new Response(
        JSON.stringify({
          site_url: "https://old.example/",
          uri_allow_list: "https://old.example/callback,com.zenflow.app://login-callback",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
      new Response(JSON.stringify({ external_apple_enabled: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ];

    const result = await applyAppleAuthLive({
      env: {
        PROJECT_REF: "bwgfslmxmueyglpumkbf",
        SUPABASE_ACCESS_TOKEN: accessToken,
        SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
        SUPABASE_APPLE_CLIENT_SECRET: appleSecret,
        SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS: "com.zenflow.app",
        SUPABASE_MANAGEMENT_API_BASE_URL: "https://api.supabase.example.test/v1",
        ZENFLOW_APPLE_AUTH_APPLY_CONFIRM: "true",
      },
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        requests.push({
          method: init?.method || "GET",
          url: String(url),
          body: String(init?.body || ""),
        });
        const response = responses.shift();
        if (!response) throw new Error("unexpected request");
        return response;
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(result.message).not.toContain(accessToken);
    expect(result.message).not.toContain(appleSecret);

    expect(requests.map((request) => request.method)).toEqual(["GET", "PATCH"]);
    expect(requests[0].url).toContain("/projects/bwgfslmxmueyglpumkbf/config/auth");
    const patch = JSON.parse(requests[1].body) as Record<string, unknown>;
    expect(patch).toMatchObject({
      site_url: "https://yehor212.github.io/people-first-app/",
      external_apple_enabled: true,
      external_apple_client_id: "com.zenflow.app.web",
      external_apple_secret: appleSecret,
      external_apple_additional_client_ids: "com.zenflow.app",
    });
    expect(String(patch.uri_allow_list)).toContain("https://old.example/callback");
    expect(String(patch.uri_allow_list)).toContain("https://yehor212.github.io/people-first-app/");
    expect(String(patch.uri_allow_list)).toContain(
      "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
    );
    expect(String(patch.uri_allow_list)).toContain("com.zenflow.app://login-callback");
  });

  it("generates the Apple client secret during apply when signing key inputs are present", async () => {
    const { privateKeyPem, publicKeyPem } = createPrivateKeyFixture();
    const requests: Array<{ method: string; body: string }> = [];
    const responses = [
      new Response(JSON.stringify({ uri_allow_list: "" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      new Response(JSON.stringify({ external_apple_enabled: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ];

    const result = await applyAppleAuthLive({
      env: {
        PROJECT_REF: "bwgfslmxmueyglpumkbf",
        SUPABASE_ACCESS_TOKEN: "sbp_fixture_hidden",
        SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
        SUPABASE_APPLE_TEAM_ID: "TEAMID1234",
        SUPABASE_APPLE_KEY_ID: "KEYID12345",
        SUPABASE_APPLE_PRIVATE_KEY: privateKeyPem,
        SUPABASE_MANAGEMENT_API_BASE_URL: "https://api.supabase.example.test/v1",
        ZENFLOW_APPLE_AUTH_APPLY_CONFIRM: "true",
      },
      fetchImpl: (async (_url: URL | RequestInfo, init?: RequestInit) => {
        requests.push({ method: init?.method || "GET", body: String(init?.body || "") });
        const response = responses.shift();
        if (!response) throw new Error("unexpected request");
        return response;
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(result.message).not.toContain(privateKeyPem);

    const patch = JSON.parse(requests[1].body) as Record<string, string>;
    const generatedSecret = patch.external_apple_secret;
    expect(generatedSecret).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(decodeJwtPart<{ alg: string; kid: string; typ: string }>(generatedSecret, 0)).toEqual({
      alg: "ES256",
      kid: "KEYID12345",
      typ: "JWT",
    });
    expect(decodeJwtPart<{ aud: string; iss: string; sub: string }>(generatedSecret, 1)).toMatchObject({
      aud: "https://appleid.apple.com",
      iss: "TEAMID1234",
      sub: "com.zenflow.app.web",
    });
    expect(verifyEs256Jwt(generatedSecret, publicKeyPem)).toBe(true);
  });
});
