export interface ActivationRunOptions {
  apply: boolean;
  all: boolean;
  kv: boolean;
  createKv: boolean;
  cloudflareAccountSecrets: boolean;
  githubOpenAISecret: boolean;
  githubSnykSecret: boolean;
  cloudflareSecrets: boolean;
  githubSecrets: boolean;
  deploy: boolean;
  githubCallback: boolean;
  telegram: boolean;
  liveSmoke: boolean;
  externalChecks: boolean;
  hasControlStateKvId: boolean;
  controlStateKvId: string;
}

export interface ActivationRunStep {
  id: string;
  label: string;
  mutatesExternalState: boolean;
  shouldRun: boolean;
  skipReason?: string;
  command: string;
  args: string[];
  displayCommand: string;
  applyEnabled: boolean;
}

export function parseActivationRunOptions(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): ActivationRunOptions {
  return {
    apply: args.includes("--apply"),
    all: args.includes("--all"),
    kv: args.includes("--kv"),
    createKv: args.includes("--create-kv"),
    cloudflareAccountSecrets: args.includes("--cloudflare-account-secrets"),
    githubOpenAISecret: args.includes("--github-openai-secret"),
    githubSnykSecret: args.includes("--github-snyk-secret"),
    cloudflareSecrets: args.includes("--cloudflare-secrets"),
    githubSecrets: args.includes("--github-secrets"),
    deploy: args.includes("--deploy"),
    githubCallback: args.includes("--github-callback"),
    telegram: args.includes("--telegram"),
    liveSmoke: args.includes("--live-smoke"),
    externalChecks: args.includes("--external-checks"),
    controlStateKvId: env.CONTROL_STATE_KV_ID?.trim() ?? "",
    hasControlStateKvId: Boolean(env.CONTROL_STATE_KV_ID?.trim()),
  };
}

export function buildActivationRunSteps(options: ActivationRunOptions): ActivationRunStep[] {
  const applyAll = options.apply && options.all;
  const applyKv = options.apply && (options.kv || options.createKv || applyAll);
  const applyCloudflareAccountSecrets = options.apply && (options.cloudflareAccountSecrets || applyAll);
  const applyGitHubAccountSecrets = options.apply && (options.githubOpenAISecret || options.githubSnykSecret || applyAll);
  const applyCloudflareSecrets = options.apply && (options.cloudflareSecrets || applyAll);
  const applyGithubSecrets = options.apply && (options.githubSecrets || applyAll);
  const applyDeploy = options.apply && (options.deploy || applyAll);
  const applyGithubCallback = options.apply && (options.githubCallback || applyAll);
  const applyTelegram = options.apply && (options.telegram || applyAll);
  const runLiveSmoke = options.liveSmoke || applyAll;
  const runExternalChecks = options.externalChecks || applyAll;

  return [
    {
      id: "kv",
      label: "Cloudflare CONTROL_STATE KV",
      mutatesExternalState: applyKv,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "setup:kv",
        "--",
        ...kvArgs(options, applyKv),
      ],
      displayCommand: `npm --prefix tools/telegram-control run setup:kv -- ${kvDisplayArgs(options, applyKv).join(" ")}`,
      applyEnabled: applyKv,
    },
    {
      id: "cloudflare-account-secrets",
      label: "Cloudflare account-owned secrets",
      mutatesExternalState: applyCloudflareAccountSecrets,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "secrets:install-account",
        "--",
        ...(applyCloudflareAccountSecrets ? ["--cloudflare"] : ["--dry-run", "--cloudflare"]),
      ],
      displayCommand: `npm --prefix tools/telegram-control run secrets:install-account -- ${
        applyCloudflareAccountSecrets ? "--cloudflare" : "--dry-run --cloudflare"
      }`,
      applyEnabled: applyCloudflareAccountSecrets,
    },
    {
      id: "github-account-secrets",
      label: "GitHub account-owned secrets",
      mutatesExternalState: applyGitHubAccountSecrets,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "secrets:install-account",
        "--",
        ...githubAccountSecretArgs(options, applyGitHubAccountSecrets),
      ],
      displayCommand: `npm --prefix tools/telegram-control run secrets:install-account -- ${githubAccountSecretDisplayArgs(
        options,
        applyGitHubAccountSecrets,
      ).join(" ")}`,
      applyEnabled: applyGitHubAccountSecrets,
    },
    {
      id: "github-callback-secret",
      label: "GitHub callback shared secret",
      mutatesExternalState: applyGithubSecrets,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "secrets:install-generated",
        "--",
        ...(applyGithubSecrets ? ["--github"] : ["--dry-run"]),
      ],
      displayCommand: `npm --prefix tools/telegram-control run secrets:install-generated -- ${
        applyGithubSecrets ? "--github" : "--dry-run"
      }`,
      applyEnabled: applyGithubSecrets,
    },
    {
      id: "cloudflare-generated-secrets",
      label: "Cloudflare generated shared secrets",
      mutatesExternalState: applyCloudflareSecrets,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "secrets:install-generated",
        "--",
        ...(applyCloudflareSecrets ? ["--cloudflare"] : ["--dry-run"]),
      ],
      displayCommand: `npm --prefix tools/telegram-control run secrets:install-generated -- ${
        applyCloudflareSecrets ? "--cloudflare" : "--dry-run"
      }`,
      applyEnabled: applyCloudflareSecrets,
    },
    {
      id: "worker-deploy",
      label: "Cloudflare Worker deploy",
      mutatesExternalState: applyDeploy,
      shouldRun: true,
      command: "npm",
      args: ["--prefix", "tools/telegram-control", "run", applyDeploy ? "deploy" : "deploy:dry-run"],
      displayCommand: `npm --prefix tools/telegram-control run ${applyDeploy ? "deploy" : "deploy:dry-run"}`,
      applyEnabled: applyDeploy,
    },
    {
      id: "github-callback-url",
      label: "GitHub callback URL secret",
      mutatesExternalState: applyGithubCallback,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "set-github-callback-url",
        "--",
        ...(applyGithubCallback ? ["--github"] : ["--dry-run"]),
      ],
      displayCommand: `npm --prefix tools/telegram-control run set-github-callback-url -- ${
        applyGithubCallback ? "--github" : "--dry-run"
      }`,
      applyEnabled: applyGithubCallback,
    },
    {
      id: "telegram-webhook",
      label: "Telegram webhook",
      mutatesExternalState: applyTelegram,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "set-webhook",
        "--",
        ...(applyTelegram ? [] : ["--dry-run"]),
      ],
      displayCommand: `npm --prefix tools/telegram-control run set-webhook${applyTelegram ? "" : " -- --dry-run"}`,
      applyEnabled: applyTelegram,
    },
    {
      id: "telegram-bot-ui",
      label: "Telegram commands and Mini App button",
      mutatesExternalState: applyTelegram,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "set-bot-ui",
        "--",
        ...(applyTelegram ? [] : ["--dry-run"]),
      ],
      displayCommand: `npm --prefix tools/telegram-control run set-bot-ui${applyTelegram ? "" : " -- --dry-run"}`,
      applyEnabled: applyTelegram,
    },
    {
      id: "live-smoke",
      label: "Deployed Worker smoke",
      mutatesExternalState: false,
      shouldRun: runLiveSmoke,
      skipReason: "pass --live-smoke, or --apply --all after Worker deploy",
      command: "npm",
      args: ["--prefix", "tools/telegram-control", "run", "smoke:live"],
      displayCommand: "npm --prefix tools/telegram-control run smoke:live",
      applyEnabled: runLiveSmoke,
    },
    {
      id: "doctor",
      label: "Activation doctor",
      mutatesExternalState: false,
      shouldRun: true,
      command: "npm",
      args: [
        "--prefix",
        "tools/telegram-control",
        "run",
        "activation:doctor",
        ...(runExternalChecks ? ["--", "--github", "--cloudflare"] : []),
      ],
      displayCommand: `npm --prefix tools/telegram-control run activation:doctor${
        runExternalChecks ? " -- --github --cloudflare" : ""
      }`,
      applyEnabled: false,
    },
  ];
}

