import { callbackUrlFromBase, validateCallbackUrl } from "./callback-url";

export interface GitHubAppManifestInput {
  appName: string;
  homepageUrl: string;
  webhookUrl: string;
  setupUrl?: string;
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
}

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

  return errors;
}

export function buildGitHubAppManifestFromBase(input: {
  appName: string;
  baseUrl: string;
  homepageUrl?: string;
  workflowOwnedPrs?: boolean;
}): GitHubAppManifest {
  const normalizedBase = normalizeHttpsOrigin(input.baseUrl);
  return buildGitHubAppManifest({
    appName: input.appName,
    homepageUrl: input.homepageUrl ?? normalizedBase,
    webhookUrl: callbackUrlFromBase(normalizedBase),
    setupUrl: `${normalizedBase}/miniapp`,
    workflowOwnedPrs: Boolean(input.workflowOwnedPrs),
  });
}

export function githubAppManifestPostUrl(organization: string | undefined): string {
  const normalizedOrganization = organization?.trim();
  if (!normalizedOrganization) {
    return "https://github.com/settings/apps/new";
  }
  return `https://github.com/organizations/${encodeURIComponent(normalizedOrganization)}/settings/apps/new`;
}

export function summarizeGitHubAppManifest(manifest: GitHubAppManifest): string[] {
  const permissions = Object.entries(manifest.default_permissions)
    .map(([name, access]) => `${name}:${access}`)
    .join(", ");
  return [
    `PASS GitHub App manifest name: ${manifest.name}`,
    `PASS Webhook URL: ${redactUrl(manifest.hook_attributes.url)}`,
    `PASS Events: ${manifest.default_events.join(", ")}`,
    `PASS Permissions: ${permissions}`,
    "PASS Manifest does not include App ID, private key, webhook secret, or installation id.",
  ];
}

function validateHttpsUrl(label: string, value: string, options: { requireNoPath: boolean }): string[] {
  const errors: string[] = [];
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return [`GitHub App ${label} must be a valid URL`];
  }

  if (parsed.protocol !== "https:") {
    errors.push(`GitHub App ${label} must use HTTPS`);
  }
  if (parsed.username || parsed.password) {
    errors.push(`GitHub App ${label} must not include credentials`);
  }
  if (options.requireNoPath && parsed.pathname !== "/") {
    errors.push(`GitHub App ${label} must be an origin URL`);
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
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}
