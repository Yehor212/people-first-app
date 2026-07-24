import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultReminderSettings } from "@/lib/reminders";
import type { V2SettingsControls } from "../types";

const languageMock = vi.hoisted(() => ({
  language: "uk",
  t: {
    authLinkedProviders: "Connected sign-in methods",
    cancel: "Cancel",
    delete: "Delete",
    deleteAccount: "Delete account",
    deleteAccountConfirm: "Delete your account?",
    deleteAccountLink: "Learn about account deletion",
    deleteAccountTypeConfirm: "Type DELETE to confirm:",
    deleteAccountWarning:
      "Deleting your account removes your sign-in and account-scoped data. Some records are retained as explained below.",
    deleting: "Deleting…",
    settingsAccountBackupDescription: "Account description",
    settingsAccountBackupTitle: "Account & backup",
    signOut: "Sign out",
    signedInAs: "Signed in as",
  },
}));

const accountAuthMock = vi.hoisted(() => ({
  authStatus: null,
  enabledProviders: [],
  handleDiscardPendingAndSignOut: vi.fn(),
  handleAccountCleanupRetry: vi.fn(),
  handleProvider: vi.fn(),
  handleSignOut: vi.fn(),
  hasSession: true,
  isSigningIn: false,
  isSigningOut: false,
  linkedProviderIds: [],
  refreshSession: vi.fn(),
  sessionAccountLabel: "avery@example.com",
  sessionCheckState: "signed-in",
  sessionDisplayName: "Avery",
  sessionUserId: "account-a",
  signingInProvider: null,
  signOutBlockReason: null,
}));

const deleteAccountMock = vi.hoisted(() => ({
  closeDeleteConfirmation: vi.fn(() => true),
  deleteConfirmInput: "",
  deleteConfirmMatches: false,
  deleteStatus: null,
  handleDeleteAccount: vi.fn(),
  isDeletingAccount: false,
  openDeleteConfirmation: vi.fn(),
  setDeleteConfirmInput: vi.fn(),
  showDeleteConfirm: true,
}));

vi.mock("@/components/auth/AuthProviderButton", () => ({
  AuthProviderButton: () => null,
}));

vi.mock("@/components/settings/account-section/useAccountAuth", () => ({
  useAccountAuth: () => accountAuthMock,
}));

vi.mock("@/components/settings/account-section/useDeleteAccount", () => ({
  useDeleteAccount: () => deleteAccountMock,
}));

