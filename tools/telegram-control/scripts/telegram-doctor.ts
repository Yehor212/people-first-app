import {
  buildTelegramReadinessChecks,
  overallTelegramReadinessStatus,
} from "../src/telegram-readiness";

const args = process.argv.slice(2);
const live = args.includes("--live");

console.log(`Telegram bot readiness doctor (${live ? "live" : "local"} report-only)`);
const checks = await buildTelegramReadinessChecks(process.env, { live });

for (const check of checks) {
  console.log(`${check.status} ${check.name} - ${check.evidence}`);
}

const overall = overallTelegramReadinessStatus(checks);
console.log(`Overall: ${overall}`);

if (overall === "FAIL") {
  process.exitCode = 1;
}
