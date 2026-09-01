import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  primeZenflowV2,
  type ZenflowV2Language,
  type ZenflowV2Layout,
  type ZenflowV2Theme,
} from "./helpers/zenflowV2State";

interface AccountCopy {
  title: string;
  unavailable: string;
  deviceOnly: string;
}

interface BackupCopy {
  title: string;
  description: string;
  saveBackup: string;
  reports: string;
  reportsDescription: string;
  spreadsheet: string;
  progress: string;
  privacyWarning: string;
}

interface Scenario {
  name: string;
  viewport: { width: number; height: number };
  layout: ZenflowV2Layout;
  language: ZenflowV2Language;
  theme: ZenflowV2Theme;
  direction: "ltr" | "rtl";
  highContrast?: boolean;
  browserTextScale?: number;
  back: string;
  account: AccountCopy;
  backup: BackupCopy;
}

const SCENARIOS: Scenario[] = [
  {
    name: "320px German Paper, high contrast, and 200% browser text",
    viewport: { width: 320, height: 800 },
    layout: "phone",
    language: "de",
    theme: "paper",
    direction: "ltr",
    highContrast: true,
    browserTextScale: 2,
    back: "Zurück",
    account: {
      title: "Konto & Backup",
      unavailable: "Backup ist in dieser Version nicht verfügbar",
      deviceOnly: "Deine Daten bleiben auf diesem Gerät.",
    },
    backup: {
      title: "Backups und Berichte",
      description: "Speichere ein Backup für einen späteren Import oder erstelle einen Bericht.",
      saveBackup: "Backup speichern",
      reports: "Berichte",
      reportsDescription:
        "Berichte enthalten Daten zu Stimmung, Gewohnheiten, Fokus und Dankbarkeit. Der PDF-Bericht ist derzeit auf Englisch. Berichte sind keine Backups.",
      spreadsheet: "Tabellendaten (CSV)",
      progress: "Fortschritts­bericht (PDF)",
      privacyWarning:
        "Exporte sind private Dateien und werden von ZenFlow nicht verschlüsselt. Bewahre sie an einem vertrauenswürdigen Ort auf.",
    },
  },
  {
    name: "390px Ukrainian Ink",
    viewport: { width: 390, height: 844 },
    layout: "phone",
    language: "uk",
    theme: "ink",
    direction: "ltr",
    back: "Назад",
    account: {
      title: "Акаунт і резервна копія",
      unavailable: "У цій версії резервне копіювання недоступне",
      deviceOnly: "Ваші дані залишаються на цьому пристрої.",
    },
    backup: {
      title: "Резервні копії та звіти",
      description: "Збережіть резервну копію для подальшого імпорту або створіть звіт.",
      saveBackup: "Зберегти резервну копію",
      reports: "Звіти",
      reportsDescription:
        "Звіти містять дані про настрій, звички, фокус і подяки. PDF-файл наразі англійською. Звіти не є резервними копіями.",
      spreadsheet: "Дані для таблиці (CSV)",
      progress: "Звіт про прогрес (PDF)",
      privacyWarning:
        "Експорт створює приватні файли, які ZenFlow не шифрує. Зберігайте їх лише там, де довіряєте.",
    },
  },
  {
    name: "820px Arabic OLED RTL",
    viewport: { width: 820, height: 900 },
    layout: "phone",
    language: "ar",
    theme: "oled",
    direction: "rtl",
    back: "رجوع",
    account: {
      title: "الحساب والنسخ الاحتياطي",
      unavailable: "النسخ الاحتياطي غير متاح في هذا الإصدار",
      deviceOnly: "تبقى بياناتك على هذا الجهاز.",
    },
    backup: {
      title: "النسخ الاحتياطية والتقارير",
      description: "يمكن حفظ نسخة احتياطية لاستيرادها لاحقًا أو إنشاء تقرير.",
      saveBackup: "حفظ نسخة احتياطية",
      reports: "التقارير",
      reportsDescription:
        "تتضمن التقارير بيانات المزاج والعادات والتركيز والامتنان. يُنشأ ملف \u2066PDF\u2069 حاليًا باللغة الإنجليزية. التقارير ليست نسخًا احتياطية.",
      spreadsheet: "بيانات جدول بيانات (\u2066CSV\u2069)",
      progress: "تقرير التقدّم (\u2066PDF\u2069)",
      privacyWarning: "ملفات التصدير خاصة ولا يتم تشفيرها بواسطة ZenFlow. احفظها في مكان تثق به.",
    },
  },
  {
    name: "1280px Hebrew Ink RTL desktop",
    viewport: { width: 1280, height: 900 },
    layout: "desktop",
    language: "he",
    theme: "ink",
    direction: "rtl",
    back: "חזרה",
    account: {
      title: "חשבון וגיבוי",
      unavailable: "הגיבוי לא זמין בגרסה הזאת",
      deviceOnly: "הנתונים נשארים במכשיר הזה.",
    },
    backup: {
      title: "גיבויים ודוחות",
      description: "אפשר לשמור גיבוי לייבוא מאוחר יותר או ליצור דוח.",
      saveBackup: "שמירת גיבוי",
      reports: "דוחות",
      reportsDescription:
        "הדוחות כוללים נתוני מצב רוח, הרגלים, מיקוד והכרת תודה. קובץ ה-\u2066PDF\u2069 נוצר כרגע באנגלית. הדוחות אינם גיבויים.",
      spreadsheet: "נתונים לגיליון אלקטרוני (\u2066CSV\u2069)",
      progress: "דוח התקדמות (\u2066PDF\u2069)",
      privacyWarning:
        "הייצוא יוצר קובץ פרטי לא מוצפן על ידי ZenFlow. שמור אותו במקום שאתה סומך עליו.",
    },
  },
];

