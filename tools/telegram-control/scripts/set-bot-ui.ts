import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  TELEGRAM_BOT_USERPIC_RELATIVE_PATH,
  buildTelegramCommandsPayload,
  buildTelegramMenuButtonPayload,
  buildTelegramProfilePhotoPayload,
  redactTelegramMenuButtonPayload,
  redactTelegramProfilePhotoPayload,
} from "../src/setup";

const dryRun = process.argv.includes("--dry-run");
const profilePhotoOnly = process.argv.includes("--profile-photo-only");
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl =
  process.env.TELEGRAM_MINI_APP_URL ??
  miniAppUrlFromControlBase(process.env.TELEGRAM_CONTROL_BASE_URL);
const defaultBotUserpicPath = fileURLToPath(
  new URL(`../../../${TELEGRAM_BOT_USERPIC_RELATIVE_PATH}`, import.meta.url)
);
const botUserpicPath = process.env.TELEGRAM_BOT_USERPIC_PATH ?? defaultBotUserpicPath;

const missing = [
  !botToken ? "TELEGRAM_BOT_TOKEN" : "",
  !profilePhotoOnly && !miniAppUrl ? "TELEGRAM_MINI_APP_URL or TELEGRAM_CONTROL_BASE_URL" : "",
].filter(Boolean);

if (missing.length > 0 && !dryRun) {
  console.error(`Missing required environment: ${missing.join(", ")}.`);
  process.exit(1);
}

const commandsPayload = profilePhotoOnly ? null : buildTelegramCommandsPayload();
const menuPayload =
  profilePhotoOnly || !miniAppUrl ? null : buildTelegramMenuButtonPayload(miniAppUrl);
const profilePhotoPayload = buildTelegramProfilePhotoPayload();

if (dryRun) {
  console.log(
    missing.length > 0
      ? "Telegram bot UI setup dry run: UNVERIFIED"
      : "Telegram bot UI setup dry run:"
  );
  for (const key of missing) console.log(`UNVERIFIED ${key} - missing from environment`);
  console.log(
    JSON.stringify(
      {
        mode: profilePhotoOnly ? "profile-photo-only" : "full-ui",
        ...(commandsPayload ? { commands: commandsPayload.commands } : {}),
        ...(menuPayload ? { menu: redactTelegramMenuButtonPayload(menuPayload) } : {}),
        profilePhoto: {
          ...redactTelegramProfilePhotoPayload(profilePhotoPayload),
          method: "setMyProfilePhoto",
          path: botUserpicPath,
        },
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (commandsPayload && menuPayload) {
  await callTelegram("setMyCommands", commandsPayload);
  await callTelegram("setChatMenuButton", menuPayload);
}
await callTelegramProfilePhoto("setMyProfilePhoto", profilePhotoPayload, botUserpicPath);
console.log("Telegram bot UI setup PASS");

async function callTelegramProfilePhoto(
  method: string,
  payload: ReturnType<typeof buildTelegramProfilePhotoPayload>,
  filePath: string
): Promise<void> {
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.set("photo", JSON.stringify(payload.photo));
  form.set(
    payload.attachName,
    new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
    basename(filePath)
  );

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    body: form,
  });
  const result = (await response.json()) as { ok?: boolean; description?: string };

  if (!response.ok || !result.ok) {
    console.error(
      `Telegram ${method} failed: ${response.status} ${result.description ?? "unknown error"}`
    );
    process.exit(1);
  }
}

async function callTelegram(method: string, body: unknown): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { ok?: boolean; description?: string };

  if (!response.ok || !result.ok) {
    console.error(
      `Telegram ${method} failed: ${response.status} ${result.description ?? "unknown error"}`
    );
    process.exit(1);
  }
}

function miniAppUrlFromControlBase(baseUrl: string | undefined): string | undefined {
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/miniapp` : undefined;
}
