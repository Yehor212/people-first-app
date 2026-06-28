import assert from "node:assert/strict";
import test from "node:test";
import { callbackUrlFromBase, validateCallbackUrl } from "../src/callback-url";

void test("callbackUrlFromBase normalizes Worker origin to GitHub webhook URL", () => {
  assert.equal(
    callbackUrlFromBase("https://zenflow-control.example.workers.dev/miniapp?x=1#frag"),
    "https://zenflow-control.example.workers.dev/github/webhook",
  );
});

void test("callbackUrlFromBase rejects non-HTTPS origins", () => {
  assert.throws(() => callbackUrlFromBase("http://worker.example"), /HTTPS/);
});

void test("validateCallbackUrl requires HTTPS GitHub webhook path without credentials", () => {
  assert.deepEqual(validateCallbackUrl("https://worker.example/github/webhook"), []);
  assert.match(validateCallbackUrl("http://worker.example/github/webhook").join("\n"), /HTTPS/);
  assert.match(validateCallbackUrl("https://worker.example/telegram/webhook").join("\n"), /github\/webhook/);
  const credentialedUrl = new URL("https://worker.example/github/webhook");
  credentialedUrl.username = "fixture-user";
  credentialedUrl.password = "fixture-pass";
  assert.match(validateCallbackUrl(credentialedUrl.href).join("\n"), /credentials/);
  assert.match(validateCallbackUrl("https://worker.example/github/webhook?secret=1").join("\n"), /query/);
});