async function installLocalNetworkBoundary(page: Page, baseURL: string | undefined) {
  expect(baseURL, "The account boundary spec requires Playwright's local baseURL.").toBeTruthy();
  const appUrl = new URL(baseURL!);
  expect(["127.0.0.1", "localhost"]).toContain(appUrl.hostname);
  expect(appUrl.protocol).toBe("http:");

  const blockedExternalRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isNetworkRequest = requestUrl.protocol === "http:" || requestUrl.protocol === "https:";
    if (isNetworkRequest && requestUrl.origin !== appUrl.origin) {
      blockedExternalRequests.push(`${requestUrl.origin}${requestUrl.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  return blockedExternalRequests;
}

async function openSettings(page: Page, scenario: Scenario, section: "account" | "privacy") {
  await page.emulateMedia({
    colorScheme: scenario.theme === "paper" ? "light" : "dark",
    reducedMotion: "reduce",
  });
  await page.setViewportSize(scenario.viewport);
  await primeZenflowV2(page, {
    analytics: false,
    clearStorage: true,
    language: scenario.language,
    privacyNoTracking: true,
    theme: scenario.theme,
  });
  await page.addInitScript(
    ({ highContrast, theme }) => {
      localStorage.setItem(
        "zenflow:theme-v0c",
        JSON.stringify({
          state: {
            theme,
            themeCustomization: {
              schemaVersion: 1,
              accentFamily: "green",
              highContrast,
            },
          },
          version: 1,
        })
      );
    },
    {
      highContrast: scenario.highContrast ?? false,
      theme: scenario.theme,
    }
  );

  const query = new URLSearchParams({
    dev: "true",
    nav: "v2",
    navLayout: scenario.layout,
    settingsSection: section,
  });
  await page.goto(`settings?${query.toString()}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });

  if (scenario.browserTextScale) {
    const baselineRootFontSize = await page.evaluate((scale) => {
      const root = document.documentElement;
      const baseline = Number.parseFloat(getComputedStyle(root).fontSize);
      root.style.setProperty("font-size", `${baseline * scale}px`, "important");
      return baseline;
    }, scenario.browserTextScale);
    await expect
      .poll(() =>
        page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize))
      )
      .toBe(baselineRootFontSize * scenario.browserTextScale);
  }

  await expect(page.locator("html")).toHaveAttribute("lang", scenario.language);
  await expect(page.locator("html")).toHaveAttribute("dir", scenario.direction);
  await expect(page.locator("html")).toHaveAttribute("data-theme", scenario.theme);
  if (scenario.highContrast) {
    await expect(page.locator("html")).toHaveAttribute("data-theme-contrast", "high");
  } else {
    await expect(page.locator("html")).toHaveAttribute("data-theme-contrast", "standard");
  }
}

