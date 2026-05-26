import {
  buildGitHubAppManifest,
  buildGitHubAppManifestFromBase,
  githubAppManifestPostUrl,
  summarizeGitHubAppManifest,
} from "../src/github-app-manifest";

const args = process.argv.slice(2);
const appName = argValue("--name") ?? "ZenFlow Telegram Control";
const organization = argValue("--org") ?? process.env.GITHUB_ORGANIZATION;
const homepageUrl = argValue("--homepage-url") ?? "https://github.com/Yehor212/people-first-app";
const baseUrl = argValue("--base-url") ?? process.env.TELEGRAM_CONTROL_BASE_URL;
const explicitWebhookUrl = argValue("--webhook-url") ?? process.env.TELEGRAM_CONTROL_CALLBACK_URL;
const workflowOwnedPrs = args.includes("--workflow-owned-prs");

let manifest;
try {
  if (explicitWebhookUrl) {
    manifest = buildGitHubAppManifest({
      appName,
      homepageUrl,
      webhookUrl: explicitWebhookUrl,
      setupUrl: baseUrl ? `${new URL(baseUrl).origin}/miniapp` : undefined,
      workflowOwnedPrs,
    });
  } else if (baseUrl) {
    manifest = buildGitHubAppManifestFromBase({
      appName,
      baseUrl,
      homepageUrl,
      workflowOwnedPrs,
    });
  } else {
    throw new Error("Set TELEGRAM_CONTROL_BASE_URL or pass --base-url/--webhook-url.");
  }
} catch (error) {
  console.log(`UNVERIFIED ${error instanceof Error ? error.message : String(error)}`);
  console.log("Dry run only. No GitHub App was created.");
  process.exit(0);
}

console.log("Telegram GitHub App manifest: DRY_RUN");
for (const line of summarizeGitHubAppManifest(manifest)) {
  console.log(line);
}
console.log(`PASS GitHub manifest POST target: ${githubAppManifestPostUrl(organization)}`);
console.log("Manifest JSON:");
console.log(JSON.stringify(manifest, null, 2));
console.log("");
console.log(
  "Use GitHub's personal-account manifest flow by default. Pass --org <organization> only when creating an organization-owned App.",
);
console.log(
  "Then store returned App ID, installation ID, private key, and webhook secret as Cloudflare secrets.",
);

function argValue(name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}
