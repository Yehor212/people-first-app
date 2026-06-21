import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActivationDoctorChecks,
  overallActivationStatus,
  parseWranglerWhoamiAuthentication,
  resolveCallbackUrlCheck,
  summarizeGeneratedSecretFile,
  validateTelegramAdminIds,
} from "../src/activation-doctor";
import { buildGitHubStatusChecks, fetchGitHubStatusChecks } from "../src/github-status";
import { formatGeneratedSecretsEnv, generateProjectSecrets } from "../src/secret-bootstrap";

const localGeneratedEnvPath = [".env", "telegram-control", "local"].join(".");

void test("activation doctor separates missing evidence from hard failures", () => {
  const checks = buildActivationDoctorChecks({
    workerConfigPath: "tools/telegram-control/wrangler.jsonc",
    workerConfigExists: true,
    workerConfigText: "REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID",
    workflowPath: ".github/workflows/telegram-control.yml",
    workflowExists: true,
    generatedSecretsPath: localGeneratedEnvPath,
    generatedSecrets: { exists: false, presentNames: [], errors: [] },
    env: {},
    githubChecked: false,
    githubSecretsAvailable: false,
    githubSecrets: new Set(),
    cloudflareChecked: false,
  });

  assert.equal(overallActivationStatus(checks), "UNVERIFIED");
  assert.equal(checks.find((check) => check.name === "Cloudflare Worker config")?.status, "PASS");
  assert.equal(
    checks.find((check) => check.name === "Cloudflare KV namespace id")?.status,
    "UNVERIFIED"
  );
});

void test("activation doctor parses wrangler whoami authentication output", () => {
  assert.equal(
    parseWranglerWhoamiAuthentication("You are not authenticated. Please run wrangler login."),
    false
  );
  assert.equal(parseWranglerWhoamiAuthentication("You are logged in with an OAuth Token."), true);
});

void test("generated secret file summary validates required generated names", () => {
  const summary = summarizeGeneratedSecretFile(
    true,
    formatGeneratedSecretsEnv(generateProjectSecrets())
  );

  assert.equal(summary.exists, true);
  assert.deepEqual(summary.errors, []);
  assert.deepEqual(summary.presentNames, [
    "TELEGRAM_WEBHOOK_SECRET",
    "GITHUB_WEBHOOK_SECRET",
    "TELEGRAM_CONTROL_CALLBACK_SECRET",
  ]);
});

void test("callback URL and Telegram admin id validation reject unsafe setup", () => {
  assert.equal(
    resolveCallbackUrlCheck({ TELEGRAM_CONTROL_BASE_URL: "https://worker.example" }).status,
    "PASS"
  );
  assert.equal(
    resolveCallbackUrlCheck({ TELEGRAM_CONTROL_BASE_URL: "http://worker.example" }).status,
    "FAIL"
  );
  assert.deepEqual(validateTelegramAdminIds("123, 456"), []);
  assert.match(validateTelegramAdminIds("123, abc").join("\n"), /non-numeric/);
});

void test("GitHub status checks fail closed during Actions or Pages incidents", () => {
  const checks = buildGitHubStatusChecks({
    components: [
      { name: "Actions", status: "major_outage" },
      { name: "Pages", status: "degraded_performance" },
    ],
    incidents: [
      {
        name: "Incident with Git Operations",
        status: "investigating",
        started_at: "2026-05-26T10:50:00.000Z",
        components: [{ name: "Git Operations" }],
      },
      {
        name: "Incident with Actions and Pages",
        status: "investigating",
        started_at: "2026-05-26T10:57:13.830Z",
        components: [{ name: "Actions" }, { name: "Pages" }],
      },
    ],
  });

  assert.deepEqual(
    checks.map((check) => check.status),
    ["FAIL", "FAIL"]
  );
  assert.match(checks[0]?.evidence ?? "", /major_outage/);
  assert.match(checks[1]?.evidence ?? "", /Incident with Actions and Pages/);
  assert.doesNotMatch(checks[0]?.evidence ?? "", /Git Operations/);
});

void test("GitHub status checks pass when required components are operational", () => {
  const checks = buildGitHubStatusChecks({
    components: [
      { name: "Actions", status: "operational" },
      { name: "Pages", status: "operational" },
    ],
    incidents: [],
  });

  assert.deepEqual(
    checks.map((check) => check.status),
    ["PASS", "PASS"]
  );
});

void test("GitHub status fetch failures are reported as unverified", async () => {
  const checks = await fetchGitHubStatusChecks(async () => {
    throw new Error("network timeout");
  });

  assert.deepEqual(checks, [
    {
      name: "GitHub Status",
      status: "UNVERIFIED",
      evidence: "network timeout",
    },
  ]);
});
