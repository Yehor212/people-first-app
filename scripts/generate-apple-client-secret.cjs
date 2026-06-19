#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { createPrivateKey, createSign } = require("node:crypto");

const APPLE_AUDIENCE = "https://appleid.apple.com";
const DEFAULT_TTL_DAYS = 180;
const MAX_TTL_DAYS = 180;

function line(status, message) {
  console.log(`[apple-client-secret] ${status} ${message}`);
}

function buildResult(status, message, exitCode, jwt) {
  return { status, message, exitCode, ...(jwt ? { jwt } : {}) };
}

function getEnv(env, ...keys) {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlJson(value) {
  return base64Url(JSON.stringify(value));
}

function parseTtlDays(env) {
  const raw = getEnv(env, "SUPABASE_APPLE_CLIENT_SECRET_TTL_DAYS", "APPLE_CLIENT_SECRET_TTL_DAYS");
  if (!raw) return { ok: true, value: DEFAULT_TTL_DAYS };

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_TTL_DAYS) {
    return {
      ok: false,
      message: `SUPABASE_APPLE_CLIENT_SECRET_TTL_DAYS must be an integer from 1 to ${MAX_TTL_DAYS}.`,
    };
  }
  return { ok: true, value };
}

function readPrivateKey(env, rootDir) {
  const inline = getEnv(env, "SUPABASE_APPLE_PRIVATE_KEY", "APPLE_PRIVATE_KEY");
  if (inline) return inline.replaceAll("\\n", "\n");

  const keyPath = getEnv(env, "SUPABASE_APPLE_PRIVATE_KEY_PATH", "APPLE_PRIVATE_KEY_PATH");
  if (!keyPath) return "";

  const resolved = path.isAbsolute(keyPath) ? keyPath : path.join(rootDir, keyPath);
  return fs.readFileSync(resolved, "utf8");
}

function signJwt(privateKeyPem, header, payload) {
  const privateKey = createPrivateKey(privateKeyPem);
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${signature.toString("base64url")}`;
}

async function generateAppleClientSecret({
  env = process.env,
  rootDir = process.cwd(),
  nowSeconds = Math.floor(Date.now() / 1000),
  printSecret = false,
} = {}) {
  const teamId = getEnv(env, "SUPABASE_APPLE_TEAM_ID", "APPLE_TEAM_ID");
  const keyId = getEnv(env, "SUPABASE_APPLE_KEY_ID", "APPLE_KEY_ID");
  const clientId = getEnv(env, "SUPABASE_APPLE_CLIENT_ID", "SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID", "APPLE_CLIENT_ID");

  const missing = [];
  if (!teamId) missing.push("SUPABASE_APPLE_TEAM_ID");
  if (!keyId) missing.push("SUPABASE_APPLE_KEY_ID");
  if (!clientId) missing.push("SUPABASE_APPLE_CLIENT_ID");

  let privateKeyPem = "";
  try {
    privateKeyPem = readPrivateKey(env, rootDir);
  } catch {
    return buildResult("UNVERIFIED", "Apple private key file could not be read.", 2);
  }
  if (!privateKeyPem) {
    missing.push("SUPABASE_APPLE_PRIVATE_KEY_PATH or SUPABASE_APPLE_PRIVATE_KEY");
  }

  if (missing.length > 0) {
    return buildResult("UNVERIFIED", `Apple client secret not generated; missing ${missing.join(", ")}.`, 2);
  }

  const ttlDays = parseTtlDays(env);
  if (!ttlDays.ok) return buildResult("UNVERIFIED", ttlDays.message, 2);

  const issuedAt = Math.floor(nowSeconds);
  const expiresAt = issuedAt + ttlDays.value * 24 * 60 * 60;
  let jwt;
  try {
    jwt = signJwt(
      privateKeyPem,
      { alg: "ES256", kid: keyId, typ: "JWT" },
      {
        iss: teamId,
        iat: issuedAt,
        exp: expiresAt,
        aud: APPLE_AUDIENCE,
        sub: clientId,
      },
    );
  } catch {
    return buildResult("UNVERIFIED", "Apple private key could not sign an ES256 client secret.", 2);
  }

  const expiresIso = new Date(expiresAt * 1000).toISOString();
  return buildResult(
    "PASS",
    `Apple client secret generated; valid until ${expiresIso}. Use --print-secret only in a local shell or secret manager handoff.`,
    0,
    printSecret ? jwt : undefined,
  );
}

async function main() {
  const printSecret = process.argv.includes("--print-secret");
  const result = await generateAppleClientSecret({ printSecret });
  if (result.status === "PASS" && printSecret && result.jwt) {
    console.log(result.jwt);
  } else {
    line(result.status, result.message);
  }
  process.exitCode = result.exitCode;
}

if (require.main === module) {
  void main();
}

module.exports = {
  generateAppleClientSecret,
  readPrivateKey,
  signJwt,
};
