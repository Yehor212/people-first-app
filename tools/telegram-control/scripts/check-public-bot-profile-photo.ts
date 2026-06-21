import { fileURLToPath } from "node:url";
import { TELEGRAM_BOT_USERPIC_RELATIVE_PATH } from "../src/setup";
import { checkTelegramPublicBotProfilePhoto } from "../src/telegram-readiness";

const args = process.argv.slice(2);
const required =
  args.includes("--required") ||
  process.env.ZENFLOW_TELEGRAM_PUBLIC_BOT_PROFILE_PHOTO_REQUIRED === "true";
const approvedPhotoPath =
  process.env.TELEGRAM_BOT_USERPIC_PATH ??
  fileURLToPath(new URL("../../../" + TELEGRAM_BOT_USERPIC_RELATIVE_PATH, import.meta.url));

const check = await checkTelegramPublicBotProfilePhoto({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  approvedPhotoPath,
});

console.log(`[telegram-public-bot-profile-photo] ${check.status} ${check.evidence}`);

if (check.status === "FAIL") {
  process.exitCode = 1;
} else if (check.status === "UNVERIFIED" && required) {
  process.exitCode = 2;
}
