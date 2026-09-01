import { expect, test, type Page } from "@playwright/test";

type SupportedLocale = "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";

interface OfflineCopy {
  description: string;
  retry: string;
  title: string;
}

const COPY: Record<SupportedLocale, OfflineCopy> = {
  en: {
    title: "You are offline",
    description: "Check your connection, then try again.",
    retry: "Try again",
  },
  uk: {
    title: "Ви офлайн",
    description: "Перевірте підключення до інтернету та повторіть спробу.",
    retry: "Повторити з'єднання",
  },
  es: {
    title: "Estás sin conexión",
    description: "Comprueba tu conexión y vuelve a intentarlo.",
    retry: "Reintentar conexión",
  },
  de: {
    title: "Du bist offline",
    description: "Prüfe deine Verbindung und versuche es erneut.",
    retry: "Verbindung erneut versuchen",
  },
  fr: {
    title: "Vous êtes hors ligne",
    description: "Vérifiez votre connexion, puis réessayez.",
    retry: "Réessayer la connexion",
  },
  ja: {
    title: "オフラインです",
    description: "接続を確認して、もう一度お試しください。",
    retry: "再接続",
  },
  ar: {
    title: "أنت غير متصل",
    description: "تحقق من اتصالك، ثم حاول مرة أخرى.",
    retry: "إعادة محاولة الاتصال",
  },
  he: {
    title: "את/ה אופליין",
    description: "בדקו את החיבור ונסו שוב.",
    retry: "נסה חיבור מחדש",
  },
};

const LEGACY_UNSAFE_DESCRIPTIONS = [
  "ZenFlow works in offline mode. All your data is saved locally and will sync when you reconnect.",
  "ZenFlow працює в автономному режимі. Усі ваші дані збережені локально та синхронізуються після підключення.",
  "ZenFlow funciona sin conexión. Todos tus datos se guardan localmente y se sincronizarán cuando vuelvas a conectarte.",
  "ZenFlow funktioniert offline. Alle Daten werden lokal gespeichert und synchronisiert, sobald du wieder verbunden bist.",
  "ZenFlow fonctionne hors ligne. Toutes vos données sont enregistrées localement et se synchroniseront à la reconnexion.",
  "ZenFlowはオフラインでも動作します。すべてのデータは端末に保存され、再接続時に同期されます。",
  "يعمل ZenFlow دون اتصال. تُحفظ كل بياناتك محليًا وتتم مزامنتها عند إعادة الاتصال.",
  "ZenFlow עובד גם ללא חיבור. כל הנתונים שלך נשמרים מקומית ויסונכרנו כשתתחבר/י מחדש.",
] as const;

const RTL_LOCALES = new Set<SupportedLocale>(["ar", "he"]);
const SUPPORTED_LOCALES = Object.keys(COPY) as SupportedLocale[];

async function openOfflinePage(
  page: Page,
  {
    navigatorLanguage = "en-US",
    storageMode = "json",
    storedLanguage,
  }: {
    navigatorLanguage?: string;
    storageMode?: "json" | "malformed" | "raw" | "throw" | "unset";
    storedLanguage?: string;
  } = {},
) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(
    ({ navigatorLanguage, storageMode, storedLanguage }) => {
      Object.defineProperty(window.navigator, "language", {
        configurable: true,
        value: navigatorLanguage,
      });

      if (storageMode === "throw") {
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function getItem(key: string) {
          if (key === "zenflow-language") {
            throw new DOMException("Storage access denied", "SecurityError");
          }
          return originalGetItem.call(this, key);
        };
        return;
      }

      localStorage.clear();
      if (storageMode === "unset" || storedLanguage === undefined) return;

      const value = storageMode === "json" ? JSON.stringify(storedLanguage) : storedLanguage;
      localStorage.setItem("zenflow-language", value);
    },
    { navigatorLanguage, storageMode, storedLanguage },
  );

  await page.goto("offline.html", { waitUntil: "domcontentloaded" });
  return pageErrors;
}

