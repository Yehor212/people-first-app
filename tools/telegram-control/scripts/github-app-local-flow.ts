import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  buildGitHubAppManifestFromBase,
  buildGitHubAppManifestRegistrationHtml,
  githubAppManifestConversionUrl,
  githubAppManifestPostUrl,
  manifestConversionCloudflareSecrets,
  summarizeGitHubAppManifest,
  summarizeGitHubAppManifestConversion,
  validateManifestCallbackState,
  type GitHubAppManifestConversion,
} from "../src/github-app-manifest";

const root = resolve(import.meta.dirname, "../../..");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const args = process.argv.slice(2);
const appName = argValue("--name") ?? "ZenFlow Telegram Control";
const organization = argValue("--org") ?? process.env.GITHUB_ORGANIZATION;
const homepageUrl = argValue("--homepage-url") ?? "https://github.com/Yehor212/people-first-app";
const baseUrl = argValue("--base-url") ?? process.env.TELEGRAM_CONTROL_BASE_URL;
const port = parsePort(argValue("--port") ?? "8977");
const state = argValue("--state") ?? randomBytes(16).toString("hex");
const cloudflare = args.includes("--cloudflare");
const apply = args.includes("--apply");
const dryRun = args.includes("--dry-run") || !apply;
const noOpen = args.includes("--no-open");
const noWritePem = args.includes("--no-write-pem");
const pemPath = argValue("--write-pem") ?? defaultPemPath();
const redirectUrl = "http://127.0.0.1:" + port + "/github-app/callback";

console.log("Telegram GitHub App local manifest flow: " + (dryRun ? "DRY_RUN" : "APPLY"));
console.log("This helper does not print private keys, webhook secrets, or tokens.");

if (!baseUrl) {
  console.log("UNVERIFIED Set TELEGRAM_CONTROL_BASE_URL or pass --base-url https://<worker-host>.");
  process.exit(dryRun ? 0 : 1);
}

const manifest = buildGitHubAppManifestFromBase({
  appName,
  baseUrl,
  homepageUrl,
  redirectUrl,
});
const postUrl = githubAppManifestPostUrl(organization);
const registrationHtml = buildGitHubAppManifestRegistrationHtml({ postUrl, manifest, state });
const localUrl = "http://127.0.0.1:" + port + "/";
let callbackHandled = false;
let capturedConversion: GitHubAppManifestConversion | null = null;

for (const line of summarizeGitHubAppManifest(manifest)) {
  console.log(line);
}
console.log("PASS GitHub manifest POST target: " + postUrl);
console.log("PASS Local callback: " + redirectUrl);
console.log("PASS Local registration page: " + localUrl);

if (dryRun) {
  console.log("Dry run only. Re-run with --apply to start the local callback server.");
  console.log(
    "Add --cloudflare to store GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GitHub's generated GITHUB_WEBHOOK_SECRET in Cloudflare after conversion."
  );
  console.log(
    "By default, --apply also saves the returned private key outside the repo at: " + pemPath
  );
  process.exit(0);
}

const { createServer } = await import("node:http");
const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("FAIL " + message);
    response.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    response.end(renderResultPage("GitHub App setup failed", ["FAIL " + message]));
    server.close();
  });
});

await new Promise<void>((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(port, "127.0.0.1", () => resolveListen());
});

console.log("PASS Local callback server listening on " + localUrl);
if (!noOpen) {
  openLocalUrl(localUrl);
}
console.log("Open the local setup page if it did not open automatically: " + localUrl);

await new Promise<void>((resolveDone) => {
  server.on("close", () => resolveDone());
});

