import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { primeZenflowV2 } from "./helpers/zenflowV2State";

const APP_BASE = "/people-first-app";
const SETTINGS_SECTION_IDS = [
  "account",
  "appearance",
  "sound",
  "notifications",
  "privacy",
  "about",
] as const;
const VIC_SCREENSHOT_PHASE =
  process.env.ZENFLOW_VIC_SCREENSHOT_PHASE === "after" ? "after" : "before";

function vicScreenshotPath(
  surface: "privacy" | "sound" | "detail-hero" | "dark-contrast",
  variant?: string,
) {
  const viewportSuffix = surface === "dark-contrast" ? "" : "-320";
  return `output/playwright/settings-natural-language/screenshots/task10-vic-${VIC_SCREENSHOT_PHASE}-${surface}${variant ? `-${variant}` : ""}${viewportSuffix}.png`;
}

type Rgb = [number, number, number];

function parseRenderedColor(value: string): { rgb: Rgb; alpha: number } {
  const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
  if (channels.length < 3) throw new Error(`Unsupported rendered color: ${value}`);
  return {
    rgb: [channels[0], channels[1], channels[2]],
    alpha: channels[3] ?? 1,
  };
}

function relativeLuminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function compositeOver(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) =>
    Math.round(channel * alpha + background[index] * (1 - alpha)),
  ) as Rgb;
}