async function expectNoPersistedAccount(page: Page) {
  const accountKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(
      (key) => key === "zenflow-user" || /^sb-.*-auth-token$/u.test(key)
    )
  );
  expect(accountKeys).toEqual([]);
}

async function expectUnavailableAccount(page: Page, copy: AccountCopy) {
  const detail = page.getByTestId("settings-module-panel-account");
  const panel = page.getByTestId("settings-v2-panel-account");
  await expect(detail).toBeVisible();
  await expect(
    detail.getByRole("heading", { level: 2, name: copy.title, exact: true })
  ).toBeVisible();
  await expect(panel).toBeVisible();

  const callout = panel.locator('[data-containment="callout"]');
  await expect(callout).toHaveCount(1);
  await expect(callout.getByRole("status")).toHaveText(copy.unavailable);
  await expect(callout.getByText(copy.deviceOnly, { exact: true })).toBeVisible();
  await expect(panel.locator("button")).toHaveCount(0);
  await expect(panel.locator("a")).toHaveCount(0);

  await expect(page.locator('[data-testid^="auth-provider-content-"]')).toHaveCount(0);
  await expect(page.getByTestId("settings-v2-session-account-label")).toHaveCount(0);
  await expect(page.getByTestId("settings-v2-account-checking")).toHaveCount(0);
  await expect(page.getByTestId("settings-v2-account-check-error")).toHaveCount(0);
  await expect(page.getByTestId("settings-v2-sign-out-recovery")).toHaveCount(0);
  await expect(page.getByTestId("settings-v2-delete-confirmation")).toHaveCount(0);
  await expect(page.getByTestId("settings-status-overview")).toHaveCount(0);
}

async function expectUnavailableBackup(page: Page, copy: BackupCopy) {
  const panel = page.getByTestId("settings-v2-panel-data");
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole("heading", { level: 3, name: copy.title, exact: true })
  ).toBeVisible();
  await expect(panel.getByText(copy.description, { exact: true })).toBeVisible();
  await expect(page.getByTestId("settings-v2-export-privacy-warning")).toHaveText(
    copy.privacyWarning
  );

  const backupGroup = page.getByTestId("settings-v2-backup-restore-group");
  const reportsGroup = page.getByTestId("settings-v2-reports-group");
  await expect(backupGroup).toHaveAccessibleName(copy.saveBackup);
  await expect(reportsGroup).toHaveAccessibleName(copy.reports);
  await expect(reportsGroup.getByText(copy.reportsDescription, { exact: true })).toBeVisible();

  const exportJson = page.getByTestId("settings-v2-export-json");
  const exportCsv = page.getByTestId("settings-v2-export-csv");
  const exportPdf = page.getByTestId("settings-v2-export-pdf");
  await expect(exportJson).toHaveAccessibleName(copy.saveBackup);
  await expect(exportCsv).toHaveAccessibleName(copy.spreadsheet);
  await expect(exportPdf).toHaveAccessibleName(copy.progress);
  await expect(panel.getByRole("button")).toHaveCount(3);

  await expect(page.getByTestId("settings-v2-import-options")).toHaveCount(0);
  await expect(page.getByTestId("settings-v2-import")).toHaveCount(0);
  await expect(page.getByTestId("settings-v2-reset-data")).toHaveCount(0);
  await expect(page.getByTestId("settings-v2-reset-confirmation")).toHaveCount(0);
  await expect(panel.locator('input[type="file"]')).toHaveCount(0);
  await expect(panel.locator('[data-button-tone="danger"]')).toHaveCount(0);

  for (const button of [exportJson, exportCsv, exportPdf]) {
    const box = await button.boundingBox();
    expect(
      box,
      "Every available backup/report action must have a rendered hit area."
    ).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await backupGroup.focus();
  await page.keyboard.press("Tab");
  await expect(exportJson).toBeFocused();
  await expectVisibleKeyboardFocus(exportJson);
}

