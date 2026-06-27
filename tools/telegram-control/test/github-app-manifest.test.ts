import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubAppManifest,
  buildGitHubAppManifestFromBase,
  buildGitHubAppManifestRegistrationHtml,
  githubAppManifestConversionUrl,
  githubAppManifestPostUrl,
  manifestConversionCloudflareSecrets,
  summarizeGitHubAppManifest,
  summarizeGitHubAppManifestConversion,
  validateGitHubAppManifestInput,
  validateManifestCallbackState,
} from "../src/github-app-manifest";

void test("GitHub App manifest uses minimal control-plane permissions by default", () => {
  const manifest = buildGitHubAppManifestFromBase({
    appName: "ZenFlow Telegram Control",
    baseUrl: "https://zenflow-telegram-control.example.workers.dev",
  });

  assert.equal(manifest.hook_attributes.url, "https://zenflow-telegram-control.example.workers.dev/github/webhook");
  assert.equal(manifest.hook_attributes.active, true);
  assert.deepEqual(manifest.default_events, ["workflow_run"]);
  assert.deepEqual(manifest.default_permissions, {
    metadata: "read",
    actions: "write",
  });
  assert.equal(JSON.stringify(manifest).includes("PRIVATE_KEY"), false);
});

void test("GitHub App manifest can include direct PR publishing permissions explicitly", () => {
  const manifest = buildGitHubAppManifestFromBase({
    appName: "ZenFlow Telegram Control",
    baseUrl: "https://zenflow-telegram-control.example.workers.dev",
    workflowOwnedPrs: true,
  });

  assert.equal(manifest.default_permissions.contents, "write");
  assert.equal(manifest.default_permissions.pull_requests, "write");
  assert.equal(manifest.default_permissions.issues, "write");
});

void test("GitHub App manifest validates HTTPS webhook shape", () => {
  const errors = validateGitHubAppManifestInput({
    appName: "ZenFlow Telegram Control",
    homepageUrl: "https://github.com/Yehor212/people-first-app",
    webhookUrl: "http://example.test/not-github-webhook",
    workflowOwnedPrs: false,
  });

  assert.deepEqual(errors, [
    "TELEGRAM_CONTROL_CALLBACK_URL must use HTTPS",
    "TELEGRAM_CONTROL_CALLBACK_URL must end with /github/webhook",
  ]);
});

void test("GitHub App manifest summary avoids generated credentials", () => {
  const manifest = buildGitHubAppManifest({
    appName: "ZenFlow Telegram Control",
    homepageUrl: "https://github.com/Yehor212/people-first-app",
    webhookUrl: "https://worker.example/github/webhook",
    workflowOwnedPrs: false,
  });
  const summary = summarizeGitHubAppManifest(manifest).join("\n");

  assert.match(summary, /Permissions: metadata:read, actions:write/);
  assert.match(summary, /does not include App ID, private key, webhook secret, or installation id/);
});

void test("GitHub App manifest POST target supports personal and organization accounts", () => {
  assert.equal(githubAppManifestPostUrl(undefined), "https://github.com/settings/apps/new");
  assert.equal(
    githubAppManifestPostUrl("ZenFlowOrg"),
    "https://github.com/organizations/ZenFlowOrg/settings/apps/new",
  );
});

void test("GitHub App manifest can target a local one-time callback", () => {
  const manifest = buildGitHubAppManifestFromBase({
    appName: "ZenFlow Telegram Control",
    baseUrl: "https://zenflow-telegram-control.example.workers.dev",
    redirectUrl: "http://127.0.0.1:8977/github-app/callback",
  });

  assert.equal(manifest.redirect_url, "http://127.0.0.1:8977/github-app/callback");
});

void test("GitHub App registration HTML posts manifest and state without generated secrets", () => {
  const manifest = buildGitHubAppManifestFromBase({
    appName: "ZenFlow <Telegram> Control",
    baseUrl: "https://zenflow-telegram-control.example.workers.dev",
    redirectUrl: "http://127.0.0.1:8977/github-app/callback",
  });
  const html = buildGitHubAppManifestRegistrationHtml({
    postUrl: githubAppManifestPostUrl(undefined),
    manifest,
    state: "state-123",
  });

  assert.match(html, /method="post"/);
  assert.match(html, /name="manifest"/);
  assert.match(html, /state=state-123/);
  assert.match(html, /ZenFlow &lt;Telegram&gt; Control/);
  assert.equal(html.includes("PRIVATE KEY"), false);
  assert.equal(html.includes("webhook_secret"), false);
});

void test("GitHub App manifest conversion helpers redact secrets", () => {
  const fakePrivateKey = [
    "-----" + "BEGIN PRIVATE KEY" + "-----",
    "not-a-real-key-for-tests-only",
    "-----" + "END PRIVATE KEY" + "-----",
  ].join("\n");
  const conversion = {
    id: 123456,
    slug: "zenflow-telegram-control",
    html_url: "https://github.com/apps/zenflow-telegram-control",
    webhook_secret: "generated-webhook-secret-value",
    pem: fakePrivateKey,
  };

  assert.equal(
    githubAppManifestConversionUrl("abc/123"),
    "https://api.github.com/app-manifests/abc%2F123/conversions",
  );
  assert.deepEqual(manifestConversionCloudflareSecrets(conversion), {
    GITHUB_APP_ID: "123456",
    GITHUB_APP_PRIVATE_KEY: fakePrivateKey,
    GITHUB_WEBHOOK_SECRET: "generated-webhook-secret-value",
  });

  const summary = summarizeGitHubAppManifestConversion(conversion).join("\n");
  assert.match(summary, /PASS GitHub App ID: 123456/);
  assert.match(summary, /PASS GitHub App URL: https:\/\/github.com\/apps\/zenflow-telegram-control/);
  assert.match(summary, /webhook secret present/);
  assert.match(summary, /private key present/);
  assert.equal(summary.includes(fakePrivateKey), false);
  assert.equal(summary.includes("generated-webhook-secret-value"), false);
});

void test("GitHub App local callback state must match exactly", () => {
  assert.deepEqual(validateManifestCallbackState("expected", "expected"), []);
  assert.deepEqual(validateManifestCallbackState("expected", "wrong"), [
    "GitHub App manifest callback state mismatch",
  ]);
});
