import { expect, test } from "@playwright/test";

const EXACT_SCALE_VIEWPORT = { width: 206, height: 382 };
const MAX_SETTINGS_VIEWPORTS = 24;
const OVERLAP_LOCALES = ["en", "de", "ar", "he"] as const;

type TextBreak = {
  selector: string;
  text: string;
  before: string;
  after: string;
};

type OverlapMeasurement = {
  locale: (typeof OVERLAP_LOCALES)[number];
  direction: string;
  trigger: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  logicalPosition: "start" | "end";
  positions: Array<{
    name: "top" | "middle" | "footer";
    scrollTop: number;
    intersections: Array<{
      kind: "text" | "interactive-label";
      label: string;
      left: number;
      top: number;
      right: number;
      bottom: number;
      overlapArea: number;
    }>;
  }>;
};

test("Settings uses a bounded single-layer paper ambience at combined scale", async ({ page }) => {
  await page.setViewportSize(EXACT_SCALE_VIEWPORT);
  await page.goto(
    `${process.env.T185_QA_BASE_URL ?? "http://127.0.0.1:4185"}/?qaRoute=settings&qaLang=en`
  );
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.addStyleTag({
    content: ":root { font-size: 32px !important; -webkit-text-size-adjust: 100% !important; }",
  });

  const ambience = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>("[data-active-page='settings']");
    const backdrop = document.querySelector<HTMLElement>(".settings-day-cosmic-backdrop");
    if (!shell || !backdrop) throw new Error("Settings paper ambience is unavailable");
    return {
      fixedBackdropDisplay: getComputedStyle(backdrop).display,
      shellBackgroundImage: getComputedStyle(shell).backgroundImage,
    };
  });

  expect(ambience.fixedBackdropDisplay).toBe("none");
  expect(ambience.shellBackgroundImage).toContain("radial-gradient");
  expect(ambience.shellBackgroundImage).toContain("linear-gradient");
});

