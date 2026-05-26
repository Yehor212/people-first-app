import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubAppManifest,
  buildGitHubAppManifestFromBase,
  githubAppManifestPostUrl,
  summarizeGitHubAppManifest,
  validateGitHubAppManifestInput,
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
