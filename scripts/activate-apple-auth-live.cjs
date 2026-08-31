#!/usr/bin/env node

const { stdin, stdout } = require("node:process");
const { applyAppleAuthLive } = require("./apply-apple-auth-live.cjs");
const { checkAppleAuthLive } = require("./check-apple-auth-live.cjs");
const { checkAppleAuthPublic } = require("./check-apple-auth-public.cjs");
const {
  evidenceFailureCode,
  sanitizeEvidenceStatus,
} = require("./lib/diagnostic-evidence-privacy.cjs");

const BASE_PROMPTS = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_APPLE_CLIENT_ID",
];
const APPLE_CLIENT_SECRET_PROMPT = "SUPABASE_APPLE_CLIENT_SECRET";
const APPLE_SECRET_SOURCE_PROMPT = "SUPABASE_APPLE_SECRET_SOURCE";
const SIGNING_KEY_SOURCE = "signing-key";
const CLIENT_SECRET_SOURCE = "client-secret";
const SIGNING_INPUT_PROMPTS = [
  "SUPABASE_APPLE_TEAM_ID",
  "SUPABASE_APPLE_KEY_ID",
  "SUPABASE_APPLE_PRIVATE_KEY_PATH",
];
function writeLine(write, status, message) {
  write("[apple-auth-activate] " + status + " " + message);
}