test("Settings keeps the fixed drawer trigger outside visible text and labels while scrolling", async ({
  page,
}) => {
  await page.setViewportSize(EXACT_SCALE_VIEWPORT);
  const measurements: OverlapMeasurement[] = [];

  for (const locale of OVERLAP_LOCALES) {
    await page.goto(
      `${process.env.T185_QA_BASE_URL ?? "http://127.0.0.1:4185"}/?qaRoute=settings&qaLang=${locale}`
    );
    await expect(page.getByTestId("settings-page")).toBeVisible();
    await page.addStyleTag({
      content: ":root { font-size: 32px !important; -webkit-text-size-adjust: 100% !important; }",
    });
    await page.evaluate(() => document.fonts.ready);

    const localeMeasurement = await page.evaluate(async (testedLocale) => {
      const trigger = document.querySelector<HTMLElement>("[data-testid='nav-v2-open-drawer']");
      const settings = document.querySelector<HTMLElement>("[data-testid='settings-page']");
      const footer = document.querySelector<HTMLElement>("[data-testid='settings-support-footer']");
      if (!trigger || !settings || !footer) {
        throw new Error("Settings overlap fixtures are unavailable");
      }

      const triggerBounds = trigger.getBoundingClientRect();
      const triggerRect = {
        left: triggerBounds.left,
        top: triggerBounds.top,
        right: triggerBounds.right,
        bottom: triggerBounds.bottom,
        width: triggerBounds.width,
        height: triggerBounds.height,
      };
      const direction = getComputedStyle(document.documentElement).direction;
      const logicalPosition =
        triggerBounds.left + triggerBounds.width / 2 < document.documentElement.clientWidth / 2
          ? "start"
          : ("end" as "start" | "end");
      const pageOverflowY = getComputedStyle(settings).overflowY;
      const usesSettingsScroll =
        settings.scrollHeight > settings.clientHeight && ["auto", "scroll"].includes(pageOverflowY);
      const scrollOwner = usesSettingsScroll ? settings : document.scrollingElement;
      if (!scrollOwner) throw new Error("Settings scroll owner is unavailable");
      const scrollTargets = [
        { name: "top" as const, top: 0 },
        { name: "middle" as const, top: 430 },
        {
          name: "footer" as const,
          top: Math.max(0, scrollOwner.scrollHeight - scrollOwner.clientHeight),
        },
      ];

      const positiveIntersection = (candidate: {
        left: number;
        top: number;
        right: number;
        bottom: number;
      }) => {
        const width =
          Math.min(triggerRect.right, candidate.right) - Math.max(triggerRect.left, candidate.left);
        const height =
          Math.min(triggerRect.bottom, candidate.bottom) - Math.max(triggerRect.top, candidate.top);
        return width > 0 && height > 0 ? width * height : 0;
      };
      const isRendered = (element: Element) => {
        const style = getComputedStyle(element);
        return (
          style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0
        );
      };
      const clipToVisibleSettingsViewport = (rect: DOMRect) => {
        const settingsBounds = settings.getBoundingClientRect();
        const clipped = {
          left: Math.max(rect.left, settingsBounds.left, 0),
          top: Math.max(rect.top, settingsBounds.top, 0),
          right: Math.min(rect.right, settingsBounds.right, document.documentElement.clientWidth),
          bottom: Math.min(
            rect.bottom,
            settingsBounds.bottom,
            document.documentElement.clientHeight
          ),
        };
        return clipped.right > clipped.left && clipped.bottom > clipped.top ? clipped : null;
      };

      const positions = [];
      for (const target of scrollTargets) {
        if (usesSettingsScroll) settings.scrollTo(0, target.top);
        else window.scrollTo(0, target.top);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );

        const intersections: Array<{
          kind: "text" | "interactive-label";
          label: string;
          left: number;
          top: number;
          right: number;
          bottom: number;
          overlapArea: number;
        }> = [];
        const walker = document.createTreeWalker(settings, NodeFilter.SHOW_TEXT);
        let textNode = walker.nextNode();
        while (textNode) {
          const parent = textNode.parentElement;
          const value = (textNode.textContent ?? "").replace(/\s+/g, " ").trim();
          if (parent && value && isRendered(parent)) {
            const range = document.createRange();
            range.selectNodeContents(textNode);
            for (const rect of range.getClientRects()) {
              const visibleRect = clipToVisibleSettingsViewport(rect);
              const overlapArea = visibleRect ? positiveIntersection(visibleRect) : 0;
              if (overlapArea > 0) {
                intersections.push({
                  kind: "text",
                  label: value.slice(0, 120),
                  left: rect.left,
                  top: rect.top,
                  right: rect.right,
                  bottom: rect.bottom,
                  overlapArea,
                });
              }
            }
          }
          textNode = walker.nextNode();
        }

        for (const control of settings.querySelectorAll<HTMLElement>(
          "button[aria-label], a[aria-label], input[aria-label], textarea[aria-label], select[aria-label], [role='button'][aria-label]"
        )) {
          if (!isRendered(control)) continue;
          const label = control.getAttribute("aria-label")?.trim();
          if (!label || control.innerText.trim()) continue;
          const rect = control.getBoundingClientRect();
          const visibleRect = clipToVisibleSettingsViewport(rect);
          const overlapArea = visibleRect ? positiveIntersection(visibleRect) : 0;
          if (overlapArea > 0) {
            intersections.push({
              kind: "interactive-label",
              label,
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              overlapArea,
            });
          }
        }

        positions.push({
          name: target.name,
          scrollTop: usesSettingsScroll ? settings.scrollTop : window.scrollY,
          intersections,
        });
      }

      return {
        locale: testedLocale,
        direction,
        trigger: triggerRect,
        logicalPosition,
        positions,
      };
    }, locale);
    measurements.push(localeMeasurement);
  }

  expect(
    measurements.map(({ locale, direction, logicalPosition }) => ({
      locale,
      direction,
      logicalPosition,
    }))
  ).toEqual([
    { locale: "en", direction: "ltr", logicalPosition: "start" },
    { locale: "de", direction: "ltr", logicalPosition: "start" },
    { locale: "ar", direction: "rtl", logicalPosition: "end" },
    { locale: "he", direction: "rtl", logicalPosition: "end" },
  ]);
  expect(
    measurements
      .flatMap(({ locale, trigger }) => [
        { locale, dimension: "width", value: trigger.width },
        { locale, dimension: "height", value: trigger.height },
      ])
      .filter(({ value }) => value < 44)
  ).toEqual([]);
  expect(
    measurements.flatMap(({ locale, positions }) =>
      positions.flatMap(({ name, scrollTop, intersections }) =>
        intersections.map((intersection) => ({
          locale,
          position: name,
          scrollTop,
          ...intersection,
        }))
      )
    )
  ).toEqual([]);
});