async function measureInkAppearanceContrast(page: Page, artifactName: string) {
  const rendered = await page.evaluate(() => {
    const read = (name: string, target: Element | null) => {
      if (!(target instanceof HTMLElement)) {
        throw new Error(`Missing contrast target: ${name}`);
      }
      const targetRect = target.getBoundingClientRect();
      return {
        name,
        color: getComputedStyle(target).color,
        sample: {
          x: Math.floor(targetRect.left + targetRect.width / 2),
          y: Math.floor(targetRect.top + targetRect.height / 2 + window.scrollY),
        },
      };
    };
    const identity = document.querySelector('[data-testid="settings-v2-identity-anchor"]');
    const oled = document.querySelector('[data-testid="settings-v2-oled-toggle"]');
    const textSize = document.querySelector('[data-testid="settings-v2-text-size-field"]');
    const identityDescription = identity?.querySelector(".text-muted-foreground") ?? null;
    const oledDescription = oled?.querySelector(".text-muted-foreground") ?? null;
    const textSizeDescription = Array.from(
      textSize?.querySelectorAll(".text-muted-foreground") ?? [],
    ).find((element) => element.textContent?.includes("Adjust")) ?? null;
    const selected = document.querySelector('[data-testid="settings-v2-theme-choice-ink"]');
    const unselected = document.querySelector('[data-testid="settings-v2-theme-choice-paper"]');
    if (!(selected instanceof HTMLElement) || !(unselected instanceof HTMLElement)) {
      throw new Error("Missing theme choice controls");
    }
    const selectedLabel = selected.querySelector("span:last-child");
    const unselectedLabel = unselected.querySelector("span:last-child");
    if (!(selectedLabel instanceof HTMLElement) || !(unselectedLabel instanceof HTMLElement)) {
      throw new Error("Missing theme choice labels");
    }
    const selectedLabelRect = selectedLabel.getBoundingClientRect();
    const unselectedLabelRect = unselectedLabel.getBoundingClientRect();
    const selectedStyle = getComputedStyle(selected);
    return {
      muted: [
        read("Appearance description", identityDescription),
        read("Pure black mode description", oledDescription),
        read("Text Size description", textSizeDescription),
      ],
      selected: {
        color: selectedStyle.color,
        borderColor: selectedStyle.borderTopColor,
        borderWidth: selectedStyle.borderTopWidth,
        selectedSample: {
          x: Math.floor(selectedLabelRect.left + selectedLabelRect.width / 2),
          y: Math.floor(selectedLabelRect.top + selectedLabelRect.height / 2 + window.scrollY),
        },
        adjacentSample: {
          x: Math.floor(unselectedLabelRect.left + unselectedLabelRect.width / 2),
          y: Math.floor(unselectedLabelRect.top + unselectedLabelRect.height / 2 + window.scrollY),
        },
      },
      root: {
        comfort: document.documentElement.dataset.themeComfort ?? null,
        fontScale: getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim(),
        style: document.documentElement.dataset.themeStyle ?? null,
        theme: document.documentElement.dataset.theme ?? null,
      },
    };
  });

  await page.screenshot({
    path: vicScreenshotPath("dark-contrast", artifactName),
    fullPage: true,
    animations: "disabled",
  });

  await page.evaluate(() => {
    const targets = [
      document
        .querySelector('[data-testid="settings-v2-identity-anchor"]')
        ?.querySelector(".text-muted-foreground"),
      document
        .querySelector('[data-testid="settings-v2-oled-toggle"]')
        ?.querySelector(".text-muted-foreground"),
      Array.from(
        document
          .querySelector('[data-testid="settings-v2-text-size-field"]')
          ?.querySelectorAll(".text-muted-foreground") ?? [],
      ).find((element) => element.textContent?.includes("Adjust")),
      ...Array.from(
        document.querySelectorAll(
          '[data-testid="settings-v2-theme-choice-ink"] > *, [data-testid="settings-v2-theme-choice-paper"] > *',
        ),
      ),
    ];
    for (const target of targets) {
      if (!(target instanceof HTMLElement || target instanceof SVGElement)) continue;
      target.dataset.vicPreviousVisibility = target.style.visibility;
      target.style.visibility = "hidden";
    }
  });
  let backgroundScreenshot: Buffer;
  try {
    backgroundScreenshot = await page.screenshot({ fullPage: true, animations: "disabled" });
  } finally {
    await page.evaluate(() => {
      for (const target of document.querySelectorAll<HTMLElement | SVGElement>(
        "[data-vic-previous-visibility]",
      )) {
        target.style.visibility = target.dataset.vicPreviousVisibility ?? "";
        delete target.dataset.vicPreviousVisibility;
      }
    });
  }
  const { data, info } = await sharp(backgroundScreenshot).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const pixelAt = ({ x, y }: { x: number; y: number }): Rgb => {
    const safeX = Math.max(0, Math.min(info.width - 1, x));
    const safeY = Math.max(0, Math.min(info.height - 1, y));
    const offset = (safeY * info.width + safeX) * info.channels;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  const muted = rendered.muted.map((sample) => {
    const foreground = parseRenderedColor(sample.color).rgb;
    const background = pixelAt(sample.sample);
    return {
      ...sample,
      foreground,
      background,
      ratio: contrastRatio(foreground, background),
    };
  });
  const selectedForeground = parseRenderedColor(rendered.selected.color).rgb;
  const selectedBackground = pixelAt(rendered.selected.selectedSample);
  const adjacentBackground = pixelAt(rendered.selected.adjacentSample);
  const border = parseRenderedColor(rendered.selected.borderColor);
  const renderedBorder = compositeOver(border.rgb, adjacentBackground, border.alpha);
  return {
    muted,
    root: rendered.root,
    selected: {
      adjacentBackground,
      background: selectedBackground,
      borderColor: rendered.selected.borderColor,
      borderRatio: contrastRatio(renderedBorder, adjacentBackground),
      borderWidth: Number.parseFloat(rendered.selected.borderWidth),
      foreground: selectedForeground,
      labelRatio: contrastRatio(selectedForeground, selectedBackground),
    },
  };
}

async function primeApp(
  page: Page,
  options: { language?: "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he" } = {},
) {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await primeZenflowV2(page, {
    language: options.language ?? "en",
    theme: "paper",
  });
}

async function openSettings(
  page: Page,
  options: {
    layout?: "phone" | "desktop";
    search?: Record<string, string>;
  } = {},
) {
  const params = new URLSearchParams({
    nav: "v2",
    navLayout: options.layout ?? "phone",
    dev: "true",
    ...options.search,
  });
  await page.goto(`${APP_BASE}/settings?${params.toString()}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByTestId("settings-page")).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.documentElement.clientWidth,
    ),
  );
  expect(overflow).toBe(0);
}

async function expectMobileOverview(page: Page, focusedCardId?: string) {
  await expect(page.getByTestId("settings-page-workspace")).toHaveAttribute(
    "data-mobile-view",
    "overview",
  );
  await expect(page.getByTestId("settings-module-list")).toBeVisible();
  await expect(page.getByTestId("settings-selected-panel")).toHaveCount(0);
  await expect(page.locator('[data-testid^="settings-module-card-"]')).toHaveCount(6);

  for (const sectionId of SETTINGS_SECTION_IDS) {
    const card = page.getByTestId(`settings-module-card-${sectionId}`);
    await expect(card).toBeVisible();
    await expect(card).not.toHaveAttribute("aria-controls", /.+/);
  }

  if (focusedCardId) {
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id ?? null))
      .toBe(`settings-module-card-${focusedCardId}`);
  }
  await expectNoHorizontalOverflow(page);
}

test.describe("V2 Settings information architecture and runtime", () => {
  test.setTimeout(60_000);

  test("phone overview exposes exactly six user-facing groups and one page heading", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);

    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toHaveCount(1);
    await expectMobileOverview(page);
    const drawerTrigger = page.getByTestId("nav-v2-open-drawer");
    await expect(drawerTrigger).toHaveAccessibleName("Open menu");
    await expect(drawerTrigger).not.toHaveAttribute("aria-controls", /.+/);
    await drawerTrigger.click();
    await expect(drawerTrigger).toHaveAttribute("aria-controls", "nav-v2-drawer");
    await expect(page.locator("#nav-v2-drawer")).toBeVisible();
  });

  test("phone detail uses URL history, restores overview focus, and supports forward navigation", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);

    await page.getByTestId("settings-module-card-account").click();
    await expect(page).toHaveURL(/settingsSection=account/);
    await expect(page.getByTestId("settings-module-list")).toHaveCount(0);
    await expect(page.getByTestId("settings-selected-panel")).toBeVisible();
    await expect(page.getByTestId("settings-module-panel-account")).toHaveAttribute(
      "aria-labelledby",
      "settings-module-panel-heading-account",
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Account & backup" }),
    ).toBeVisible();
    await expect(page.getByTestId("settings-v2-weekly-digest")).toHaveCount(0);
    await expect(page.getByTestId("settings-mobile-back")).toBeVisible();

    await page.getByTestId("settings-mobile-back").click();
    await expect(page).not.toHaveURL(/settingsSection=/);
    await expectMobileOverview(page, "account");

    await page.goForward();
    await expect(page).toHaveURL(/settingsSection=account/);
    await expect(page.getByTestId("settings-module-panel-account")).toBeVisible();

    await page.goBack();
    await expectMobileOverview(page, "account");
  });

  test("a direct phone detail link closes in place without leaking the settings query", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page, { search: { settingsSection: "privacy", debug: "1" } });

    await expect(page.getByTestId("settings-module-panel-privacy")).toBeVisible();
    await page.getByTestId("settings-mobile-back").click();

    await expect(page).not.toHaveURL(/settingsSection=/);
    expect(new URL(page.url()).searchParams.get("debug")).toBe("1");
    await expectMobileOverview(page, "privacy");
  });

  test("desktop keeps the six-group list beside one mounted, correctly labelled detail panel", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSettings(page, { layout: "desktop" });

    await expect(page.getByTestId("settings-module-list")).toBeVisible();
    await expect(page.locator('[data-testid^="settings-module-card-"]')).toHaveCount(6);
    await expect(page.getByTestId("settings-module-card-appearance")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("settings-module-card-appearance")).toHaveAttribute(
      "aria-controls",
      "settings-module-panel-appearance",
    );
    await expect(page.getByTestId("settings-module-card-account")).not.toHaveAttribute(
      "aria-controls",
      /.+/,
    );
    await expect(page.getByTestId("settings-module-panel-appearance")).toHaveAttribute(
      "aria-labelledby",
      "settings-module-panel-heading-appearance",
    );
    await expect(page.locator('[data-testid^="settings-module-panel-"]')).toHaveCount(1);

    await page.getByTestId("settings-module-card-account").click();
    await expect(page).toHaveURL(/settingsSection=account/);
    await expect(page.getByTestId("settings-module-list")).toBeVisible();
    await expect(page.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-controls",
      "settings-module-panel-account",
    );
    await expect(page.getByTestId("settings-module-panel-appearance")).toHaveCount(0);
    await expect(page.getByTestId("settings-module-panel-account")).toBeVisible();
    await expect(page.getByTestId("settings-mobile-back")).toBeHidden();
    await expectNoHorizontalOverflow(page);

    await page.goBack();
    await expect(page).not.toHaveURL(/settingsSection=/);
    await expect(page.getByTestId("settings-module-card-appearance")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("settings-module-card-account")).not.toHaveAttribute(
      "aria-current",
      /.+/,
    );
    await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
    await expect(page.getByTestId("settings-module-card-appearance")).toBeFocused();
  });

  test("appearance theme controls persist and the overflow disclosure restores keyboard focus", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSettings(page, { layout: "desktop" });

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");
    await expect(page.getByTestId("settings-v2-theme-choice-ink")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("zenflow:theme-v0c");
          return raw ? JSON.parse(raw).state?.theme : null;
        }),
      )
      .toBe("ink");

    const more = page.getByTestId("settings-v2-appearance-more");
    await expect(more).not.toHaveAttribute("aria-controls", /.+/);
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(more).toHaveAttribute("aria-controls", "settings-v2-appearance-more-menu");
    await expect(page.getByTestId("settings-v2-appearance-more-menu")).toHaveAttribute(
      "role",
      "group",
    );
    await expect(page.getByTestId("settings-v2-style-reset")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("settings-v2-appearance-more-menu")).toHaveCount(0);
    await expect(more).not.toHaveAttribute("aria-controls", /.+/);
    await expect(more).toBeFocused();
  });

  test("compact translated palette names remain fully visible", async ({ page }) => {
    await primeApp(page, { language: "de" });
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { search: { settingsSection: "appearance" } });

    const advanced = page.getByTestId("settings-v2-advanced-appearance-details");
    await advanced.locator("summary").first().click();
    await expect(advanced).toHaveAttribute("open", "");

    const paletteButtons = page.locator('[data-testid^="settings-v2-style-choice-"]');
    await expect(paletteButtons).toHaveCount(5);
    const clipping = await paletteButtons.evaluateAll((buttons) =>
      buttons.map((button) => {
        const label = button.lastElementChild as HTMLElement | null;
        const buttonRect = button.getBoundingClientRect();
        const labelRange = document.createRange();
        if (!label) throw new Error("Missing palette label");
        labelRange.selectNodeContents(label);
        const labelRect = labelRange.getBoundingClientRect();
        return {
          label: label.textContent?.trim() ?? "",
          clipped:
            label.scrollWidth > label.clientWidth + 1 ||
            labelRect.left < buttonRect.left - 1 ||
            labelRect.right > buttonRect.right + 1,
        };
      }),
    );

    expect(clipping.filter((entry) => entry.clipped)).toEqual([]);
  });

  const inkContrastScenarios = [
    {
      name: "default-390x844",
      viewport: { width: 390, height: 844 },
      variant: "default",
    },
    {
      name: "botanical-pulse-390x844",
      viewport: { width: 390, height: 844 },
      variant: "botanicalPulse",
    },
    {
      name: "largest-text-320x568",
      viewport: { width: 320, height: 568 },
      variant: "largestText",
    },
    {
      name: "high-contrast-390x844",
      viewport: { width: 390, height: 844 },
      variant: "highContrast",
    },
  ] as const;

  for (const scenario of inkContrastScenarios) {
    test(`Ink Settings contrast meets WCAG thresholds (${scenario.name})`, async ({ page }) => {
      await primeApp(page);
      await page.setViewportSize(scenario.viewport);
      await openSettings(page);
      await page.getByTestId("settings-module-card-appearance").click();
      await page.getByTestId("settings-v2-theme-choice-ink").click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");

      if (scenario.variant === "largestText") {
        await page.getByTestId("settings-v2-text-size-field").getByRole("slider").fill("6");
        await expect
          .poll(() =>
            page.evaluate(() =>
              getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim(),
            ),
          )
          .toBe("1.5");
        await expect
          .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("zenflow_font_scale") ?? "null")))
          .toBe(1.5);
      } else if (scenario.variant === "botanicalPulse" || scenario.variant === "highContrast") {
        const advanced = page.getByTestId("settings-v2-advanced-appearance-details");
        await advanced.locator("summary").first().click();
        await expect(advanced).toHaveAttribute("open", "");

        if (scenario.variant === "botanicalPulse") {
          await page.getByTestId("settings-v2-style-choice-botanicalPulse").click();
        } else {
          const comfort = page.getByTestId("settings-v2-comfort-details");
          await comfort.locator("summary").click();
          await expect(comfort).toHaveAttribute("open", "");
          await page.getByTestId("settings-v2-high-contrast-toggle").getByRole("switch").click();
        }

        await page.getByTestId("settings-v2-style-apply").click();
        const expectedRootValue =
          scenario.variant === "botanicalPulse" ? "botanicalPulse" : "high-contrast";
        const expectedRootAttribute =
          scenario.variant === "botanicalPulse" ? "data-theme-style" : "data-theme-comfort";
        await expect(page.locator("html")).toHaveAttribute(expectedRootAttribute, expectedRootValue);
        await expect
          .poll(() =>
            page.evaluate((variant) => {
              const raw = localStorage.getItem("zenflow:theme-v0c");
              const customization = raw ? JSON.parse(raw).state?.themeCustomization : null;
              return variant === "botanicalPulse"
                ? customization?.paletteId
                : customization?.contrastMode;
            }, scenario.variant),
          )
          .toBe(scenario.variant === "botanicalPulse" ? "botanicalPulse" : "high");
      }
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      const evidence = await measureInkAppearanceContrast(page, scenario.name);
      console.log(`[VIC-04 ${scenario.name}] ${JSON.stringify(evidence)}`);

      for (const sample of evidence.muted) {
        expect(
          sample.ratio,
          `${scenario.name}: ${sample.name} contrast was ${sample.ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        evidence.selected.labelRatio,
        `${scenario.name}: selected Dark label contrast was ${evidence.selected.labelRatio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        evidence.selected.borderWidth,
        `${scenario.name}: selected border must be visible`,
      ).toBeGreaterThanOrEqual(1);
      expect(
        evidence.selected.borderRatio,
        `${scenario.name}: selected state border contrast was ${evidence.selected.borderRatio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
    });
  }

  test("web reminder state never presents native delivery controls as active", async ({ page }) => {
    await primeApp(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        "zenflow-reminders",
        JSON.stringify({
          enabled: true,
          moodTimeMorning: "07:30",
          moodTimeAfternoon: "14:00",
          moodTimeEvening: "20:00",
          habitTime: "21:00",
          focusTime: "10:00",
          days: [1, 2, 3, 4, 5],
          quietHours: { start: "22:00", end: "08:00" },
          habitIds: [],
        }),
      );
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSettings(page, { layout: "desktop" });

    await expect(page.getByTestId("settings-module-card-notifications")).toContainText("Mobile app");
    await page.getByTestId("settings-module-card-notifications").click();
    await expect(page.getByTestId("settings-v2-reminders-native-only")).toContainText(
      "To set reminders, open the ZenFlow mobile app.",
    );
    await expect(page.getByTestId("settings-v2-notification-system-guidance")).toHaveCount(0);
    await expect(page.getByTestId("settings-v2-quick-actions-toggle")).toHaveCount(0);
    const reminderSwitch = page
      .getByTestId("settings-v2-reminders-toggle")
      .getByRole("switch");
    await expect(reminderSwitch).toBeDisabled();
    await expect(reminderSwitch).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("settings-v2-reminders-native-only")).toBeVisible();
    await expect(page.getByLabel("Morning")).toHaveCount(0);
  });

  test("privacy data detail separates restorable backups from non-restorable reports", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSettings(page, { layout: "desktop" });

    await page.getByTestId("settings-module-card-privacy").click();
    const backupGroup = page.getByTestId("settings-v2-backup-restore-group");
    const reportsGroup = page.getByTestId("settings-v2-reports-group");
    await expect(backupGroup).toContainText("Backup & restore");
    await expect(backupGroup.getByRole("button", { name: "Save backup" })).toBeVisible();
    await expect(backupGroup.getByRole("button", { name: "Import backup" })).toBeVisible();
    await expect(reportsGroup).toContainText("Reports");
    await expect(reportsGroup).toContainText("Reports are not backups.");
    await expect(
      reportsGroup.getByRole("button", { name: "Spreadsheet data (CSV)" }),
    ).toBeVisible();
    await expect(
      reportsGroup.getByRole("button", { name: "Progress report (PDF)" }),
    ).toBeVisible();
  });

  test("privacy legal links meet the 44px target and keep safe external-link attributes", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);
    await page.getByTestId("settings-module-card-privacy").click();

    for (const name of ["Privacy policy", "Terms of service"]) {
      const link = page.getByRole("link", { name });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("compact 320px privacy toggle keeps its description readable and associated", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { search: { settingsSection: "privacy" } });

    const row = page.getByTestId("settings-v2-ad-consent");
    const toggle = row.getByRole("switch", { name: "Rewarded videos" });
    await expect(row).toBeVisible();
    await page.screenshot({ path: vicScreenshotPath("privacy"), fullPage: true });

    const geometry = await row.evaluate((element) => {
      const switchElement = element.querySelector<HTMLElement>('[role="switch"]');
      const descriptionId = switchElement?.getAttribute("aria-describedby") ?? null;
      const description = descriptionId ? document.getElementById(descriptionId) : null;
      if (!switchElement || !description) throw new Error("Missing ToggleRow description association");
      const rowRect = element.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      return {
        descriptionId,
        descriptionWidth: descriptionRect.width,
        rowWidth: rowRect.width,
      };
    });

    await expect(toggle).toHaveAttribute("aria-describedby", geometry.descriptionId ?? "");
    expect(
      geometry.descriptionWidth >= 160 || geometry.descriptionWidth / geometry.rowWidth >= 0.65,
    ).toBe(true);
  });

  test("compact 320px German compound toggle titles stay clear of their switches", async ({
    page,
  }) => {
    await primeApp(page, { language: "de" });
    await page.setViewportSize({ width: 320, height: 568 });

    const expectTitleClearOfSwitch = async (testId: string) => {
      const geometry = await page.getByTestId(testId).evaluate((row) => {
        const toggle = row.querySelector<HTMLElement>('[role="switch"]');
        const title = toggle?.previousElementSibling;
        if (!(toggle instanceof HTMLElement) || !(title instanceof HTMLElement)) {
          throw new Error(`Missing ToggleRow title or switch in ${testId}`);
        }
        const titleRange = document.createRange();
        titleRange.selectNodeContents(title);
        const titleRect = titleRange.getBoundingClientRect();
        const toggleRect = toggle.getBoundingClientRect();
        return {
          overlaps:
            Math.min(titleRect.right, toggleRect.right) >
              Math.max(titleRect.left, toggleRect.left) &&
            Math.min(titleRect.bottom, toggleRect.bottom) >
              Math.max(titleRect.top, toggleRect.top),
          title: title.textContent?.trim() ?? "",
        };
      });

      expect.soft(
        geometry.overlaps,
        `${geometry.title} overlapped its switch`,
      ).toBe(false);
    };

    await openSettings(page, { search: { settingsSection: "privacy" } });
    await expectTitleClearOfSwitch("settings-v2-ad-consent");

    await openSettings(page, { search: { settingsSection: "sound" } });
    await expectTitleClearOfSwitch("settings-v2-audio-milestone-toggle");
  });

  test("largest-text inline reset confirmation stays scrollable and restores its trigger", async ({
    page,
  }) => {
    await primeApp(page, { language: "de" });
    await page.addInitScript(() => localStorage.setItem("zenflow_font_scale", "1.5"));
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { search: { settingsSection: "privacy" } });

    const trigger = page.getByTestId("settings-v2-reset-data");
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await trigger.click();

    const confirmation = page.getByTestId("settings-v2-reset-confirmation");
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe("fixed");
    const confirmationBox = await confirmation.boundingBox();
    expect(confirmationBox).not.toBeNull();
    expect(confirmationBox?.y ?? -1).toBeGreaterThanOrEqual(0);

    await page.keyboard.press("Tab");
    const confirmationInput = confirmation.getByRole("textbox");
    await expect(confirmationInput).toBeFocused();
    const inputBox = await confirmationInput.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(inputBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((inputBox?.y ?? 0) + (inputBox?.height ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(
      568,
    );

    await confirmation.getByRole("button").first().click();
    await expect(confirmation).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("largest-text import confirmation remains inside the viewport and restores focus", async ({
    page,
  }) => {
    await primeApp(page, { language: "de" });
    await page.addInitScript(() => localStorage.setItem("zenflow_font_scale", "1.5"));
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { search: { settingsSection: "privacy" } });

    await page.getByTestId("settings-v2-import-mode-replace").click();
    const trigger = page.getByTestId("settings-v2-import");
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
      name: "zenflow-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });

    const dialog = page.getByRole("dialog");
    const panel = dialog.locator('[data-dialog-panel="true"]');
    await expect(dialog).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((panelBox?.y ?? 0) + (panelBox?.height ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(
      568,
    );
    await expect(panel).toBeFocused();
    expect(await panel.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(dialog.getByRole("button").last()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("largest-text legal dialog stays viewport-bound and restores its Settings action", async ({
    page,
  }) => {
    await primeApp(page, { language: "de" });
    await page.addInitScript(() => localStorage.setItem("zenflow_font_scale", "1.5"));
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { search: { settingsSection: "about" } });

    const legalActions = page
      .getByTestId("settings-v2-about-support-legal-group")
      .getByRole("button");
    const legalGroupBox = await page
      .getByTestId("settings-v2-about-support-legal-group")
      .boundingBox();
    expect(legalGroupBox).not.toBeNull();
    for (const action of await legalActions.all()) {
      const actionBox = await action.boundingBox();
      expect(actionBox).not.toBeNull();
      expect(actionBox?.x ?? -1).toBeGreaterThanOrEqual(legalGroupBox?.x ?? 0);
      expect(
        (actionBox?.x ?? 0) + (actionBox?.width ?? Number.POSITIVE_INFINITY),
      ).toBeLessThanOrEqual((legalGroupBox?.x ?? 0) + (legalGroupBox?.width ?? 0));
    }
    const trigger = legalActions.last();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((triggerBox?.x ?? 0) + (triggerBox?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(
      320,
    );
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(
      568,
    );
    await expect(dialog.getByRole("button", { name: /schließen/i })).toBeVisible();
    for (const tab of await dialog.getByRole("tab").all()) {
      const tabBox = await tab.boundingBox();
      expect(tabBox).not.toBeNull();
      expect(tabBox?.x ?? -1).toBeGreaterThanOrEqual(dialogBox?.x ?? 0);
      expect((tabBox?.x ?? 0) + (tabBox?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(
        (dialogBox?.x ?? 0) + (dialogBox?.width ?? 0),
      );
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("largest-text feedback dialog stays viewport-bound and restores focus", async ({
    page,
  }) => {
    await primeApp(page);
    await page.addInitScript(() => localStorage.setItem("zenflow_font_scale", "1.5"));
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { search: { settingsSection: "about" } });

    const expectViewportDialogAndFocusReturn = async (triggerName: string, dialogName: string) => {
      const trigger = page.getByRole("button", { name: triggerName });
      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: dialogName });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(568);

      if (dialogName === "Send feedback") {
        for (const category of ["Report Bug", "Request Feature", "Other"]) {
          await expect(dialog.getByText(category, { exact: true })).toBeVisible();
        }
      }

      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    };

    await expectViewportDialogAndFocusReturn("Send feedback", "Send feedback");
    await expect(page.getByRole("button", { name: "Version History" })).toHaveCount(0);
  });

  test("compact 320px Sound profiles use stacked rectangular content", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { search: { settingsSection: "sound" } });

    await page.screenshot({ path: vicScreenshotPath("sound"), fullPage: true });
    for (const profileId of ["quiet", "balanced"] as const) {
      const profile = page.getByTestId(`settings-v2-audio-comfort-profile-${profileId}`);
      const geometry = await profile.evaluate((element) => {
        const title = element.children.item(0)?.getBoundingClientRect();
        const description = element.children.item(1)?.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (!title || !description) throw new Error("Missing Sound profile content");
        return {
          borderRadius: Number.parseFloat(style.borderTopLeftRadius),
          flexDirection: style.flexDirection,
          height: rect.height,
          titleBottom: title.bottom,
          descriptionTop: description.top,
        };
      });

      expect(geometry.flexDirection).toBe("column");
      expect(geometry.borderRadius).toBeLessThanOrEqual(12);
      expect(geometry.height).toBeGreaterThanOrEqual(68);
      expect(geometry.descriptionTop).toBeGreaterThanOrEqual(geometry.titleBottom);
    }
  });

  test("largest text keeps ToggleRow titles whole instead of leaving one-letter orphans", async ({
    page,
  }) => {
    await primeApp(page);
    await page.addInitScript(() => localStorage.setItem("zenflow_font_scale", "1.5"));
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { search: { settingsSection: "appearance" } });

    const lineWidths = await page.getByTestId("settings-v2-motion-toggle").evaluate((row) => {
      const toggle = row.querySelector<HTMLElement>('[role="switch"]');
      const title = toggle?.previousElementSibling;
      if (!(title instanceof HTMLElement)) throw new Error("Missing ToggleRow title");
      const range = document.createRange();
      range.selectNodeContents(title);
      return Array.from(range.getClientRects(), (rect) => rect.width).filter((width) => width > 0);
    });

    const widestLine = Math.max(...lineWidths);
    const lastLine = lineWidths.at(-1) ?? 0;
    expect(lineWidths.length === 1 || lastLine / widestLine >= 0.35).toBe(true);
  });

  test("compact 320px mobile detail shortens the hero without losing the page heading", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page);

    const hero = page.getByTestId("settings-page-control-card");
    const heading = page.getByRole("heading", { level: 1, name: "Settings" });
    const lead = page.getByText(
      "Choose how ZenFlow looks, sounds, reminds you, and handles your data.",
      { exact: true },
    );
    await expect(heading).toBeVisible();
    await expect(lead).toBeVisible();

    await page.getByTestId("settings-module-card-privacy").click();
    await expect(page.getByTestId("settings-mobile-back")).toBeVisible();
    await expect(heading).toBeVisible();
    await page.screenshot({ path: vicScreenshotPath("detail-hero"), fullPage: true });

    await expect(lead).toBeHidden();
    const heroBox = await hero.boundingBox();
    expect(heroBox).not.toBeNull();
    expect(heroBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(80);
  });

  test("sound owns diary ambience and exposes a 44px direct control", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`${APP_BASE}/diary?nav=v2&navLayout=phone&dev=true`);
    await expect(page.getByTestId("diary-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("diary-page-ambience-control")).toHaveCount(0);

    await openSettings(page);
    await page.getByTestId("settings-module-card-sound").click();
    const ambienceToggle = page.getByTestId("settings-v2-diary-ambience-toggle");
    await expect(ambienceToggle).toHaveAccessibleName("Play soft rain");
    const box = await ambienceToggle.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });

  for (const language of ["ar", "he"] as const) {
    test(`RTL ${language} keeps overview and detail inside the phone viewport`, async ({ page }) => {
      await primeApp(page, { language });
      await page.setViewportSize({ width: 390, height: 844 });
      await openSettings(page);

      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expectMobileOverview(page);
      await page.getByTestId("settings-module-card-privacy").click();
      await expect(page.getByTestId("settings-module-panel-privacy")).toBeVisible();
      await expect(page.getByTestId("settings-mobile-back")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const language of ["en", "ar"] as const) {
    test(`compact 320px ${language} detail keeps Menu and Back geometrically separate`, async ({
      page,
    }) => {
      await primeApp(page, { language });
      await page.setViewportSize({ width: 320, height: 568 });
      await openSettings(page);
      await expectMobileOverview(page);

      await page.getByTestId("settings-module-card-about").click();
      await expect(page.getByTestId("settings-module-panel-about")).toBeVisible();
      await expect(page.getByTestId("settings-mobile-back")).toBeVisible();

      const geometry = await page.evaluate(() => {
        const menu = document.querySelector<HTMLElement>('[data-testid="nav-v2-open-drawer"]');
        const back = document.querySelector<HTMLElement>('[data-testid="settings-mobile-back"]');
        if (!menu || !back) throw new Error("Missing phone navigation controls");
        const menuRect = menu.getBoundingClientRect();
        const backRect = back.getBoundingClientRect();
        const overlaps = !(
          menuRect.right <= backRect.left ||
          backRect.right <= menuRect.left ||
          menuRect.bottom <= backRect.top ||
          backRect.bottom <= menuRect.top
        );
        return {
          backTop: backRect.top,
          menuBottom: menuRect.bottom,
          overlaps,
          scrollY: window.scrollY,
        };
      });

      expect(geometry.overlaps).toBe(false);
      expect(geometry.backTop).toBeGreaterThanOrEqual(geometry.menuBottom);
      expect(geometry.scrollY).toBe(0);
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const scenario of [
    { language: "de", fontScale: "1.5" },
    { language: "uk", fontScale: "1" },
  ] as const) {
    test(`${scenario.language} Settings heading stays clear of the global menu`, async ({ page }) => {
      await primeApp(page, { language: scenario.language });
      await page.addInitScript((fontScale) => {
        localStorage.setItem("zenflow_font_scale", fontScale);
      }, scenario.fontScale);
      await page.setViewportSize({ width: 320, height: 568 });
      await openSettings(page);

      const measureHeadingMenuOverlap = () => page.evaluate(() => {
        const menu = document.querySelector<HTMLElement>('[data-testid="nav-v2-open-drawer"]');
        const heading = document.querySelector<HTMLElement>('[data-testid="settings-page-heading"]');
        const hero = document.querySelector<HTMLElement>('[data-testid="settings-page-control-card"]');
        if (!menu || !heading || !hero) {
          throw new Error("Missing global menu, Settings heading, or hero card");
        }
        const menuRect = menu.getBoundingClientRect();
        const heroRect = hero.getBoundingClientRect();
        const headingRange = document.createRange();
        headingRange.selectNodeContents(heading);
        const headingRect = headingRange.getBoundingClientRect();
        return {
          menu: {
            left: menuRect.left,
            right: menuRect.right,
            top: menuRect.top,
            bottom: menuRect.bottom,
          },
          heading: {
            left: headingRect.left,
            right: headingRect.right,
            top: headingRect.top,
            bottom: headingRect.bottom,
          },
          insideHero:
            headingRect.left >= heroRect.left - 1 && headingRect.right <= heroRect.right + 1,
          overlaps:
            Math.min(menuRect.right, headingRect.right) >
              Math.max(menuRect.left, headingRect.left) &&
            Math.min(menuRect.bottom, headingRect.bottom) >
              Math.max(menuRect.top, headingRect.top),
        };
      });

      const overviewGeometry = await measureHeadingMenuOverlap();
      expect(overviewGeometry.overlaps, JSON.stringify(overviewGeometry)).toBe(false);
      expect(overviewGeometry.insideHero, JSON.stringify(overviewGeometry)).toBe(true);

      await page.getByTestId("settings-module-card-appearance").click();
      const detailGeometry = await measureHeadingMenuOverlap();
      expect(detailGeometry.overlaps, JSON.stringify(detailGeometry)).toBe(false);
      expect(detailGeometry.insideHero, JSON.stringify(detailGeometry)).toBe(true);
    });
  }
});
