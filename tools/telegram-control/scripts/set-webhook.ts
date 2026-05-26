import { buildTelegramWebhookPayload, redactWebhookPayload } from "../src/setup";

const dryRun = process.argv.includes("--dry-run");
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!webhookUrl || !botToken || !webhookSecret) {
  console.error(
    "Missing required environment. Set TELEGRAM_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, and TELEGRAM_WEBHOOK_SECRET.",
  );
  process.exit(1);
}

const payload = buildTelegramWebhookPayload({ webhookUrl, webhookSecret });

if (dryRun) {
  console.log("Telegram setWebhook dry run:");
  console.log(JSON.stringify(redactWebhookPayload(payload), null, 2));
  process.exit(0);
}

const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const result = (await response.json()) as { ok?: boolean; description?: string };
if (!response.ok || !result.ok) {
  console.error(`Telegram setWebhook failed: ${response.status} ${result.description ?? "unknown error"}`);
  process.exit(1);
}

console.log("Telegram setWebhook PASS");