if (capturedConversion) {
  const secrets = manifestConversionCloudflareSecrets(capturedConversion);
  if (!noWritePem) {
    await writePrivateKeyFile(pemPath, secrets.GITHUB_APP_PRIVATE_KEY);
    console.log("PASS GitHub App private key saved outside repo: " + pemPath);
  }

  if (cloudflare) {
    putCloudflareSecret("GITHUB_APP_ID", secrets.GITHUB_APP_ID);
    putCloudflareSecret("GITHUB_APP_PRIVATE_KEY", secrets.GITHUB_APP_PRIVATE_KEY);
    putCloudflareSecret("GITHUB_WEBHOOK_SECRET", secrets.GITHUB_WEBHOOK_SECRET);
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", localUrl);

  if (request.method === "GET" && requestUrl.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(registrationHtml);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/github-app/callback") {
    if (callbackHandled) {
      response.writeHead(409, { "content-type": "text/html; charset=utf-8" });
      response.end(
        renderResultPage("GitHub App setup already handled", [
          "FAIL This local callback accepts only one manifest conversion response.",
        ])
      );
      return;
    }
    callbackHandled = true;

    const code = requestUrl.searchParams.get("code") ?? "";
    const callbackState = requestUrl.searchParams.get("state");
    const stateErrors = validateManifestCallbackState(state, callbackState);
    if (!code.trim()) {
      stateErrors.push("GitHub App manifest callback code is missing");
    }
    if (stateErrors.length > 0) {
      response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      response.end(
        renderResultPage(
          "GitHub App setup stopped",
          stateErrors.map((line) => "FAIL " + line)
        )
      );
      server.close();
      return;
    }

    const conversion = await exchangeManifestCode(code);
    const summary = summarizeGitHubAppManifestConversion(conversion);
    capturedConversion = conversion;

    for (const line of summary) {
      console.log(line);
    }

    const nextLines = [
      "PASS GitHub App manifest conversion captured.",
      "NEXT Review the terminal for the GitHub App URL and installation URL.",
      "NEXT After install, copy the numeric installation id from GitHub and store GITHUB_INSTALLATION_ID.",
      "NEXT Then rerun the activation doctor.",
      ...(noWritePem
        ? []
        : ["NEXT The terminal will save the private key file after this page closes."]),
      ...(cloudflare
        ? ["NEXT The terminal will store GitHub App secrets in Cloudflare after this page closes."]
        : []),
      "PASS No secret values were printed.",
    ];
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderResultPage("GitHub App setup captured", nextLines));
    server.close();
    return;
  }

  response.writeHead(302, { location: "/" });
  response.end();
}

async function exchangeManifestCode(code: string): Promise<GitHubAppManifestConversion> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "zenflow-telegram-control-setup",
    "x-github-api-version": "2026-03-10",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = "Bearer " + process.env.GITHUB_TOKEN;
  }

  const response = await fetch(githubAppManifestConversionUrl(code), {
    method: "POST",
    headers,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      "GitHub manifest conversion failed with HTTP " + response.status + ": " + body.slice(0, 300)
    );
  }
  return (await response.json()) as GitHubAppManifestConversion;
}

async function writePrivateKeyFile(targetPath: string, value: string): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true, mode: 0o700 });
  await writeFile(targetPath, value.endsWith("\n") ? value : value + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

function putCloudflareSecret(
  name: "GITHUB_APP_ID" | "GITHUB_APP_PRIVATE_KEY" | "GITHUB_WEBHOOK_SECRET",
  value: string
): void {
  const invocation = commandInvocation("npx", [
    "wrangler",
    "secret",
    "put",
    name,
    "--config",
    workerConfigPath,
  ]);
  const result = spawnSync(invocation.command, invocation.args, {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(result.status ?? 1);
  }
  console.log("PASS Cloudflare Worker secret " + name + " stored");
}

function renderResultPage(title: string, lines: string[]): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>" + escapeHtml(title) + "</title>",
    "</head>",
    "<body>",
    "<main>",
    "<h1>" + escapeHtml(title) + "</h1>",
    "<ul>",
    ...lines.map((line) => "<li>" + escapeHtml(line) + "</li>"),
    "</ul>",
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function openLocalUrl(url: string): void {
  const invocation =
    process.platform === "darwin"
      ? { command: "open", args: [url] }
      : process.platform === "win32"
        ? { command: "cmd.exe", args: ["/d", "/s", "/c", "start", "", url] }
        : { command: "xdg-open", args: [url] };
  spawnSync(invocation.command, invocation.args, { stdio: "ignore" });
}

function commandInvocation(
  command: string,
  commandArgs: string[]
): { command: string; args: string[] } {
  if (process.platform === "win32" && (command === "npx" || command === "npm")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...commandArgs] };
  }
  return { command, args: commandArgs };
}

function defaultPemPath(): string {
  return resolve(homedir(), ".config", "zenflow", "telegram-control", "github-app.private-key.pem");
}

function parsePort(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
    throw new Error("--port must be an integer between 1024 and 65535");
  }
  return parsed;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function argValue(name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}
