import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_OWNED_SECRET_NAMES,
  GENERATED_SECRET_NAMES,
  formatGeneratedSecretsEnv,
  formatRedactedGeneratedSecrets,
  generateProjectSecrets,
  validateGeneratedSecrets,
} from "../src/secret-bootstrap";

void test("generated project secrets are base64url-safe and long enough", () => {
  const secrets = generateProjectSecrets();

  assert.deepEqual(validateGeneratedSecrets(secrets), []);
  for (const name of GENERATED_SECRET_NAMES) {
    assert.match(secrets[name], /^[A-Za-z0-9_-]{32,256}$/);
  }
});

void test("generated secret report never includes plaintext values", () => {
  const secrets = generateProjectSecrets();
  const report = formatRedactedGeneratedSecrets(secrets).join("\n");

  for (const name of GENERATED_SECRET_NAMES) {
    assert.equal(report.includes(secrets[name]), false);
  }
});

void test("local env output excludes account-owned secrets", () => {
  const secrets = generateProjectSecrets();
  const envText = formatGeneratedSecretsEnv(secrets);

  for (const name of GENERATED_SECRET_NAMES) {
    assert.match(envText, new RegExp(`^${name}=`, "m"));
  }
  for (const name of ACCOUNT_OWNED_SECRET_NAMES) {
    assert.equal(envText.includes(`${name}=`), false);
  }
});