test("Settings keeps words and traversal usable at combined 200% font and display scale", async ({
  page,
}) => {
  await page.setViewportSize(EXACT_SCALE_VIEWPORT);
  await page.goto(
    `${process.env.T185_QA_BASE_URL ?? "http://127.0.0.1:4185"}/?qaRoute=settings&qaLang=en`
  );
  await expect(page.getByTestId("settings-page")).toBeVisible();

  // The viewport models 2x display density; the root size models Android's 2x font scale.
  await page.addStyleTag({
    content: ":root { font-size: 32px !important; -webkit-text-size-adjust: 100% !important; }",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

  const measurement = await page.evaluate(
    ({ maxViewports }) => {
      const targetSelector = [
        "[data-testid='settings-page-heading']",
        "[data-slot='settings-module-label']",
        "[data-slot='settings-module-value']",
        "[data-testid='settings-support-footer'] button",
      ].join(",");
      const letter = /\p{L}/u;
      const breaks: TextBreak[] = [];
      let midWordBreakCount = 0;

      for (const element of document.querySelectorAll<HTMLElement>(targetSelector)) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const value = node.textContent ?? "";
          const lines: Array<{ top: number; chars: Array<{ value: string; index: number }> }> = [];
          for (let index = 0; index < value.length; index += 1) {
            if (!value[index]?.trim()) continue;
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + 1);
            const rect = range.getBoundingClientRect();
            const line = lines.find((candidate) => Math.abs(candidate.top - rect.top) < 0.75);
            const character = { value: value[index], index };
            if (line) line.chars.push(character);
            else lines.push({ top: rect.top, chars: [character] });
          }
          lines.sort((a, b) => a.top - b.top);
          for (let index = 0; index < lines.length - 1; index += 1) {
            const before = lines[index]?.chars.at(-1);
            const after = lines[index + 1]?.chars[0];
            if (
              before &&
              after &&
              after.index === before.index + 1 &&
              letter.test(before.value) &&
              letter.test(after.value)
            ) {
              midWordBreakCount += 1;
              if (breaks.length < 20) {
                breaks.push({
                  selector: element.dataset.testid ?? element.tagName.toLowerCase(),
                  text: element.innerText.trim(),
                  before: before.value,
                  after: after.value,
                });
              }
            }
          }
          node = walker.nextNode();
        }
      }

      const page = document.querySelector<HTMLElement>("[data-testid='settings-page']");
      const unusableFragments: Array<{ text: string; lineLengths: number[] }> = [];
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-testid^='settings-module-card-']"
      )) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const value = node.textContent ?? "";
          const lines = new Map<number, number>();
          for (let index = 0; index < value.length; index += 1) {
            if (!value[index]?.trim()) continue;
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + 1);
            const top = Math.round(range.getBoundingClientRect().top);
            lines.set(top, (lines.get(top) ?? 0) + 1);
          }
          const lineLengths = Array.from(lines.values());
          const oneCharacterRatio =
            lineLengths.filter((length) => length === 1).length / Math.max(1, lineLengths.length);
          if (lineLengths.length >= 4 && oneCharacterRatio > 0.5) {
            unusableFragments.push({ text: value.trim(), lineLengths });
          }
          node = walker.nextNode();
        }
      }
      const actions = Array.from(
        document.querySelectorAll<HTMLElement>("[data-testid='settings-support-footer'] button")
      ).map((button) => ({
        text: button.innerText.trim(),
        width: Math.round(button.getBoundingClientRect().width),
        height: Math.round(button.getBoundingClientRect().height),
      }));
      const root = document.documentElement;
      const firstModule = document.querySelector<HTMLElement>(
        "[data-testid^='settings-module-card-']"
      );
      const firstModuleLabel = firstModule?.querySelector<HTMLElement>(
        "[data-slot='settings-module-label']"
      );

      return {
        viewport: { width: root.clientWidth, height: root.clientHeight },
        pageWidth: page?.getBoundingClientRect().width ?? 0,
        scrollWidth: root.scrollWidth,
        scrollHeight: page?.scrollHeight ?? root.scrollHeight,
        traversalViewports:
          (page?.scrollHeight ?? root.scrollHeight) / (page?.clientHeight || root.clientHeight),
        maxViewports,
        headingLines: document
          .querySelector<HTMLElement>("[data-testid='settings-page-heading']")
          ?.getClientRects().length,
        midWordBreakCount,
        midWordBreakSamples: breaks,
        unusableFragments,
        firstModuleGridColumns: firstModule
          ? getComputedStyle(firstModule).gridTemplateColumns
          : "",
        firstModuleLabelWidth: firstModuleLabel?.getBoundingClientRect().width ?? 0,
        actions,
      };
    },
    { maxViewports: MAX_SETTINGS_VIEWPORTS }
  );

  expect(measurement.viewport).toEqual(EXACT_SCALE_VIEWPORT);
  expect(measurement.scrollWidth).toBe(measurement.viewport.width);
  expect(measurement.pageWidth).toBeGreaterThanOrEqual(EXACT_SCALE_VIEWPORT.width - 1);
  expect({
    count: measurement.midWordBreakCount,
    samples: measurement.midWordBreakSamples,
  }).toEqual({ count: 0, samples: [] });
  expect(measurement.unusableFragments).toEqual([]);
  expect(measurement.firstModuleLabelWidth).toBeGreaterThanOrEqual(150);
  expect(measurement.traversalViewports).toBeLessThanOrEqual(MAX_SETTINGS_VIEWPORTS);
  expect(measurement.actions.map(({ text }) => text)).toEqual(
    expect.arrayContaining([
      "Send Feedback",
      "Privacy policy",
      "Terms of service",
      "Licenses",
      "Check for updates",
    ])
  );
  expect(measurement.actions.filter(({ width, height }) => width < 44 || height < 44)).toEqual([]);
});

