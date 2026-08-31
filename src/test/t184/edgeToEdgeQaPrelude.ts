import { safeLocalStorageSet, storageRemove } from "@/lib/safeJson";
import { db } from "@/storage/db";
import { parseT184QaLaunchOptions } from "./qaLaunchOptions";

/**
 * Compile-time T184 Android-emulator-only gate state.
 *
 * This module is reachable only from src/test/t184/index.html when
 * VITE_T184_QA_BUILD=true selects that entry. It contains no identity, remote
 * session, habits, diary entries, tasks, or other production/user records.
 */
const qaLaunch = parseT184QaLaunchOptions(window.location.search);

safeLocalStorageSet("zenflow-language", qaLaunch.language);
safeLocalStorageSet("zenflow-language-selected", true);
safeLocalStorageSet("zenflow-google-auth-checked", true);
safeLocalStorageSet("zenflow-onboarding-complete", true);
safeLocalStorageSet("zenflow-notification-permission-checked", true);

await db.open();
await db.settings.bulkPut([
  { key: "zenflow-language-selected", value: true },
  { key: "zenflow-google-auth-checked", value: true },
  { key: "zenflow-onboarding-complete", value: true },
  { key: "zenflow-notification-permission-checked", value: true },
]);

if (qaLaunch.auth) {
  storageRemove("zenflow-google-auth-checked");
  await db.settings.delete("zenflow-google-auth-checked");
}

window.history.replaceState({}, "", `/${qaLaunch.route}/?nav=v2&navLayout=phone`);

await import("../../main.tsx");