vi.mock("@/components/settings/data-section/useDataExport", () => ({
  useDataExport: () => ({
    handleExport: vi.fn(),
    isExporting: false,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => languageMock,
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  BASE_URL: "/people-first-app/",
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {},
}));

import { fr } from "@/i18n/languages/fr";
import { AccountPanel } from "../V2SettingsAccountPanel";
import type { AccountAuthController } from "../useSettingsOverviewModules";

const SUPPORTED_LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"] as const;
const RTL_LOCALES = new Set(["ar", "he"]);
const LANGUAGE_NAV_LABELS = {
  en: "Language",
  uk: "Мова",
  es: "Idioma",
  de: "Sprache",
  fr: "Langue",
  ja: "言語",
  ar: "اللغة",
  he: "שפה",
} as const;
const DISCLOSURE_FIELDS = [
  "removed-sign-in",
  "removed-account-data",
  "other-device-copies",
  "retained-feedback",
  "retained-safety-record",
  "recovery-copies",
  "accepted-notifications",
  "support-request",
] as const;

function createControls(): V2SettingsControls {
  return {
    userName: "Avery",
    userNameCustom: true,
    onNameChange: vi.fn(),
    onResetData: vi.fn(),
    reminders: defaultReminderSettings,
    onRemindersChange: vi.fn(),
    habits: [],
    moods: [],
    focusSessions: [],
    gratitudeEntries: [],
    privacy: {
      noTracking: false,
      analytics: false,
      consentShown: true,
      adConsent: false,
      pushNotifications: false,
    },
    onPrivacyChange: vi.fn(),
  };
}

function isBefore(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function hasUnisolatedBrandText(section: Element): boolean {
  const walker = section.ownerDocument.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (
      node.textContent?.includes("ZenFlow") &&
      !(node.parentElement?.closest('bdi[dir="ltr"]')?.textContent ?? "").includes("ZenFlow")
    ) {
      return true;
    }
    node = walker.nextNode();
  }
  return false;
}

describe("account deletion disclosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("puts warning and deletion details before the confirmation field and describes the field", () => {
    render(
      <AccountPanel
        controls={createControls()}
        auth={accountAuthMock as unknown as AccountAuthController}
        accountViewState="signed-in"
      />
    );

    const confirmation = screen.getByTestId("settings-v2-delete-confirmation");
    const input = screen.getByLabelText("Type DELETE to confirm:");
    const title = document.getElementById("settings-v2-delete-title");
    const warning = document.getElementById("settings-v2-delete-warning");
    const details = document.getElementById("settings-v2-delete-details");

    expect.soft(title, "the focused confirmation group needs a stable title id").not.toBeNull();
    expect.soft(warning, "the destructive warning needs a stable description id").not.toBeNull();
    expect.soft(details, "the full disclosure link needs a stable description id").not.toBeNull();

    expect.soft(confirmation.getAttribute("aria-labelledby")).toBe("settings-v2-delete-title");
    expect.soft(confirmation.getAttribute("aria-label")).toBeNull();
    for (const element of [confirmation, input]) {
      const describedBy = new Set((element.getAttribute("aria-describedby") ?? "").split(/\s+/u));
      expect.soft(describedBy.has("settings-v2-delete-warning")).toBe(true);
      expect.soft(describedBy.has("settings-v2-delete-details")).toBe(true);
    }

    if (!title || !warning || !details) return;
    expect(confirmation).toContainElement(title);
    expect(confirmation).toContainElement(warning);
    expect(confirmation).toContainElement(details);
    expect(isBefore(title, warning)).toBe(true);
    expect(isBefore(warning, details)).toBe(true);
    expect(isBefore(details, input)).toBe(true);
  });

  it("passes the active app locale to the public deletion disclosure", () => {
    render(
      <AccountPanel
        controls={createControls()}
        auth={accountAuthMock as unknown as AccountAuthController}
        accountViewState="signed-in"
      />
    );

    expect(screen.getByRole("link", { name: "Learn about account deletion" })).toHaveAttribute(
      "href",
      "/people-first-app/delete-account.html?lang=uk"
    );
  });

  it("allowlists the public locale query and falls back without interpreting attacker input", async () => {
    const moduleUrl = `${
      pathToFileURL(resolve(process.cwd(), "public/delete-account-language.mjs")).href
    }?test=${Date.now()}`;
    const languageModule = (await import(moduleUrl)) as {
      resolveDeleteAccountLocale: (requested: string | null, browserLanguage: string) => string;
      protectDeleteAccountBrandTokens: (doc: Document) => number;
      applyDeleteAccountLocale: (options: {
        doc: Document;
        search: string;
        browserLanguage: string;
      }) => string;
    };

    expect(languageModule.resolveDeleteAccountLocale("uk", "en-US")).toBe("uk");
    expect(languageModule.resolveDeleteAccountLocale("AR", "en-US")).toBe("ar");
    expect(languageModule.resolveDeleteAccountLocale(null, "fr-CA")).toBe("fr");
    expect(languageModule.resolveDeleteAccountLocale("../../he", "he-IL")).toBe("en");
    expect(languageModule.resolveDeleteAccountLocale('<img src=x onerror="alert(1)">', "ar")).toBe(
      "en"
    );

    const html = readFileSync(resolve(process.cwd(), "public/delete-account.html"), "utf8");
    const page = new DOMParser().parseFromString(html, "text/html");
    const protectedTokenCount = languageModule.protectDeleteAccountBrandTokens(page);
    expect(protectedTokenCount).toBeGreaterThan(0);
    expect(page.querySelectorAll(".brand-token").length).toBe(protectedTokenCount);
    expect(
      Array.from(page.querySelectorAll<HTMLElement>(".brand-token")).every(
        (token) => token.textContent === "ZenFlow",
      ),
    ).toBe(true);
    expect(languageModule.protectDeleteAccountBrandTokens(page)).toBe(0);
    const navigation = page.querySelector("[data-delete-account-language-nav]");
    for (const locale of SUPPORTED_LOCALES) {
      languageModule.applyDeleteAccountLocale({
        doc: page,
        search: `?lang=${locale}`,
        browserLanguage: "en-US",
      });
      expect.soft(navigation?.getAttribute("aria-label"), locale).toBe(LANGUAGE_NAV_LABELS[locale]);
    }
  });

  it("uses natural French feedback wording instead of calling feedback messages", () => {
    expect(fr.deleteAccountWarning).not.toMatch(/\bmessages\b/iu);
    expect(fr.deleteAccountWarning).toMatch(/\b(?:commentaires|retours?)\b/iu);
  });

  it("publishes one complete, direction-aware disclosure for every supported locale", () => {
    const html = readFileSync(resolve(process.cwd(), "public/delete-account.html"), "utf8");
    const page = new DOMParser().parseFromString(html, "text/html");
    const localeSections = Array.from(
      page.querySelectorAll<HTMLElement>("[data-delete-account-locale]")
    );

    expect.soft(localeSections).toHaveLength(SUPPORTED_LOCALES.length);
    expect
      .soft(localeSections.map((section) => section.dataset.deleteAccountLocale))
      .toEqual(expect.arrayContaining([...SUPPORTED_LOCALES]));

    for (const locale of SUPPORTED_LOCALES) {
      const section = page.querySelector<HTMLElement>(`[data-delete-account-locale="${locale}"]`);
      expect.soft(section, `missing ${locale} deletion disclosure`).not.toBeNull();
      if (!section) continue;

      expect.soft(section.getAttribute("lang")).toBe(locale);
      expect.soft(section.getAttribute("dir")).toBe(RTL_LOCALES.has(locale) ? "rtl" : "ltr");
      expect
        .soft(section.getAttribute("data-language-nav-label"))
        .toBe(LANGUAGE_NAV_LABELS[locale]);
      for (const field of DISCLOSURE_FIELDS) {
        expect
          .soft(
            section.querySelector(`[data-deletion-disclosure="${field}"]`),
            `${locale} is missing ${field}`
          )
          .not.toBeNull();
      }

      const recoveryDisclosure = section.querySelector(
        '[data-deletion-disclosure="recovery-copies"]'
      );
      expect
        .soft(recoveryDisclosure?.querySelector('a[href^="mailto:zenflow.app@gmail.com"]'), locale)
        .not.toBeNull();

      if (RTL_LOCALES.has(locale)) {
        expect.soft(section.querySelector('bdi[dir="ltr"]')?.textContent).toContain("ZenFlow");
        expect
          .soft(hasUnisolatedBrandText(section), `${locale} has an unisolated brand token`)
          .toBe(false);
        expect.soft(section.textContent).not.toMatch(/[\u202A-\u202E]/u);
      }
    }
  });

  it("keeps disclosure prose on natural word boundaries at 200-percent text size", () => {
    const html = readFileSync(resolve(process.cwd(), "public/delete-account.html"), "utf8");

    expect(html).not.toMatch(
      /h1\s*,\s*h2\s*,\s*p\s*,\s*li\s*\{[^}]*overflow-wrap\s*:\s*anywhere/isu,
    );
    expect(html).toMatch(
      /h1\s*,\s*h2\s*,\s*p\s*,\s*li\s*\{[^}]*overflow-wrap\s*:\s*break-word/isu,
    );
    expect(html).toMatch(
      /h1\s*,\s*h2\s*,\s*p\s*,\s*li\s*\{[^}]*hyphens\s*:\s*manual/isu,
    );
    expect(html).toMatch(/a\s*\{[^}]*overflow-wrap\s*:\s*anywhere/isu);
    expect(html).toMatch(/\.brand-token\s*\{[^}]*white-space\s*:\s*nowrap/isu);
  });

  it("rejects absolute deletion promises, the current overbroad cloud claim, and numeric SLAs", () => {
    const html = readFileSync(resolve(process.cwd(), "public/delete-account.html"), "utf8");
    const page = new DOMParser().parseFromString(html, "text/html");
    const visibleText = page.body.textContent?.replace(/\s+/gu, " ") ?? "";

    for (const absoluteClaim of [
      /\ball (?:your )?(?:cloud )?data\b/iu,
      /\bусі (?:ваші )?дані\b/iu,
      /\btodos los datos\b/iu,
      /\balle daten\b/iu,
      /\btoutes les données\b/iu,
      /すべてのデータ/iu,
      /جميع البيانات/iu,
      /כל הנתונים/iu,
    ]) {
      expect.soft(visibleText).not.toMatch(absoluteClaim);
    }

    expect
      .soft(visibleText)
      .not.toMatch(/remove(?:s|d)? your cloud data \([^)]*(?:backups|logs)[^)]*\)/iu);
    expect
      .soft(visibleText)
      .not.toMatch(/\b\d+\s*(?:business\s+)?(?:hours?|days?|weeks?|months?)\b/iu);
    expect.soft(visibleText).not.toMatch(/independently verified|not verified for this page/iu);
  });
});