test("German Settings footer keeps compound action labels readable at combined 200% scale", async ({
  page,
}) => {
  await page.setViewportSize(EXACT_SCALE_VIEWPORT);
  await page.goto(
    `${process.env.T185_QA_BASE_URL ?? "http://127.0.0.1:4185"}/?qaRoute=settings&qaLang=de`
  );
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.addStyleTag({
    content: ":root { font-size: 32px !important; -webkit-text-size-adjust: 100% !important; }",
  });
  await page.evaluate(() => document.fonts.ready);

  const footer = await page.evaluate(() => {
    const letter = /\p{L}/u;
    const midWordBreaks: TextBreak[] = [];
    const actions = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='settings-support-footer'] button")
    ).map((button) => {
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const value = node.textContent ?? "";
        const characters: Array<{ value: string; index: number; top: number }> = [];
        for (let index = 0; index < value.length; index += 1) {
          if (!value[index]?.trim()) continue;
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          characters.push({ value: value[index], index, top: range.getBoundingClientRect().top });
        }
        for (let index = 0; index < characters.length - 1; index += 1) {
          const before = characters[index];
          const after = characters[index + 1];
          if (
            after.index === before.index + 1 &&
            Math.abs(after.top - before.top) > 0.75 &&
            letter.test(before.value) &&
            letter.test(after.value)
          ) {
            midWordBreaks.push({
              selector: button.dataset.testid ?? "settings-footer-action",
              text: button.innerText.trim(),
              before: before.value,
              after: after.value,
            });
          }
        }
        node = walker.nextNode();
      }
      const bounds = button.getBoundingClientRect();
      return { text: button.innerText.trim(), width: bounds.width, height: bounds.height };
    });
    return { midWordBreaks, actions };
  });

  expect(footer.midWordBreaks).toEqual([]);
  expect(footer.actions.filter(({ width, height }) => width < 44 || height < 44)).toEqual([]);
});

