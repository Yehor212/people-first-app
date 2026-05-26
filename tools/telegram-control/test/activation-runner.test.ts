import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActivationRunSteps,
  parseActivationRunOptions,
  summarizeActivationRun,
  type ActivationRunOptions,
} from "../src/activation-runner";

void test("activation runner defaults to non-mutating dry-run steps", () => {
  const options = parseActivationRunOptions([], {});
  const steps = buildActivationRunSteps(options);

  assert.equal(options.apply, false);
  assert.equal(steps.every((step) => !step.mutatesExternalState), true);
  assert.equal(steps.find((step) => step.id === "live-smoke")?.shouldRun, false);
  assert.equal(steps.find((step) => step.id === "doctor")?.shouldRun, true);
  assert.equal(
    steps.find((step) => step.id === "cloudflare-account-secrets")?.displayCommand,
    "npm --prefix tools/telegram-control run secrets:install-account -- --dry-run --cloudflare",
  );
  assert.equal(steps.find((step) => step.id === "worker-deploy")?.displayCommand.endsWith("deploy:dry-run"), true);
  assert.equal(
    steps.find((step) => step.id === "github-app-manifest")?.displayCommand,
    "npm --prefix tools/telegram-control run github-app:manifest",
  );
  assert.equal(steps.find((step) => step.id === "github-app-manifest")?.mutatesExternalState, false);
  assert.equal(
    steps.find((step) => step.id === "github-callback-url")?.displayCommand,
    "npm --prefix tools/telegram-control run set-github-callback-url -- --dry-run",
  );
  assert.equal(
    steps.find((step) => step.id === "telegram-doctor")?.displayCommand,
    "npm --prefix tools/telegram-control run telegram:doctor",
  );
  assert.equal(steps.find((step) => step.id === "telegram-doctor")?.mutatesExternalState, false);
});

void test("activation runner apply mode requires explicit mutating flags", () => {
  const options = parseActivationRunOptions(["--apply"], {});
  const steps = buildActivationRunSteps(options);

  assert.equal(options.apply, true);
  assert.equal(steps.some((step) => step.mutatesExternalState), false);
  assert.match(summarizeActivationRun(options).join("\n"), /Mutating steps enabled: none/);
});

void test("activation runner enables selected live steps without printing namespace id", () => {
  const options = parseActivationRunOptions(
    ["--apply", "--kv", "--deploy", "--github-callback"],
    { CONTROL_STATE_KV_ID: "0123456789abcdef0123456789abcdef" },
  );
  const steps = buildActivationRunSteps(options);

  assert.equal(steps.find((step) => step.id === "worker-deploy")?.mutatesExternalState, true);
  assert.equal(steps.find((step) => step.id === "github-callback-url")?.mutatesExternalState, true);
  assert.equal(steps.find((step) => step.id === "kv")?.mutatesExternalState, true);
  assert.match(steps.find((step) => step.id === "kv")?.displayCommand ?? "", /<CONTROL_STATE_KV_ID>/);
  assert.doesNotMatch(
    steps.map((step) => step.displayCommand).join("\n"),
    /0123456789abcdef0123456789abcdef/,
  );
});

void test("activation runner all mode selects every live activation step", () => {
  const options: ActivationRunOptions = {
    apply: true,
    all: true,
    kv: false,
    createKv: true,
    cloudflareAccountSecrets: false,
    githubOpenAISecret: false,
    githubSnykSecret: false,
    cloudflareSecrets: false,
    githubSecrets: false,
    deploy: false,
    githubCallback: false,
    telegram: false,
    liveSmoke: false,
    externalChecks: false,
    hasControlStateKvId: false,
    controlStateKvId: "",
  };
  const steps = buildActivationRunSteps(options);

  assert.equal(steps.find((step) => step.id === "kv")?.displayCommand.endsWith("--create --write"), true);
  assert.equal(steps.find((step) => step.id === "cloudflare-account-secrets")?.mutatesExternalState, true);
  assert.equal(steps.find((step) => step.id === "github-app-manifest")?.mutatesExternalState, false);
  assert.match(
    steps.find((step) => step.id === "github-account-secrets")?.displayCommand ?? "",
    /--github --github-snyk/,
  );
  assert.doesNotMatch(steps.find((step) => step.id === "github-account-secrets")?.displayCommand ?? "", /openai/);
  assert.equal(steps.find((step) => step.id === "telegram-webhook")?.mutatesExternalState, true);
  assert.equal(
    steps.find((step) => step.id === "doctor")?.displayCommand,
    "npm --prefix tools/telegram-control run activation:doctor -- --github --cloudflare",
  );
  assert.equal(
    steps.find((step) => step.id === "telegram-doctor")?.displayCommand,
    "npm --prefix tools/telegram-control run telegram:doctor -- --live",
  );
  assert.equal(steps.find((step) => step.id === "live-smoke")?.shouldRun, true);
});

void test("activation runner requires explicit OpenAI secret flag", () => {
  const options = parseActivationRunOptions(["--apply", "--github-openai-secret"], {});
  const step = buildActivationRunSteps(options).find((candidate) => candidate.id === "github-account-secrets");

  assert.equal(step?.mutatesExternalState, true);
  assert.match(step?.displayCommand ?? "", /--github --github-openai/);
});
