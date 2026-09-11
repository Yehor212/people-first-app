import { expect, test } from "@playwright/test";
import { primeZenflowV2 } from "./helpers/zenflowV2State";

test("retained scenery keeps its paint size while a page anchor is being released", async ({ page }) => {
  await page.setContent(`
    <main id="page" style="position:relative;width:412.1875px;height:974.1875px">
      <div class="cosmic-scene-slot" data-cosmic-scene-anchor="true"></div>
    </main>
    <div class="cosmic-scene-frame" data-active="true"></div>
  `);
  await page.addStyleTag({ path: "src/pages/nav-v2/CosmicSceneHost.css" });

  const sizes = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(".cosmic-scene-frame")!;
    const anchor = document.querySelector<HTMLElement>(".cosmic-scene-slot")!;
    const page = document.getElementById("page")!;
    const readSize = () => {
      const { width, height } = frame.getBoundingClientRect();
      return [width, height];
    };
    const anchored = readSize();
    frame.style.setProperty("--cosmic-scene-retained-width", `${anchored[0]}px`);
    frame.style.setProperty("--cosmic-scene-retained-height", `${anchored[1]}px`);
    frame.dataset.retainedPaint = "true";

    // A sibling layout effect can force layout after slot cleanup and before
    // React commits data-active=false. That intermediate size must stay valid.
    anchor.removeAttribute("data-cosmic-scene-anchor");
    const releasing = readSize();
    frame.dataset.active = "false";
    const inactive = readSize();

    page.style.width = "500.25px";
    page.style.height = "739.375px";
    anchor.dataset.cosmicSceneAnchor = "true";
    frame.dataset.active = "true";
    const resized = readSize();
    return { anchored, releasing, inactive, resized };
  });

  expect(sizes.anchored).toEqual([412.1875, 974.1875]);
  expect(sizes.releasing).toEqual(sizes.anchored);
  expect(sizes.inactive).toEqual(sizes.anchored);
  expect(sizes.resized).toEqual([500.25, 739.375]);
});

for (const theme of ["paper", "ink", "oled"] as const) {
  test(`Android ${theme}: a mounted fullscreen shell owns the only edge backdrop`, async ({ page }) => {
    await primeZenflowV2(page, { clearStorage: true, language: "en", theme });
    await page.goto("?nav=v2");
    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

    // This tests the real stylesheet's platform and coverage conditions.
    // Native rendering cost is measured separately on the installed APK.
    const result = await page.evaluate(() => {
      const html = document.documentElement;
      const shell = document.querySelector<HTMLElement>('[data-testid="nav-v2-orchestrator"]')!;
      const root = document.getElementById("root")!;
      const read = () => ({
        documentImages: [html, document.body, root].map((e) => getComputedStyle(e).backgroundImage),
        shellImage: getComputedStyle(shell).backgroundImage,
      });
      const originalPlatform = html.dataset.platform;
      html.dataset.platform = "web";
      const web = read();
      html.dataset.platform = "android";
      const android = read();
      const originalPage = shell.dataset.activePage;
      shell.dataset.activePage = "settings";
      const translucentSettings = read();
      shell.dataset.activePage = originalPage;
      const marker = document.createComment("fullscreen-shell-position");
      shell.replaceWith(marker);
      const uncovered = read();
      marker.replaceWith(shell);
      const remounted = read();
      html.dataset.platform = originalPlatform;
      return { web, android, translucentSettings, uncovered, remounted };
    });

    expect(result.web.shellImage).toContain("gradient(");
    expect(result.android.documentImages).toEqual(["none", "none", "none"]);
    expect(result.android.shellImage).toBe(result.web.shellImage);
    expect(result.translucentSettings.documentImages).toEqual([
      "none", "none", result.web.documentImages[2],
    ]);
    expect(result.uncovered.documentImages).toEqual(result.web.documentImages);
    expect(result.uncovered.documentImages[0]).toContain("gradient(");
    expect(result.remounted).toEqual(result.android);
  });
}
