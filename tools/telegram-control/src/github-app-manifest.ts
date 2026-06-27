import { callbackUrlFromBase, validateCallbackUrl } from "./callback-url";

export interface GitHubAppManifestInput {
  appName: string;
  homepageUrl: string;
  webhookUrl: string;
  setupUrl?: string;
  redirectUrl?: string;
  workflowOwnedPrs: boolean;
}

export interface GitHubAppManifest {
  name: string;
  url: string;
  hook_attributes: {
    url: string;
    active: boolean;
  };
  public: boolean;
  default_permissions: Record<string, "read" | "write">;
  default_events: string[];
  setup_url?: string;
  redirect_url?: string;
}

export interface GitHubAppManifestRegistrationHtmlInput {
  postUrl: string;
  manifest: GitHubAppManifest;
  state: string;
}

export interface GitHubAppManifestConversion {
  id: number | string;
  slug?: string;
  html_url?: string;
  webhook_secret?: string;
  pem?: string;
}

export type ManifestConversionCloudflareSecrets = {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
};

export function buildGitHubAppManifest(input: GitHubAppManifestInput): GitHubAppManifest {
  const errors = validateGitHubAppManifestInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const permissions: Record<string, "read" | "write"> = {
    metadata: "read",
    actions: "write",
  };

  if (input.workflowOwnedPrs) {
    permissions.contents = "write";
    permissions.pull_requests = "write";
    permissions.issues = "write";
  }

  const manifest: GitHubAppManifest = {
    name: input.appName,
    url: input.homepageUrl,
    hook_attributes: {
      url: input.webhookUrl,
      active: true,
    },
    public: false,
    default_permissions: permissions,
    default_events: ["workflow_run"],
  };

  if (input.setupUrl) {
    manifest.setup_url = input.setupUrl;
  }

  if (input.redirectUrl) {
    manifest.redirect_url = input.redirectUrl;
  }

  return manifest;
}

export function validateGitHubAppManifestInput(input: GitHubAppManifestInput): string[] {
  const errors: string[] = [];

  if (!input.appName.trim()) {
    errors.push("GitHub App name is required");
  }

  errors.push(...validateHttpsUrl("homepage URL", input.homepageUrl, { requireNoPath: false }));
  errors.push(...validateCallbackUrl(input.webhookUrl));

  if (input.setupUrl) {
    errors.push(...validateHttpsUrl("setup URL", input.setupUrl, { requireNoPath: false }));
  }

  if (input.redirectUrl) {
    errors.push(...validateRedirectUrl("redirect URL", input.redirectUrl));
  }

  return errors;
}

export function buildGitHubAppManifestFromBase(input: {
  appName: string;
  baseUrl: string;
  homepageUrl?: string;
  workflowOwnedPrs?: boolean;
  redirectUrl?: string;
}): GitHubAppManifest {
  const normalizedBase = normalizeHttpsOrigin(input.baseUrl);
  return buildGitHubAppManifest({
    appName: input.appName,
    homepageUrl: input.homepageUrl ?? normalizedBase,
    webhookUrl: callbackUrlFromBase(normalizedBase),
    setupUrl: normalizedBase + "/miniapp",
    redirectUrl: input.redirectUrl,
    workflowOwnedPrs: Boolean(input.workflowOwnedPrs),
  });
}

export function githubAppManifestPostUrl(organization: string | undefined): string {
  const normalizedOrganization = organization?.trim();
  if (!normalizedOrganization) {
    return "https://github.com/settings/apps/new";
  }
  return "https://github.com/organizations/" + encodeURIComponent(normalizedOrganization) + "/settings/apps/new";
}

export function githubAppManifestConversionUrl(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error("GitHub App manifest code is required");
  }
  return "https://api.github.com/app-manifests/" + encodeURIComponent(trimmed) + "/conversions";
}

