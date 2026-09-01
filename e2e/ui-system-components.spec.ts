import { expect, test, type Locator, type Page } from "@playwright/test";

const PREVIEW_PATH = "ui-preview.html";
const MIN_TARGET_PX = 44;

const REQUIRED_COMPONENTS = [
  "BUTTON",
  "ICON_BUTTON",
  "LINK",
  "FIELD",
  "SELECTION_CONTROL",
  "STATUS",
  "SETTINGS_ROW",
  "EMPTY_ERROR_OFFLINE",
] as const;

const REQUIRED_STATES = [
  "default",
  "hover",
  "focus-visible",
  "pressed",
  "selected",
  "checked",
  "disabled",
  "loading",
  "success",
  "warning",
  "error",
  "destructive",
  "offline",
  "permission-blocked",
  "pending-sync",
  "long-content",
  "rtl",
  "high-contrast",
  "reduced-motion",
  "recovery",
] as const;

const REQUIRED_THEMES = ["paper", "ink", "oled", "high-contrast"] as const;
const REQUIRED_LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"] as const;
const REQUIRED_INPUTS = ["keyboard", "pointer", "touch"] as const;
const REQUIRED_FOUNDATIONS = [
  "color-roles",
  "typography-roles",
  "spacing-scale",
  "radius-scale",
  "elevation-scale",
  "focus-contract",
  "target-contract",
  "motion-contract",
  "container-contract",
] as const;
const REQUIRED_CANONICAL_PAIRS = [
  ["ICON_BUTTON", "destructive"],
  ["FIELD", "loading"],
] as const;
const EXPECTED_PRODUCTION_SOURCES = {
  BUTTON: "src/components/ui/button.tsx",
  ICON_BUTTON: "src/components/ui/button.tsx",
  FIELD: "src/components/ui/input.tsx",
  SELECTION_CONTROL: "src/components/ui/switch.tsx",
  STATUS: "src/pages/nav-v2/settings/components/V2SettingsFormPrimitives.tsx",
  SETTINGS_ROW: "src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx",
} as const;

interface OpenPreviewOptions {
  path?: string;
  reducedMotion?: "reduce" | "no-preference";
}

async function openPreview(page: Page, options: OpenPreviewOptions = {}) {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });

  await page.emulateMedia({ reducedMotion: options.reducedMotion ?? "no-preference" });
  const response = await page.goto(options.path ?? PREVIEW_PATH, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  expect(response, "the dedicated UI preview entry should return a response").not.toBeNull();
  expect(response?.ok(), "the dedicated UI preview entry should load successfully").toBe(true);

  const root = page.getByTestId("ui-system-preview");
  await expect(
    root,
    "the development-only UI preview root should render instead of the application shell"
  ).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  expect(runtimeErrors, "the isolated preview should not emit runtime or console errors").toEqual(
    []
  );
  return root;
}

async function readCaseMetadata(root: Locator) {
  return root.locator("[data-preview-case]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-preview-id"),
      component: node.getAttribute("data-preview-component"),
      state: node.getAttribute("data-preview-state"),
      theme: node.getAttribute("data-preview-theme"),
      locale: node.getAttribute("data-preview-locale"),
      width: node.getAttribute("data-preview-width"),
      input: node.getAttribute("data-preview-input"),
      reducedMotion: node.getAttribute("data-preview-reduced-motion"),
      source: node.getAttribute("data-preview-source"),
      evidenceKind: node.getAttribute("data-preview-evidence-kind"),
      stateMechanism: node.getAttribute("data-preview-state-mechanism"),
    }))
  );
}

