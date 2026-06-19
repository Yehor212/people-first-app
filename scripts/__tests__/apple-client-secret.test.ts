import { spawn } from "node:child_process";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/generate-apple-client-secret.cjs";
const scriptPath = join(process.cwd(), script);
const require = createRequire(import.meta.url);
const { generateAppleClientSecret } = require("../generate-apple-client-secret.cjs") as {
  generateAppleClientSecret: (input?: {
    env?: NodeJS.ProcessEnv;
    rootDir?: string;
    nowSeconds?: number;
    printSecret?: boolean;
  }) => Promise<{ status: string; message: string; exitCode: number; jwt?: string }>;
};

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

function runScript(env: NodeJS.ProcessEnv = {}, args: string[] = [], cwd = process.cwd()) {
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env: {
        ...process.env,
        SUPABASE_APPLE_TEAM_ID: "",
        SUPABASE_APPLE_KEY_ID: "",
        SUPABASE_APPLE_CLIENT_ID: "",
        SUPABASE_APPLE_PRIVATE_KEY_PATH: "",
        SUPABASE_APPLE_PRIVATE_KEY: "",
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

describe("generate-apple-client-secret", () => {
  it("generates a valid Apple ES256 client secret JWT without returning it by default", async () => {
    const { privateKeyPem, publicKeyPem } = createPrivateKeyFixture();
    const result = await generateAppleClientSecret({
      nowSeconds: 1_800_000_000,
      env: {
        SUPABASE_APPLE_TEAM_ID: "TEAMID1234",
        SUPABASE_APPLE_KEY_ID: "KEYID12345",
        SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
        SUPABASE_APPLE_PRIVATE_KEY: privateKeyPem,
      },
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(result.jwt).toBeUndefined();
    expect(result.message).toContain("valid until");
    expect(result.message).not.toContain(privateKeyPem);
  });

  it("prints a command-substitution friendly JWT only when explicitly requested", async () => {
    const { privateKeyPem, publicKeyPem } = createPrivateKeyFixture();
    const result = await generateAppleClientSecret({
      nowSeconds: 1_800_000_000,
      printSecret: true,
      env: {
        SUPABASE_APPLE_TEAM_ID: "TEAMID1234",
        SUPABASE_APPLE_KEY_ID: "KEYID12345",
        SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
        SUPABASE_APPLE_PRIVATE_KEY: privateKeyPem,
      },
    });

    expect(result.status).toBe("PASS");
    expect(result.jwt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(result.message).not.toContain(privateKeyPem);

    const header = decodeJwtPart<{ alg: string; kid: string; typ: string }>(result.jwt ?? "", 0);
    const payload = decodeJwtPart<{
      aud: string;
      exp: number;
      iat: number;
      iss: string;
      sub: string;
    }>(result.jwt ?? "", 1);

    expect(header).toEqual({ alg: "ES256", kid: "KEYID12345", typ: "JWT" });
    expect(payload).toEqual({
      iss: "TEAMID1234",
      iat: 1_800_000_000,
      exp: 1_800_000_000 + 180 * 24 * 60 * 60,
      aud: "https://appleid.apple.com",
      sub: "com.zenflow.app.web",
    });
    expect(verifyEs256Jwt(result.jwt ?? "", publicKeyPem)).toBe(true);
  });

  it("reports missing inputs and does not print private key material in CLI output", async () => {
    const { privateKeyPem } = createPrivateKeyFixture();
    const root = mkdtempSync(join(tmpdir(), "apple-client-secret-"));
    mkdirSync(join(root, "scripts"), { recursive: true });
    copyFileSync(scriptPath, join(root, script));

    const result = await runScript({ SUPABASE_APPLE_PRIVATE_KEY: privateKeyPem }, [], root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("SUPABASE_APPLE_TEAM_ID");
    expect(result.stdout).toContain("SUPABASE_APPLE_KEY_ID");
    expect(result.stdout).toContain("SUPABASE_APPLE_CLIENT_ID");
    expect(result.stdout).not.toContain(privateKeyPem);
    expect(result.stderr).not.toContain(privateKeyPem);
  });
});