export function buildGitHubAppManifestRegistrationHtml(
  input: GitHubAppManifestRegistrationHtmlInput,
): string {
  const postUrl = new URL(input.postUrl);
  postUrl.searchParams.set("state", input.state);
  const manifestJson = JSON.stringify(input.manifest);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Register ZenFlow GitHub App</title>",
    "</head>",
    "<body>",
    "<main>",
    "<h1>Register ZenFlow GitHub App</h1>",
    "<p>This local page posts the reviewed manifest to GitHub. It does not contain generated secrets.</p>",
    '<form action="' + escapeHtml(postUrl.toString()) + '" method="post">',
    '<input type="hidden" name="manifest" value="' + escapeHtml(manifestJson) + '">',
    '<button type="submit">Open GitHub App registration</button>',
    "</form>",
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

export function manifestConversionCloudflareSecrets(
  conversion: GitHubAppManifestConversion,
): ManifestConversionCloudflareSecrets {
  const errors = validateGitHubAppManifestConversion(conversion);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return {
    GITHUB_APP_ID: String(conversion.id).trim(),
    GITHUB_APP_PRIVATE_KEY: conversion.pem!.trim(),
    GITHUB_WEBHOOK_SECRET: conversion.webhook_secret!.trim(),
  };
}

export function validateGitHubAppManifestConversion(
  conversion: GitHubAppManifestConversion,
): string[] {
  const errors: string[] = [];
  const appId = String(conversion.id ?? "").trim();
  const webhookSecret = conversion.webhook_secret?.trim() ?? "";
  const privateKey = conversion.pem?.trim() ?? "";

  if (!/^\d+$/.test(appId)) {
    errors.push("GitHub App manifest conversion id must be numeric");
  }
  if (webhookSecret.length < 16) {
    errors.push("GitHub App manifest conversion webhook secret is missing or too short");
  }
  if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY") || !privateKey.includes("END")) {
    errors.push("GitHub App manifest conversion private key is missing or malformed");
  }

  return errors;
}

export function summarizeGitHubAppManifest(manifest: GitHubAppManifest): string[] {
  const permissions = Object.entries(manifest.default_permissions)
    .map(([name, access]) => name + ":" + access)
    .join(", ");
  return [
    "PASS GitHub App manifest name: " + manifest.name,
    "PASS Webhook URL: " + redactUrl(manifest.hook_attributes.url),
    ...(manifest.redirect_url ? ["PASS Manifest redirect URL: " + redactUrl(manifest.redirect_url)] : []),
    "PASS Events: " + manifest.default_events.join(", "),
    "PASS Permissions: " + permissions,
    "PASS Manifest does not include App ID, private key, webhook secret, or installation id.",
  ];
}

export function summarizeGitHubAppManifestConversion(
  conversion: GitHubAppManifestConversion,
): string[] {
  const secrets = manifestConversionCloudflareSecrets(conversion);
  return [
    "PASS GitHub App ID: " + secrets.GITHUB_APP_ID,
    ...(conversion.html_url ? ["PASS GitHub App URL: " + redactUrl(conversion.html_url)] : []),
    ...(conversion.slug ? ["PASS GitHub App slug: " + conversion.slug] : []),
    "PASS GitHub webhook secret present (" + redactedLength(secrets.GITHUB_WEBHOOK_SECRET) + "); value not printed",
    "PASS GitHub private key present (" + redactedLength(secrets.GITHUB_APP_PRIVATE_KEY) + "); value not printed",
  ];
}

export function validateManifestCallbackState(expected: string, actual: string | null): string[] {
  const errors: string[] = [];
  if (!expected) {
    errors.push("GitHub App manifest expected state is required");
  }
  if (expected !== actual) {
    errors.push("GitHub App manifest callback state mismatch");
  }
  return errors;
}

function validateHttpsUrl(label: string, value: string, options: { requireNoPath: boolean }): string[] {
  const errors: string[] = [];
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return ["GitHub App " + label + " must be a valid URL"];
  }

  if (parsed.protocol !== "https:") {
    errors.push("GitHub App " + label + " must use HTTPS");
  }
  if (parsed.username || parsed.password) {
    errors.push("GitHub App " + label + " must not include credentials");
  }
  if (options.requireNoPath && parsed.pathname !== "/") {
    errors.push("GitHub App " + label + " must be an origin URL");
  }
  return errors;
}

function validateRedirectUrl(label: string, value: string): string[] {
  const errors: string[] = [];
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return ["GitHub App " + label + " must be a valid URL"];
  }

  const isLocalHttp = parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    errors.push("GitHub App " + label + " must use HTTPS or local loopback HTTP");
  }
  if (parsed.username || parsed.password) {
    errors.push("GitHub App " + label + " must not include credentials");
  }
  return errors;
}

function normalizeHttpsOrigin(value: string): string {
  const errors = validateHttpsUrl("base URL", value, { requireNoPath: false });
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return new URL(value).origin;
}

function redactUrl(value: string): string {
  const parsed = new URL(value);
  return parsed.protocol + "//" + parsed.host + parsed.pathname;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function redactedLength(value: string): string {
  return value.length + " chars";
}
