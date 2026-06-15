import type { Page } from "@playwright/test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version: string };

export type ZenflowV2Language = "en" | "uk" | "ar" | "he";
export type ZenflowV2Theme = "paper" | "ink" | "oled";
export type ZenflowV2Layout = "phone" | "desktop";
export type ZenflowV2Route = "orb" | "habits" | "diary" | "settings";

export interface PrimeZenflowV2Options {
  analytics?: boolean;
  clearStorage?: boolean;
  language?: ZenflowV2Language;
  privacyNoTracking?: boolean;
  theme?: ZenflowV2Theme;
  user?: {
    email?: string;
    id: string;
    name: string;
  };
}

export async function primeZenflowV2(
  page: Page,
  options: PrimeZenflowV2Options = {},
) {
  await page.addInitScript(
    ({ appVersion, options }) => {
      const json = (value: unknown) => JSON.stringify(value);
      const today = new Date().toISOString().split("T")[0];
      const theme = options.theme ?? "paper";

      if (options.clearStorage) {
        localStorage.clear();
        sessionStorage.clear();
      }

      localStorage.setItem("zenflow-language", json(options.language ?? "en"));
      localStorage.setItem("zenflow-language-selected", json(true));
      localStorage.setItem("zenflow-google-auth-checked", json(true));
      localStorage.setItem("zenflow-tutorial-complete", json(true));
      localStorage.setItem("zenflow-onboarding-complete", json(true));
      localStorage.setItem("zenflow-notification-permission-checked", json(true));
      localStorage.setItem("zenflow_last_seen_version", appVersion);
      localStorage.setItem("zenflow_last_active", today);
      localStorage.setItem("zenflow-last-weekly-report", new Date().toISOString());
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
      localStorage.setItem("zenflow-privacy-acknowledged", json(true));
      localStorage.setItem(
        "zenflow-privacy",
        json({
          analytics: options.analytics === true && options.privacyNoTracking !== true,
          consentShown: true,
          noTracking: options.privacyNoTracking === true,
        }),
      );
      localStorage.setItem(
        "zenflow_onboarding_state",
        json({
          daysActive: 5,
          firstLoginDate: Date.now(),
          hasSeenWelcome: true,
          isNewUser: false,
          lastActiveDate: today,
          unlockedFeatures: [],
        }),
      );
      localStorage.setItem("zenflow-theme", theme === "paper" ? "light" : "dark");
      localStorage.setItem("zenflow_oled_mode", theme === "oled" ? "true" : "false");
      localStorage.setItem(
        "zenflow:theme-v0c",
        json({ state: { theme }, version: 0 }),
      );

      if (options.user) {
        localStorage.setItem(
          "zenflow-user",
          json({
            email: options.user.email ?? `${options.user.id}@example.invalid`,
            id: options.user.id,
            name: options.user.name,
          }),
        );
      }

      sessionStorage.removeItem("zenflow-orb-webgl-slow-ms");
      sessionStorage.removeItem("zenflow-mood-entry-draft");
    },
    { appVersion: packageJson.version, options },
  );
}

export function v2RoutePath(
  route: ZenflowV2Route,
  options: { dev?: boolean; layout?: ZenflowV2Layout } = {},
) {
  const params = new URLSearchParams({ nav: "v2" });
  if (options.layout) params.set("navLayout", options.layout);
  if (options.dev ?? true) params.set("dev", "true");
  return `${route}?${params.toString()}`;
}
