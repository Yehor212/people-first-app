import {
  buildTelegramCommandsPayload,
  buildTelegramMenuButtonPayload,
  redactTelegramMenuButtonPayload,
} from "../src/setup";

const dryRun = process.argv.includes("--dry-run");
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL ?? miniAppUrlFromControlBase(process.env.TELEGRAM_CONTROL_BASE_URL);

if (!botToken || !miniAppUrl) {
  if (dryRun) {
    console.log("Telegram bot UI setup dry run: UNVERIFIED");
    if (!botToken) console.log("UNVERIFIED TELEGRAM_BOT_TOKEN - missing from environment");
    if (!miniAppUrl) {
      console.log("UNVERIFIED TELEGRAM_MINI_APP_URL - set it or TELEGRAM_CONTROL_BASE_URL to deployed Worker origin");
    }
    process.exit(0);
  }

  console.error("Missing required environment. Set TELEGRAM_BOT_TOKEN and TELEGRAM_MINI_APP_URL or TELEGRAM_CONTROL_BASE_URL.");
  process.exit(1);
}

const commandsPayload = buildTelegramCommandsPayload();
const menuPayload = buildTelegramMenuButtonPayload(miniAppUrl);

if (dryRun) {
  console.log("Telegram bot UI setup dry run:");
  console.log(JSON.stringify({
    commands: commandsPayload.commands,
    menu: redactTelegramMenuButtonPayload(menuPayload),
  }, null, 2));
  process.exit(0);
}

await callTelegram("setMyCommands", commandsPayload);
await callTelegram("setChatMenuButton", menuPayload);
console.log("Telegram bot UI setup PASS");

async function callTelegram(method: string, body: unknown): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { ok?: boolean; description?: string };

  if (!response.ok || !result.ok) {
    console.error(`Telegram ${method} failed: ${response.status} ${result.description ?? "unknown error"}`);
    process.exit(1);
  }
}

function miniAppUrlFromControlBase(baseUrl: string | undefined): string | undefined {
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/miniapp` : undefined;
}