async function expectVisibleKeyboardFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  const hasVisibleFocus = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const hasOutline =
      style.outlineStyle !== "none" &&
      style.outlineStyle !== "hidden" &&
      Number.parseFloat(style.outlineWidth) > 0;
    const hasRing = style.boxShadow !== "none";
    return element.matches(":focus-visible") && (hasOutline || hasRing);
  });
  expect(hasVisibleFocus).toBe(true);
}

async function expectNoHorizontalOverflowOrClippedCopy(page: Page, root: Locator) {
  const documentOverflow = await page.evaluate(() =>
    Math.max(
      0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.documentElement.clientWidth
    )
  );
  expect(documentOverflow).toBeLessThanOrEqual(1);

  const issues = await root.evaluate((container) => {
    const viewportWidth = document.documentElement.clientWidth;
    const selectors = [
      "h1",
      "h2",
      "h3",
      "p",
      "button",
      "a",
      "label",
      "[role='status']",
      "[data-slot='settings-panel-copy']",
    ].join(",");

    return Array.from(container.querySelectorAll<HTMLElement>(selectors))
      .map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) return null;

        const outsideViewport = rect.left < -1 || rect.right > viewportWidth + 1;
        const clipsInlineCopy =
          (style.overflowX === "hidden" || style.overflowX === "clip") &&
          element.scrollWidth > element.clientWidth + 1;
        if (!outsideViewport && !clipsInlineCopy) return null;

        return {
          tag: element.tagName.toLowerCase(),
          testId: element.dataset.testid ?? null,
          text: (element.textContent ?? "").replace(/\s+/gu, " ").trim().slice(0, 120),
          outsideViewport,
          clipsInlineCopy,
        };
      })
      .filter(Boolean);
  });
  expect(issues).toEqual([]);
}

test.describe("Settings Account and Backup local unavailable contract", () => {
  test.skip(
    process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER !== "true",
    "Requires an isolated local build without Supabase credentials; public or provider-backed targets are outside this contract."
  );
  test.use({ serviceWorkers: "block" });
  test.setTimeout(90_000);

  for (const scenario of SCENARIOS) {
    test(`${scenario.name} keeps Account and Backup truthful and non-destructive`, async ({
      page,
      baseURL,
    }) => {
      const blockedExternalRequests = await installLocalNetworkBoundary(page, baseURL);
      await openSettings(page, scenario, "account");
      await expectNoPersistedAccount(page);
      await expectUnavailableAccount(page, scenario.account);
      await expectNoHorizontalOverflowOrClippedCopy(
        page,
        page.getByTestId("settings-selected-panel")
      );

      if (scenario.layout === "phone") {
        const back = page.getByTestId("settings-mobile-back");
        await expect(page.getByTestId("settings-page")).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(back).toHaveAccessibleName(scenario.back);
        await expectVisibleKeyboardFocus(back);

        if (scenario.direction === "rtl") {
          const backIconTransform = await back
            .locator("svg")
            .evaluate((icon) => getComputedStyle(icon).transform);
          expect(backIconTransform).not.toBe("none");
        }

        await page.keyboard.press("Enter");
        const accountCard = page.getByTestId("settings-module-card-account");
        await expect(page.getByTestId("settings-page-workspace")).toHaveAttribute(
          "data-mobile-view",
          "overview"
        );
        await expect(accountCard).toBeFocused();
        await expectVisibleKeyboardFocus(accountCard);
        await expect(page).not.toHaveURL(/settingsSection=/u);

        await page.getByTestId("settings-module-card-privacy").click();
        await expect(page.getByTestId("settings-module-panel-privacy")).toBeFocused();
      } else {
        await expect(page.getByTestId("settings-mobile-back")).toBeHidden();
        await page.getByTestId("settings-module-card-privacy").click();
      }

      await expectUnavailableBackup(page, scenario.backup);
      await expectNoPersistedAccount(page);
      await expectNoHorizontalOverflowOrClippedCopy(
        page,
        page.getByTestId("settings-module-panel-privacy")
      );
      expect(blockedExternalRequests).toEqual([]);
    });
  }
});