async function expectLocalizedOfflinePage(page: Page, locale: SupportedLocale) {
  const expected = COPY[locale];
  const expectedDirection = RTL_LOCALES.has(locale) ? "rtl" : "ltr";

  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", expectedDirection);
  await expect(page.locator("#offline-title")).toHaveText(expected.title);
  await expect(page.locator("#offline-desc")).toHaveText(expected.description);
  await expect(page.getByRole("button", { name: expected.retry })).toHaveText(expected.retry);

  const geometry = await page.evaluate(() => {
    const retry = document.getElementById("offline-retry");
    const rect = retry?.getBoundingClientRect();
    return {
      documentFitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      retryHeight: rect?.height ?? 0,
      retryWidth: rect?.width ?? 0,
    };
  });

  expect(geometry.documentFitsViewport).toBe(true);
  expect(geometry.retryHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.retryWidth).toBeGreaterThanOrEqual(44);
}

test.describe("static offline recovery contract", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const locale of SUPPORTED_LOCALES) {
    test(`uses the JSON-encoded ${locale} preference without executable errors`, async ({
      page,
    }) => {
      const pageErrors = await openOfflinePage(page, {
        storedLanguage: locale,
        storageMode: "json",
      });

      expect(pageErrors).toEqual([]);
      await expectLocalizedOfflinePage(page, locale);
      await expect(page.locator("#offline-desc")).not.toHaveText(
        LEGACY_UNSAFE_DESCRIPTIONS[SUPPORTED_LOCALES.indexOf(locale)],
      );
    });
  }

  test("keeps the legacy raw locale representation compatible", async ({ page }) => {
    const pageErrors = await openOfflinePage(page, {
      storedLanguage: "uk",
      storageMode: "raw",
    });

    expect(pageErrors).toEqual([]);
    await expectLocalizedOfflinePage(page, "uk");
  });

  test("falls back to a supported navigator locale for malformed storage", async ({ page }) => {
    const pageErrors = await openOfflinePage(page, {
      navigatorLanguage: "de-DE",
      storedLanguage: "{broken-json",
      storageMode: "malformed",
    });

    expect(pageErrors).toEqual([]);
    await expectLocalizedOfflinePage(page, "de");
  });

  test("rejects an unsupported stored locale instead of applying it to the document", async ({
    page,
  }) => {
    const pageErrors = await openOfflinePage(page, {
      navigatorLanguage: "es-MX",
      storedLanguage: "../../unexpected",
      storageMode: "json",
    });

    expect(pageErrors).toEqual([]);
    await expectLocalizedOfflinePage(page, "es");
  });

  test("uses the navigator fallback when storage access is unavailable", async ({ page }) => {
    const pageErrors = await openOfflinePage(page, {
      navigatorLanguage: "fr-CA",
      storageMode: "throw",
    });

    expect(pageErrors).toEqual([]);
    await expectLocalizedOfflinePage(page, "fr");
  });

  test("uses English when neither storage nor navigator provides a supported locale", async ({
    page,
  }) => {
    const pageErrors = await openOfflinePage(page, {
      navigatorLanguage: "pt-BR",
      storageMode: "unset",
    });

    expect(pageErrors).toEqual([]);
    await expectLocalizedOfflinePage(page, "en");
  });

  test("serves the localized fallback from the production service-worker precache while offline", async ({
    context,
    page,
  }) => {
    test.skip(
      process.env.ZENFLOW_PWA_OFFLINE_PROOF !== "true",
      "Run with the production PWA preview config to verify service-worker precache behavior.",
    );

    await page.addInitScript(() => {
      localStorage.setItem("zenflow-language", JSON.stringify("ar"));
    });
    await page.goto("", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await context.setOffline(true);
    try {
      await page.goto("offline.html", { waitUntil: "domcontentloaded" });
      await expectLocalizedOfflinePage(page, "ar");
      expect(pageErrors).toEqual([]);
    } finally {
      await context.setOffline(false);
    }
  });
});
