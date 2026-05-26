import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTROL_STATE_KV_PLACEHOLDER,
  extractKvNamespaceIdFromWranglerOutput,
  redactedKvNamespaceId,
  replaceControlStateKvNamespaceId,
  summarizeControlStateKvConfig,
  validateKvNamespaceId,
} from "../src/kv-setup";

const validId = "0123456789abcdef0123456789abcdef";
const configWithPlaceholder = `{
  "kv_namespaces": [
    {
      "binding": "CONTROL_STATE",
      "id": "${CONTROL_STATE_KV_PLACEHOLDER}"
    }
  ]
}
`;

void test("KV setup summarizes placeholder config as unverified", () => {
  const summary = summarizeControlStateKvConfig(configWithPlaceholder);

  assert.equal(summary.status, "UNVERIFIED");
  assert.match(summary.evidence.join("\n"), /REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID/);
});

void test("KV setup replaces exactly one CONTROL_STATE placeholder", () => {
  const updated = replaceControlStateKvNamespaceId(configWithPlaceholder, validId);

  assert.equal(updated.includes(CONTROL_STATE_KV_PLACEHOLDER), false);
  assert.equal(updated.includes(validId), true);
  assert.equal(summarizeControlStateKvConfig(updated).status, "PASS");
});

void test("KV setup rejects malformed ids and ambiguous replacements", () => {
  assert.deepEqual(validateKvNamespaceId("not-an-id"), [
    "KV namespace id must be a 32-character hexadecimal Cloudflare id",
  ]);
  assert.throws(
    () => replaceControlStateKvNamespaceId(configWithPlaceholder + CONTROL_STATE_KV_PLACEHOLDER, validId),
    /Expected exactly one/,
  );
});

void test("KV setup extracts Wrangler namespace id without treating it as a secret", () => {
  const output = `Add the following to your configuration file:
{
  "binding": "CONTROL_STATE",
  "id": "${validId}"
}`;

  assert.equal(extractKvNamespaceIdFromWranglerOutput(output), validId);
  assert.equal(redactedKvNamespaceId(validId), "0123...cdef (32 chars)");
});