export function summarizeActivationRun(options: ActivationRunOptions): string[] {
  const steps = buildActivationRunSteps(options);
  const mode = options.apply ? "APPLY" : "DRY_RUN";
  const mutatingSteps = steps.filter((step) => step.mutatesExternalState).map((step) => step.id);
  return [
    `Telegram control activation runner: ${mode}`,
    mutatingSteps.length > 0
      ? `Mutating steps enabled: ${mutatingSteps.join(", ")}`
      : "Mutating steps enabled: none",
    "Secret values are never printed by the runner.",
  ];
}

function kvArgs(options: ActivationRunOptions, applyKv: boolean): string[] {
  if (!applyKv) {
    return ["--dry-run"];
  }
  if (options.createKv) {
    return ["--create", "--write"];
  }
  return ["--namespace-id", options.controlStateKvId, "--write"];
}

function kvDisplayArgs(options: ActivationRunOptions, applyKv: boolean): string[] {
  if (!applyKv) {
    return ["--dry-run"];
  }
  if (options.createKv) {
    return ["--create", "--write"];
  }
  return ["--namespace-id", "<CONTROL_STATE_KV_ID>", "--write"];
}

function githubAccountSecretArgs(options: ActivationRunOptions, applyGitHubAccountSecrets: boolean): string[] {
  if (!applyGitHubAccountSecrets) {
    return ["--dry-run", "--github"];
  }
  const args = ["--github"];
  if (options.githubOpenAISecret) {
    args.push("--github-openai");
  }
  if (options.githubSnykSecret || options.all) {
    args.push("--github-snyk");
  }
  return args;
}

function githubAccountSecretDisplayArgs(
  options: ActivationRunOptions,
  applyGitHubAccountSecrets: boolean,
): string[] {
  return githubAccountSecretArgs(options, applyGitHubAccountSecrets);
}