function appleEvidenceMessage(stage, status) {
  if (stage === "apply") {
    if (status === "PASS") return "Hosted Supabase Apple Auth applied.";
    if (status === "FAIL") return "Hosted Supabase Apple Auth apply failed.";
    return "Hosted Supabase Apple Auth apply was not verified.";
  }
  if (stage === "public") {
    if (status === "PASS") return "Public Supabase Auth settings expose Apple provider.";
    if (status === "FAIL") return "Public Apple Auth verification failed.";
    return "Public Apple Auth verification was incomplete.";
  }
  if (stage === "live") {
    if (status === "PASS") return "Hosted Supabase Apple Auth is enabled with required redirects.";
    if (status === "FAIL") return "Hosted Apple Auth verification failed.";
    return "Hosted Apple Auth verification was incomplete.";
  }
  return "Apple Auth evidence was not verified.";
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function redactSecrets(value, secrets) {
  let output = String(value || "");
  for (const secret of secrets) {
    if (hasValue(secret)) output = output.replaceAll(secret, "[redacted]");
  }
  return output;
}

function readHidden(question, input = stdin, output = stdout) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return new Promise((resolve) => {
      const readline = require("node:readline/promises");
      const rl = readline.createInterface({ input, output });
      void rl.question(question + ": ").then((answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  return new Promise((resolve, reject) => {
    let answer = "";
    const wasRaw = input.isRaw;

    function cleanup() {
      input.off("data", onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
    }

    function finish() {
      output.write("\n");
      cleanup();
      resolve(answer);
    }

    function fail(error) {
      output.write("\n");
      cleanup();
      reject(error);
    }

    function handleCharacter(value) {
      if (value === "\u0003") {
        fail(new Error("Prompt cancelled."));
        return false;
      }
      if (value === "\r" || value === "\n") {
        finish();
        return false;
      }
      if (value === "\u007f" || value === "\b") {
        if (answer.length > 0) {
          answer = answer.slice(0, -1);
          output.write("\b \b");
        }
        return true;
      }
      answer += value;
      output.write("*");
      return true;
    }

    function onData(chunk) {
      for (const value of chunk.toString("utf8")) {
        if (!handleCharacter(value)) break;
      }
    }

    output.write(question + ": ");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function defaultPrompt({ name, secret = false, defaultValue = "" }) {
  const label = defaultValue ? name + " [" + defaultValue + "]" : name;
  if (secret) {
    const answer = await readHidden(label);
    return hasValue(answer) ? answer.trim() : defaultValue;
  }

  const readline = require("node:readline/promises");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(label + ": ");
  rl.close();
  return hasValue(answer) ? answer.trim() : defaultValue;
}

function hasAppleClientSecret(env) {
  return hasValue(env.SUPABASE_APPLE_CLIENT_SECRET) || hasValue(env.SUPABASE_AUTH_EXTERNAL_APPLE_SECRET);
}

function hasCompleteSigningInputs(env) {
  return (
    hasValue(env.SUPABASE_APPLE_TEAM_ID) &&
    hasValue(env.SUPABASE_APPLE_KEY_ID) &&
    (hasValue(env.SUPABASE_APPLE_PRIVATE_KEY_PATH) || hasValue(env.SUPABASE_APPLE_PRIVATE_KEY))
  );
}

function hasAnySigningInput(env) {
  return SIGNING_INPUT_PROMPTS.some((name) => hasValue(env[name])) || hasValue(env.SUPABASE_APPLE_PRIVATE_KEY);
}

function normalizeSecretSource(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["signing", "signing-key", "key", "p8", "private-key"].includes(normalized)) return SIGNING_KEY_SOURCE;
  return CLIENT_SECRET_SOURCE;
}

async function promptIntoEnv({ nextEnv, promptedValues, prompt, name, secret = true, defaultValue = "" }) {
  if (hasValue(nextEnv[name])) return;
  const value = await prompt({ name, secret, defaultValue });
  if (!hasValue(value)) return;
  const trimmed = value.trim();
  nextEnv[name] = trimmed;
  if (secret) promptedValues.push(trimmed);
}

async function collectAppleSecretSource({ nextEnv, promptedValues, prompt, write }) {
  if (hasAppleClientSecret(nextEnv) || hasCompleteSigningInputs(nextEnv)) return;

  let source = CLIENT_SECRET_SOURCE;
  if (hasAnySigningInput(nextEnv)) {
    source = SIGNING_KEY_SOURCE;
  } else {
    writeLine(write, "INFO", "Choose Apple secret source: client-secret or signing-key.");
    const answer = await prompt({
      name: APPLE_SECRET_SOURCE_PROMPT,
      secret: false,
      defaultValue: CLIENT_SECRET_SOURCE,
    });
    source = normalizeSecretSource(answer);
  }

  if (source === SIGNING_KEY_SOURCE) {
    writeLine(write, "INFO", "Apple client secret will be generated locally from signing-key inputs.");
    for (const name of SIGNING_INPUT_PROMPTS) {
      await promptIntoEnv({ nextEnv, promptedValues, prompt, name, secret: true });
    }
    return;
  }

  await promptIntoEnv({ nextEnv, promptedValues, prompt, name: APPLE_CLIENT_SECRET_PROMPT, secret: true });
}

async function activateAppleAuthLiveInteractive({
  env = process.env,
  rootDir = process.cwd(),
  prompt = defaultPrompt,
  applyAppleAuthLive: apply = applyAppleAuthLive,
  checkAppleAuthPublic: checkPublic = checkAppleAuthPublic,
  checkAppleAuthLive: checkLive = checkAppleAuthLive,
  write = console.log,
} = {}) {
  const nextEnv = { ...env };
  const promptedValues = [];

  writeLine(write, "INFO", "Using local-only prompts for missing hosted Apple Auth inputs.");

  for (const name of BASE_PROMPTS) {
    await promptIntoEnv({ nextEnv, promptedValues, prompt, name, secret: true });
  }
  await collectAppleSecretSource({ nextEnv, promptedValues, prompt, write });

  nextEnv.ZENFLOW_APPLE_AUTH_APPLY_CONFIRM = "true";
  const result = await apply({ env: nextEnv, rootDir });
  const applyStatus = sanitizeEvidenceStatus(result.status);
  const safeMessage = appleEvidenceMessage("apply", applyStatus);
  writeLine(write, applyStatus, safeMessage);

  if (applyStatus !== "PASS" || result.exitCode !== 0) {
    return { status: applyStatus, message: safeMessage, exitCode: applyStatus === "FAIL" ? 1 : 2 };
  }

  writeLine(write, "INFO", "Verifying hosted Apple Auth after apply.");
  const verificationEnv = {
    ...nextEnv,
    SUPABASE_EXPECTED_APPLE_CLIENT_ID:
      nextEnv.SUPABASE_EXPECTED_APPLE_CLIENT_ID ||
      nextEnv.SUPABASE_APPLE_CLIENT_ID ||
      nextEnv.SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID ||
      "",
    SUPABASE_EXPECTED_APPLE_ADDITIONAL_CLIENT_IDS:
      nextEnv.SUPABASE_EXPECTED_APPLE_ADDITIONAL_CLIENT_IDS ||
      nextEnv.SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS ||
      nextEnv.SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS ||
      "",
    ZENFLOW_APPLE_AUTH_PUBLIC_REQUIRED: "true",
    ZENFLOW_APPLE_AUTH_LIVE_REQUIRED: "true",
  };

  const publicResult = await checkPublic({ env: verificationEnv, rootDir });
  const liveResult = await checkLive({ env: verificationEnv, rootDir });
  const publicStatus = sanitizeEvidenceStatus(publicResult.status);
  const liveStatus = sanitizeEvidenceStatus(liveResult.status);
  const safePublicMessage = appleEvidenceMessage("public", publicStatus);
  const safeLiveMessage = appleEvidenceMessage("live", liveStatus);
  writeLine(write, publicStatus, safePublicMessage);
  writeLine(write, liveStatus, safeLiveMessage);

  if (publicStatus === "PASS" && liveStatus === "PASS") {
    return { status: "PASS", message: "Hosted Supabase Apple Auth applied and verified.", exitCode: 0 };
  }

  if (publicStatus === "FAIL" || liveStatus === "FAIL") {
    return {
      status: "FAIL",
      message: "Hosted Supabase Apple Auth applied but verification failed.",
      exitCode: 1,
    };
  }

  return {
    status: "UNVERIFIED",
    message: "Hosted Supabase Apple Auth applied but verification is incomplete.",
    exitCode: 2,
  };
}

async function main() {
  try {
    const result = await activateAppleAuthLiveInteractive();
    process.exitCode = result.exitCode;
  } catch (error) {
    writeLine(console.log, "UNVERIFIED", evidenceFailureCode(error));
    process.exitCode = 2;
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  activateAppleAuthLiveInteractive,
  defaultPrompt,
  hasCompleteSigningInputs,
  normalizeSecretSource,
  readHidden,
  redactSecrets,
};