test("Settings feedback overlay remains one-axis and focusable at combined 200% scale", async ({
  page,
}) => {
  await page.setViewportSize(EXACT_SCALE_VIEWPORT);
  await page.goto(
    `${process.env.T185_QA_BASE_URL ?? "http://127.0.0.1:4185"}/?qaRoute=settings&qaLang=en`
  );
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.addStyleTag({
    content: ":root { font-size: 32px !important; -webkit-text-size-adjust: 100% !important; }",
  });
  await page.getByRole("button", { name: "Send Feedback" }).click();

  const dialog = page.getByRole("dialog", { name: "Send Feedback" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });
  const measurement = await dialog.evaluate((element) => {
    const viewportWidth = document.documentElement.clientWidth;
    const panel = element.firstElementChild as HTMLElement;
    const required = Array.from(
      element.querySelectorAll<HTMLElement>("h2, p, button, textarea, input")
    ).map((control) => {
      const bounds = control.getBoundingClientRect();
      return {
        tag: control.tagName,
        text: (control.innerText || control.getAttribute("aria-label") || "").trim(),
        left: bounds.left,
        right: bounds.right,
        width: bounds.width,
        height: bounds.height,
      };
    });
    return {
      viewportWidth,
      panelClientWidth: panel.clientWidth,
      panelScrollWidth: panel.scrollWidth,
      clipped: required.filter(({ left, right }) => left < -0.5 || right > viewportWidth + 0.5),
      undersizedActions: required.filter(
        ({ tag, text, width, height }) =>
          ["BUTTON", "TEXTAREA", "INPUT"].includes(tag) && text && (width < 44 || height < 44)
      ),
    };
  });

  expect(measurement.panelScrollWidth).toBeLessThanOrEqual(measurement.panelClientWidth);
  expect(measurement.clipped).toEqual([]);
  expect(measurement.undersizedActions).toEqual([]);
  await page.getByRole("textbox", { name: "Describe your issue or suggestion..." }).focus();
  await expect(
    page.getByRole("textbox", { name: "Describe your issue or suggestion..." })
  ).toBeFocused();
});

test("Update-required actions use an untransformed one-axis paint plane at combined scale", async ({
  page,
}) => {
  await page.setViewportSize(EXACT_SCALE_VIEWPORT);
  await page.goto(
    `${process.env.T185_QA_BASE_URL ?? "http://127.0.0.1:4185"}/?qaRoute=settings&qaLang=en`
  );
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.addStyleTag({
    content: ":root { font-size: 32px !important; -webkit-text-size-adjust: 100% !important; }",
  });
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("zenflow:chunk-load-error", {
        detail: { message: "T185 installed compositor characterization", chunk: "t185" },
      })
    );
  });

  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const measurement = await dialog.evaluate(async (element) => {
    const content = element as HTMLElement;
    content.scrollTo(0, content.scrollHeight);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const style = getComputedStyle(content);
    const bounds = content.getBoundingClientRect();
    const actions = Array.from(content.querySelectorAll<HTMLElement>("button")).map((action) => {
      const actionBounds = action.getBoundingClientRect();
      return {
        text: action.innerText.trim(),
        top: actionBounds.top,
        bottom: actionBounds.bottom,
        width: actionBounds.width,
        height: actionBounds.height,
      };
    });
    return {
      transform: style.transform,
      horizontalOverflow: content.scrollWidth > content.clientWidth,
      verticalScroll: content.scrollHeight > content.clientHeight,
      bounds: { top: bounds.top, bottom: bounds.bottom },
      actions,
    };
  });

  expect(measurement.transform).toBe("none");
  expect(measurement.horizontalOverflow).toBe(false);
  expect(measurement.verticalScroll).toBe(true);
  expect(measurement.actions).not.toHaveLength(0);
  expect(
    measurement.actions.filter(
      ({ top, bottom, width, height }) =>
        top < measurement.bounds.top ||
        bottom > measurement.bounds.bottom ||
        width < 44 ||
        height < 44
    )
  ).toEqual([]);
});