async function expectMinimumTarget(locator: Locator, label: string) {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should have rendered geometry`).not.toBeNull();
  if (!box) return;

  expect(
    box.width,
    `${label} width=${box.width.toFixed(1)}px should be at least ${MIN_TARGET_PX}px`
  ).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(
    box.height,
    `${label} height=${box.height.toFixed(1)}px should be at least ${MIN_TARGET_PX}px`
  ).toBeGreaterThanOrEqual(MIN_TARGET_PX);
}

test.describe("ZenFlow development-only UI-system component preview", () => {
  test.use({ colorScheme: "light" });

  test("renders the registered cases with real semantics and complete case metadata", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let root = await openPreview(page);
    const defaultMetadata = await readCaseMetadata(root);
    const highContrastRoot = await openPreview(page, {
      path: `${PREVIEW_PATH}?theme=high-contrast`,
    });
    const highContrastMetadata = (await readCaseMetadata(highContrastRoot)).filter(
      ({ state }) => state === "high-contrast"
    );
    const reducedMotionRoot = await openPreview(page, { reducedMotion: "reduce" });
    const reducedMotionMetadata = (await readCaseMetadata(reducedMotionRoot)).filter(
      ({ state }) => state === "reduced-motion"
    );
    const reducedMotionViolations = await reducedMotionRoot
      .locator('[data-preview-state="reduced-motion"] *')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => {
            const style = getComputedStyle(node);
            return {
              tag: node.tagName,
              animationName: style.animationName,
              animationDuration: style.animationDuration,
              transitionDuration: style.transitionDuration,
            };
          })
          .filter(
            ({ animationName, animationDuration, transitionDuration }) =>
              (animationName !== "none" && Number.parseFloat(animationDuration) > 0.000_011) ||
              transitionDuration
                .split(",")
                .some((duration) => Number.parseFloat(duration.trim()) > 0.000_011)
          )
      );
    root = await openPreview(page);
    const metadata = [...defaultMetadata, ...highContrastMetadata, ...reducedMotionMetadata];

    expect(metadata.length, "the registry should render at least one preview case").toBeGreaterThan(
      0
    );
    expect(
      metadata.map(({ id }) => id),
      "preview case IDs should be unique"
    ).toEqual([...new Set(metadata.map(({ id }) => id))]);

    for (const entry of metadata) {
      expect(entry.id, "every preview case should expose its registry ID").toMatch(/\S/);
      expect(entry.component, `case ${entry.id} should identify its component`).toMatch(/\S/);
      expect(entry.state, `case ${entry.id} should identify its state`).toMatch(/\S/);
      expect(REQUIRED_THEMES, `case ${entry.id} should use a supported preview theme`).toContain(
        entry.theme
      );
      expect(REQUIRED_LOCALES, `case ${entry.id} should use a supported ZenFlow locale`).toContain(
        entry.locale
      );
      expect(
        Number(entry.width),
        `case ${entry.id} should declare a positive width`
      ).toBeGreaterThan(0);
      expect(REQUIRED_INPUTS, `case ${entry.id} should declare its intended input mode`).toContain(
        entry.input
      );
      expect(
        ["true", "false"],
        `case ${entry.id} should declare its reduced-motion state`
      ).toContain(entry.reducedMotion);
      expect(
        ["PRODUCTION_COMPONENT", "NATIVE_ELEMENT", "CONTRACT_PATTERN"],
        `case ${entry.id} should identify the kind of runtime evidence it renders`
      ).toContain(entry.evidenceKind);
      expect(entry.source, `case ${entry.id} should identify its concrete source owner`).toMatch(
        /\S/
      );
      expect(
        ["runtime-pseudo", "semantic-state", "cross-cutting-context", "static-contract"],
        `case ${entry.id} should identify how the labelled state is established`
      ).toContain(entry.stateMechanism);
    }
    expect(
      highContrastMetadata.every(({ theme }) => theme === "high-contrast"),
      "high-contrast state cases should only be collected from the high-contrast root context"
    ).toBe(true);
    expect(
      reducedMotionMetadata.every(({ reducedMotion }) => reducedMotion === "true"),
      "reduced-motion state cases should only be collected while the browser preference is reduce"
    ).toBe(true);
    expect(
      reducedMotionMetadata.length,
      "every registered component should render in the real reduced-motion media context"
    ).toBe(REQUIRED_COMPONENTS.length);
    expect(
      reducedMotionViolations,
      "reduced-motion specimens should not retain perceptible transitions or running animations"
    ).toEqual([]);

    const components = new Set(metadata.map(({ component }) => component));
    const states = new Set(metadata.map(({ state }) => state));
    for (const component of REQUIRED_COMPONENTS) {
      expect(components, `missing registered component preview: ${component}`).toContain(component);
    }
    for (const state of REQUIRED_STATES) {
      expect(states, `missing representative component state: ${state}`).toContain(state);
    }

    const notApplicable = await root.locator("[data-preview-na]").evaluateAll((nodes) =>
      nodes.map((node) => ({
        component: node.getAttribute("data-preview-component"),
        state: node.getAttribute("data-preview-state"),
        reason: node.getAttribute("data-preview-na-reason"),
      }))
    );
    for (const entry of notApplicable) {
      expect(
        REQUIRED_COMPONENTS,
        `N/A entry should identify a registered component: ${entry.component}`
      ).toContain(entry.component);
      expect(
        REQUIRED_STATES,
        `N/A entry should identify a contracted state: ${entry.state}`
      ).toContain(entry.state);
      expect(
        entry.reason?.trim(),
        `N/A ${entry.component}/${entry.state} should have a non-empty reason`
      ).toMatch(/\S/);
    }

    const renderedPairs = new Set(
      metadata.map(({ component, state }) => `${component ?? ""}\u0000${state ?? ""}`)
    );
    const notApplicablePairs = new Set(
      notApplicable.map(({ component, state }) => `${component ?? ""}\u0000${state ?? ""}`)
    );
    for (const component of REQUIRED_COMPONENTS) {
      for (const state of REQUIRED_STATES) {
        const pair = `${component}\u0000${state}`;
        const coverageCount =
          Number(renderedPairs.has(pair)) + Number(notApplicablePairs.has(pair));
        expect(
          coverageCount,
          `${component}/${state} should have exactly one rendered case or reasoned N/A entry`
        ).toBe(1);
      }
    }
    for (const [component, state] of REQUIRED_CANONICAL_PAIRS) {
      const pair = `${component}\u0000${state}`;
      expect(
        renderedPairs.has(pair),
        `${component}/${state} is explicitly allowed by the canonical component contract`
      ).toBe(true);
      expect(notApplicablePairs.has(pair), `${component}/${state} must not be marked N/A`).toBe(
        false
      );
    }

    for (const [component, source] of Object.entries(EXPECTED_PRODUCTION_SOURCES)) {
      const componentCases = metadata.filter((entry) => entry.component === component);
      expect(componentCases.length, `${component} should have rendered cases`).toBeGreaterThan(0);
      expect(
        componentCases.every(
          (entry) => entry.source === source && entry.evidenceKind === "PRODUCTION_COMPONENT"
        ),
        `${component} should render its production owner rather than a local approximation`
      ).toBe(true);
    }

    for (const component of REQUIRED_COMPONENTS) {
      for (const state of ["rtl", "high-contrast", "reduced-motion"] as const) {
        const pair = `${component}\u0000${state}`;
        expect(
          renderedPairs.has(pair),
          `${component}/${state} is cross-cutting and must be rendered, not marked N/A`
        ).toBe(true);
        expect(notApplicablePairs.has(pair), `${component}/${state} must not also be N/A`).toBe(
          false
        );
      }
    }

    await expect(root.getByRole("button", { name: "Save appearance" }).first()).toBeVisible();
    await expect(root.getByRole("button", { name: "Open display options" }).first()).toBeVisible();
    await expect(root.getByRole("link", { name: "Review privacy settings" }).first()).toBeVisible();
    await expect(root.getByRole("textbox", { name: "Display name" }).first()).toBeVisible();
    await expect(root.getByRole("switch", { name: "Reduce motion" }).first()).toBeVisible();
    await expect(root.getByRole("status").first()).toBeVisible();
    await expect(root.getByRole("group", { name: "Account preferences" })).toBeVisible();
  });

  test("renders the contracted foundations with token-backed runtime evidence", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const root = await openPreview(page);
    await expect(root.getByRole("heading", { name: "Foundations" })).toBeVisible();

    const foundations = root.locator("[data-preview-foundation]");
    const metadata = await foundations.evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.getAttribute("data-preview-foundation"),
        tokens: node.getAttribute("data-preview-token-references"),
      }))
    );
    expect(metadata.map(({ id }) => id)).toEqual([...REQUIRED_FOUNDATIONS]);
    for (const entry of metadata) {
      expect(entry.tokens, `${entry.id} should name its runtime token dependencies`).toMatch(
        /--[a-z0-9-]+/
      );
    }

    const spacingWidths = await root
      .locator("[data-preview-space-step]")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).getBoundingClientRect().width)
      );
    expect(spacingWidths.length).toBeGreaterThanOrEqual(4);
    expect(spacingWidths).toEqual([...spacingWidths].sort((left, right) => left - right));
    expect(new Set(spacingWidths).size).toBe(spacingWidths.length);

    const radii = await root
      .locator("[data-preview-radius-sample]")
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).borderRadius));
    expect(radii.length).toBeGreaterThanOrEqual(4);
    expect(new Set(radii).size).toBe(radii.length);

    const shadows = await root
      .locator("[data-preview-elevation-sample]")
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).boxShadow));
    expect(shadows.length).toBeGreaterThanOrEqual(3);
    expect(shadows.every((shadow) => shadow !== "none")).toBe(true);

    const focusControl = root.getByRole("button", { name: "Inspect focus token" });
    await focusControl.focus();
    const focusStyle = await focusControl.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outline: style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0,
        ring: style.boxShadow !== "none",
      };
    });
    expect(focusStyle.outline || focusStyle.ring).toBe(true);

    await expectMinimumTarget(
      root.getByRole("button", { name: "Inspect minimum target" }),
      "foundation minimum target"
    );
  });

  test("keeps every rendered interactive target at least 44px and exposes keyboard focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const root = await openPreview(page);
    const interactive = root.locator(
      'button, a[href], input:not([type="hidden"]), textarea, select, [role="switch"]'
    );
    const interactiveCount = await interactive.count();

    expect(
      interactiveCount,
      "the preview should render interactive component cases"
    ).toBeGreaterThan(0);
    for (let index = 0; index < interactiveCount; index += 1) {
      const target = interactive.nth(index);
      if (await target.isVisible()) {
        await expectMinimumTarget(target, `interactive preview target #${index + 1}`);
      }
    }

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });

    let focusReachedPreview = false;
    for (let attempt = 0; attempt < interactiveCount + 5; attempt += 1) {
      await page.keyboard.press("Tab");
      focusReachedPreview = await root.evaluate((element) =>
        element.contains(document.activeElement)
      );
      if (focusReachedPreview) break;
    }
    expect(focusReachedPreview, "keyboard Tab should reach a preview control").toBe(true);

    const focusEvidence = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return null;
      const style = getComputedStyle(element);
      return {
        focusVisible: element.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth || "0"),
        boxShadow: style.boxShadow,
      };
    });

    expect(focusEvidence, "an interactive preview control should own focus").not.toBeNull();
    expect(focusEvidence?.focusVisible, "keyboard focus should match :focus-visible").toBe(true);
    expect(
      Boolean(
        focusEvidence &&
        ((focusEvidence.outlineStyle !== "none" && focusEvidence.outlineWidth > 0) ||
          focusEvidence.boxShadow !== "none")
      ),
      "keyboard focus should have a visible outline or focus ring"
    ).toBe(true);
  });

  test("uses one Settings group surface while retaining explicit recovery containment", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const root = await openPreview(page);
    const settingsCases = root.locator(
      '[data-preview-case][data-preview-component="SETTINGS_ROW"]'
    );
    const settingsCaseCount = await settingsCases.count();

    expect(settingsCaseCount).toBeGreaterThan(0);

    for (let index = 0; index < settingsCaseCount; index += 1) {
      const specimen = settingsCases.nth(index);
      const panel = specimen.locator('[data-testid^="preview-panel-"]');
      const group = panel.locator('[data-slot="settings-group"]');
      const row = panel.locator('[data-containment="row"]').first();

      await expect(panel).toHaveCount(1);
      await expect(group).toHaveCount(1);
      await expect(group).toHaveAttribute("data-containment", "group");
      await expect(row).toHaveCount(1);

      const containment = await panel.evaluate((panelElement) => {
        const groupElement = panelElement.querySelector<HTMLElement>(
          '[data-slot="settings-group"]'
        );
        const rowElement = panelElement.querySelector<HTMLElement>('[data-containment="row"]');
        if (!groupElement || !rowElement) return null;

        const panelStyle = getComputedStyle(panelElement);
        const groupStyle = getComputedStyle(groupElement);
        const rowStyle = getComputedStyle(rowElement);
        return {
          panel: {
            backgroundColor: panelStyle.backgroundColor,
            borderWidth: panelStyle.borderWidth,
            boxShadow: panelStyle.boxShadow,
            overflow: panelStyle.overflow,
          },
          group: {
            backgroundColor: groupStyle.backgroundColor,
            borderWidth: groupStyle.borderWidth,
            boxShadow: groupStyle.boxShadow,
            overflow: groupStyle.overflow,
          },
          row: {
            backgroundColor: rowStyle.backgroundColor,
            borderWidth: rowStyle.borderWidth,
            boxShadow: rowStyle.boxShadow,
          },
        };
      });

      expect(containment).not.toBeNull();
      expect(containment?.panel.borderWidth).toBe("0px");
      expect(containment?.panel.boxShadow).toBe("none");
      expect(containment?.panel.overflow).toBe("visible");
      expect(containment?.group.borderWidth).not.toBe("0px");
      expect(containment?.group.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(containment?.group.boxShadow).toBe("none");
      expect(containment?.group.overflow).toBe("visible");
      expect(containment?.row.borderWidth).toBe("0px");
      expect(containment?.row.backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(containment?.row.boxShadow).toBe("none");
    }

    for (const state of [
      "loading",
      "warning",
      "error",
      "destructive",
      "offline",
      "permission-blocked",
      "pending-sync",
      "recovery",
    ] as const) {
      const callout = root
        .locator(
          `[data-preview-component="SETTINGS_ROW"][data-preview-state="${state}"] [data-containment="callout"]`
        )
        .first();
      await expect(callout).toBeVisible();
      const style = await callout.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          borderWidth: computed.borderWidth,
          backgroundColor: computed.backgroundColor,
          boxShadow: computed.boxShadow,
        };
      });
      expect(style.borderWidth).not.toBe("0px");
      expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(style.boxShadow).toBe("none");
    }

    const defaultSettingsCase = root.locator(
      '[data-preview-case][data-preview-component="SETTINGS_ROW"][data-preview-state="default"]'
    );
    const settingsChoice = defaultSettingsCase.locator('[data-testid^="preview-choice-"]');
    const settingsAction = defaultSettingsCase.locator('[data-testid^="preview-action-"]');
    await expect(settingsChoice).toHaveAttribute("aria-pressed", "false");
    await expect(settingsAction).toBeEnabled();
    for (const control of [settingsChoice, settingsAction]) {
      const style = await control.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          borderWidth: computed.borderWidth,
          backgroundColor: computed.backgroundColor,
          boxShadow: computed.boxShadow,
        };
      });
      expect(style.borderWidth).not.toBe("0px");
      expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(style.boxShadow).toBe("none");
    }
  });

  test("drives representative interaction and semantic states instead of trusting labels", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const root = await openPreview(page);

    const hoverTarget = root
      .locator('[data-preview-component="BUTTON"][data-preview-state="hover"] button')
      .first();
    const hoverBefore = await hoverTarget.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
      };
    });
    expect(await hoverTarget.evaluate((element) => element.matches(":hover"))).toBe(false);
    await hoverTarget.hover();
    expect(
      await hoverTarget.evaluate((element) => element.matches(":hover")),
      "the hover case should receive real pointer hover"
    ).toBe(true);
    const hoverBeforeSignature = JSON.stringify(hoverBefore);
    await expect
      .poll(
        async () =>
          hoverTarget.evaluate((element) => {
            const style = getComputedStyle(element);
            return JSON.stringify({
              backgroundColor: style.backgroundColor,
              borderColor: style.borderColor,
              boxShadow: style.boxShadow,
            });
          }),
        {
          message:
            "real pointer hover should eventually change the production button after its CSS transition starts",
          timeout: 2_000,
        }
      )
      .not.toBe(hoverBeforeSignature);
    const hoverAfter = await hoverTarget.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
      };
    });
    expect(
      hoverAfter,
      "real pointer hover should change the production button's computed presentation"
    ).not.toEqual(hoverBefore);

    const focusTarget = root
      .locator('[data-preview-component="BUTTON"][data-preview-state="focus-visible"] button')
      .first();
    expect(await focusTarget.evaluate((element) => element.matches(":focus-visible"))).toBe(false);
    await focusTarget.focus();
    expect(
      await focusTarget.evaluate((element) => element.matches(":focus-visible")),
      "the focus-visible case should receive real keyboard-style focus"
    ).toBe(true);
    expect(
      await focusTarget.evaluate((element) => getComputedStyle(element).boxShadow),
      "real focus-visible should expose the production focus ring"
    ).not.toBe("none");

    const pressedTarget = root
      .locator('[data-preview-component="BUTTON"][data-preview-state="pressed"] button')
      .first();
    const pressedBox = await pressedTarget.boundingBox();
    expect(pressedBox, "the pressed case should expose rendered geometry").not.toBeNull();
    if (pressedBox) {
      await page.mouse.move(
        pressedBox.x + pressedBox.width / 2,
        pressedBox.y + pressedBox.height / 2
      );
      await page.mouse.down();
      expect(
        await pressedTarget.evaluate((element) => element.matches(":active")),
        "the pressed case should receive a real active pointer state"
      ).toBe(true);
      expect(
        await pressedTarget.evaluate((element) => getComputedStyle(element).transform),
        "real active state should apply the production button press transform"
      ).not.toBe("none");
      await page.mouse.up();
    }

    await expect(
      root
        .locator(
          '[data-preview-component="SELECTION_CONTROL"][data-preview-state="checked"] [role="switch"]'
        )
        .first()
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      root
        .locator(
          '[data-preview-component="SELECTION_CONTROL"][data-preview-state="checked"] [role="switch"]'
        )
        .first()
    ).toHaveAttribute("data-state", "checked");
    await expect(
      root.locator('[data-preview-component="FIELD"][data-preview-state="disabled"] input').first()
    ).toBeDisabled();
    await expect(
      root.locator('[data-preview-component="BUTTON"][data-preview-state="loading"] button').first()
    ).toHaveAttribute("aria-busy", "true");
    await expect(
      root.locator('[data-preview-component="FIELD"][data-preview-state="loading"] input').first()
    ).toHaveAttribute("aria-busy", "true");
    await expect(
      root.locator('[data-preview-component="FIELD"][data-preview-state="error"] input').first()
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      root
        .locator('[data-preview-component="STATUS"][data-preview-state="error"] [role="status"]')
        .first()
    ).toBeVisible();
    await expect(
      root
        .locator('[data-preview-component="STATUS"][data-preview-state="offline"] [role="status"]')
        .first()
    ).toBeVisible();
  });

  test("uses the production switch on Web without reading or writing preview storage", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const operations: string[] = [];
      Object.defineProperty(window, "__ZENFLOW_PREVIEW_STORAGE_OPERATIONS__", {
        configurable: true,
        value: operations,
      });
      for (const method of ["getItem", "setItem", "removeItem", "clear"] as const) {
        const original = Storage.prototype[method] as (...methodArgs: unknown[]) => unknown;
        Object.defineProperty(Storage.prototype, method, {
          configurable: true,
          value: function (this: Storage, ...args: unknown[]) {
            operations.push(method);
            return Reflect.apply(original, this, args);
          },
        });
      }
    });

    const root = await openPreview(page);
    await expect(page.locator("html")).toHaveAttribute("data-platform", "web");
    const switchControl = root
      .locator(
        '[data-preview-component="SELECTION_CONTROL"][data-preview-state="default"] [role="switch"]'
      )
      .first();
    await switchControl.click();
    await expect(switchControl).toHaveAttribute("data-state", "checked");
    expect(
      await page.evaluate(
        () =>
          (
            window as typeof window & {
              __ZENFLOW_PREVIEW_STORAGE_OPERATIONS__?: string[];
            }
          ).__ZENFLOW_PREVIEW_STORAGE_OPERATIONS__ ?? []
      ),
      "the Web haptics short-circuit should avoid preview storage reads and writes"
    ).toEqual([]);
  });

  test("applies each requested theme at the document root", async ({ page }) => {
    const cases = [
      { requested: "paper", theme: "paper", contrast: null },
      { requested: "ink", theme: "ink", contrast: null },
      { requested: "oled", theme: "oled", contrast: null },
      { requested: "high-contrast", theme: "paper", contrast: "high" },
    ] as const;
    const backgrounds = new Map<string, string>();
    const primaryTokens = new Map<string, string>();

    for (const previewTheme of cases) {
      const response = await page.goto(`${PREVIEW_PATH}?theme=${previewTheme.requested}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      expect(response?.ok()).toBe(true);
      await expect(page.getByTestId("ui-system-preview")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", previewTheme.theme);
      if (previewTheme.contrast) {
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme-contrast",
          previewTheme.contrast
        );
      } else {
        await expect(page.locator("html")).not.toHaveAttribute("data-theme-contrast");
      }
      const previewCases = page.locator("[data-preview-case]");
      expect(await previewCases.count()).toBeGreaterThan(0);
      expect(
        await previewCases.evaluateAll(
          (nodes, requestedTheme) =>
            nodes.every((node) => node.getAttribute("data-preview-theme") === requestedTheme),
          previewTheme.requested
        ),
        "every specimen on a theme page should report the root theme that actually owns its tokens"
      ).toBe(true);
      const tokenOwnership = await previewCases.evaluateAll((nodes) => {
        const rootPrimary = getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim();
        return {
          rootPrimary,
          everyCaseInheritsRootPrimary: nodes.every(
            (node) => getComputedStyle(node).getPropertyValue("--primary").trim() === rootPrimary
          ),
        };
      });
      expect(
        tokenOwnership.everyCaseInheritsRootPrimary,
        "specimens should inherit the active root theme tokens rather than simulated card colors"
      ).toBe(true);
      primaryTokens.set(previewTheme.requested, tokenOwnership.rootPrimary);

      backgrounds.set(
        previewTheme.requested,
        await page
          .locator("html")
          .evaluate((element) => getComputedStyle(element).getPropertyValue("--background").trim())
      );
    }

    expect(backgrounds.get("paper"), "Paper should resolve its root background token").toMatch(
      /\S/
    );
    expect(backgrounds.get("ink"), "Ink should resolve a different root background token").not.toBe(
      backgrounds.get("paper")
    );
    expect(
      backgrounds.get("oled"),
      "OLED should resolve a different root background token"
    ).not.toBe(backgrounds.get("ink"));
    expect(primaryTokens.get("paper"), "Paper should resolve a root primary token").toMatch(/\S/);
    expect(primaryTokens.get("ink"), "Ink should resolve its own root primary token").not.toBe(
      primaryTokens.get("paper")
    );
  });

  test("covers every theme and locale without compact RTL or long-content overflow", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const root = await openPreview(page);
    const cases = root.locator("[data-preview-case]");
    const metadata = await cases.evaluateAll((nodes) =>
      nodes.map((node) => ({
        theme: node.getAttribute("data-preview-theme"),
        locale: node.getAttribute("data-preview-locale"),
      }))
    );

    const locales = new Set(metadata.map(({ locale }) => locale));
    expect(
      new Set(metadata.map(({ theme }) => theme)),
      "the default preview page should render under one truthful root theme"
    ).toEqual(new Set(["paper"]));
    for (const locale of REQUIRED_LOCALES) {
      expect(locales, `missing preview locale: ${locale}`).toContain(locale);
    }

    for (const locale of ["ar", "he"] as const) {
      const rtlCases = root.locator(`[data-preview-locale="${locale}"]`);
      expect(
        await rtlCases.count(),
        `${locale} should have at least one preview case`
      ).toBeGreaterThan(0);
      for (let index = 0; index < (await rtlCases.count()); index += 1) {
        await expect(
          rtlCases.nth(index),
          `${locale} case #${index + 1} should use RTL`
        ).toHaveAttribute("dir", "rtl");
      }
    }

    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.scrollWidth - window.innerWidth,
      root:
        (document.querySelector('[data-testid="ui-system-preview"]')?.scrollWidth ?? 0) -
        (document.querySelector('[data-testid="ui-system-preview"]')?.clientWidth ?? 0),
    }));
    expect(
      overflow.viewport,
      "the compact preview should not create horizontal page overflow"
    ).toBe(0);
    expect(
      overflow.root,
      "the compact preview root should not overflow horizontally"
    ).toBeLessThanOrEqual(0);

    for (const state of ["long-content", "rtl"] as const) {
      const stateCases = root.locator(`[data-preview-state="${state}"]`);
      expect(await stateCases.count(), `${state} should have a rendered case`).toBeGreaterThan(0);
      for (let index = 0; index < (await stateCases.count()); index += 1) {
        const delta = await stateCases.nth(index).evaluate((element) => {
          const node = element as HTMLElement;
          return node.scrollWidth - node.clientWidth;
        });
        expect(delta, `${state} case #${index + 1} should not overflow`).toBeLessThanOrEqual(0);
      }
    }

    const highContrastRoot = await openPreview(page, {
      path: `${PREVIEW_PATH}?theme=high-contrast`,
    });
    const highContrastCases = highContrastRoot.locator('[data-preview-state="high-contrast"]');
    expect(await highContrastCases.count()).toBe(REQUIRED_COMPONENTS.length);
    for (let index = 0; index < (await highContrastCases.count()); index += 1) {
      const delta = await highContrastCases.nth(index).evaluate((element) => {
        const node = element as HTMLElement;
        return node.scrollWidth - node.clientWidth;
      });
      expect(delta, `high-contrast case #${index + 1} should not overflow`).toBeLessThanOrEqual(0);
    }

    const screenshot = await page.screenshot({
      animations: "disabled",
      fullPage: true,
    });
    await testInfo.attach("ui-system-preview-compact", {
      body: screenshot,
      contentType: "image/png",
    });
  });
});
