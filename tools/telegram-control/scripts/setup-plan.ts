const cloudflareSecrets = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_ADMIN_IDS",
  "GITHUB_APP_ID",
  "GITHUB_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "TELEGRAM_CONTROL_CALLBACK_SECRET",
];

const githubSecrets: Array<{ name: string; note?: string }> = [
  { name: "TELEGRAM_CONTROL_CALLBACK_URL" },
  { name: "TELEGRAM_CONTROL_CALLBACK_SECRET" },
  { name: "OPENAI_API_KEY", note: "optional; AI modes return UNVERIFIED without it" },
  { name: "SNYK_TOKEN", note: "optional; security mode skips Snyk without it" },
];

console.log("Telegram control setup plan");
console.log("");
console.log("1. Create free Cloudflare KV namespace:");
console.log("   npx wrangler kv namespace create CONTROL_STATE --config tools/telegram-control/wrangler.jsonc");
console.log("   Then replace REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID in tools/telegram-control/wrangler.jsonc.");
console.log("");
console.log("2. Set Cloudflare secrets without printing values:");
for (const secret of cloudflareSecrets) {
  console.log(`   npx wrangler secret put ${secret} --config tools/telegram-control/wrangler.jsonc`);
}
console.log("");
console.log("3. Deploy Worker after local proof:");
console.log("   npm run check:telegram-control");
console.log("   npm --prefix tools/telegram-control run deploy:dry-run");
console.log("   npx wrangler deploy --config tools/telegram-control/wrangler.jsonc");
console.log("");
console.log("4. Set Telegram webhook from a local shell with env vars set:");
console.log("   PowerShell:");
console.log("   $env:TELEGRAM_WEBHOOK_URL='https://<worker-host>/telegram/webhook'");
console.log("   $env:TELEGRAM_BOT_TOKEN='<redacted>'");
console.log("   $env:TELEGRAM_WEBHOOK_SECRET='<redacted>'");
console.log("   bash/zsh:");
console.log("   export TELEGRAM_WEBHOOK_URL='https://<worker-host>/telegram/webhook'");
console.log("   export TELEGRAM_BOT_TOKEN='<redacted>'");
console.log("   export TELEGRAM_WEBHOOK_SECRET='<redacted>'");
console.log("   npm --prefix tools/telegram-control run set-webhook -- --dry-run");
console.log("   npm --prefix tools/telegram-control run set-webhook");
console.log("");
console.log("5. Configure Telegram command menu and Mini App button:");
console.log("   PowerShell:");
console.log("   $env:TELEGRAM_MINI_APP_URL='https://<worker-host>/miniapp'");
console.log("   bash/zsh:");
console.log("   export TELEGRAM_MINI_APP_URL='https://<worker-host>/miniapp'");
console.log("   npm --prefix tools/telegram-control run set-bot-ui -- --dry-run");
console.log("   npm --prefix tools/telegram-control run set-bot-ui");
console.log("");
console.log("6. Configure GitHub repository secrets:");
for (const secret of githubSecrets) {
  if (secret.note) {
    console.log(`   # ${secret.note}`);
  }
  console.log(`   gh secret set ${secret.name}`);
}
console.log("");
console.log("7. Run deployed proof:");
console.log("   $env:TELEGRAM_CONTROL_BASE_URL='https://<worker-host>'");
console.log("   $env:TELEGRAM_ADMIN_ID='<your Telegram numeric id>'");
console.log("   npm --prefix tools/telegram-control run smoke:live");
console.log("");
console.log("No command above includes a secret value. Enter secrets only into wrangler/gh prompts or local env vars.");
