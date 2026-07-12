import { expect, test } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

test("responsive resize waits for the replacement worker canvas", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    class DelayedWorker extends NativeWorker {
      private delayedMessageHandler: ((event: MessageEvent) => void) | null = null;

      override set onmessage(handler: ((this: Worker, event: MessageEvent) => unknown) | null) {
        this.delayedMessageHandler = handler
          ? (event) => window.setTimeout(() => handler.call(this, event), 450)
          : null;
        super.onmessage = this.delayedMessageHandler;
      }

      override get onmessage() {
        return this.delayedMessageHandler;
      }
    }
    Object.defineProperty(window, "Worker", { configurable: true, value: DelayedWorker });
  });

  await page.setViewportSize({ width: 1024, height: 900 });
  await primeZenflowV2(page, {
    language: "en",
    theme: "paper",
    user: { id: "orb-resize-readiness", name: "Orb Resize Proof" },
  });

  const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
  route.searchParams.set("orbRenderer", "webgl");
  await page.goto(`${route.pathname.slice(1)}${route.search}`, {
    waitUntil: "domcontentloaded",
  });

  const orbPage = page.getByTestId("orb-page");
  const hero = page.getByTestId("orb-page-hero");
  await expect(orbPage).toHaveAttribute("data-orb-visual-status", "ready", {
    timeout: 30_000,
  });
  const initialCanvas = hero.locator("canvas[data-orb-visual-ready='true']").first();
  await expect(initialCanvas).toBeVisible();
  const initialCanvasHandle = await initialCanvas.elementHandle();

  await page.evaluate(() => {
    const win = window as typeof window & {
      __orbResizeProof?: {
        observer: MutationObserver;
        sawLoading: boolean;
        sawPendingInert: boolean;
        statuses: string[];
      };
    };
    const proof = {
      observer: null as unknown as MutationObserver,
      sawLoading: false,
      sawPendingInert: false,
      statuses: [] as string[],
    };
    const sample = () => {
      const main = document.querySelector<HTMLElement>("[data-testid='orb-page']");
      const status = main?.dataset.orbVisualStatus ?? "missing";
      if (proof.statuses.at(-1) !== status) proof.statuses.push(status);
      if (status === "pending" && main?.hasAttribute("inert")) {
        proof.sawPendingInert = true;
      }
      if (document.querySelector("[data-testid='orb-page-loading']")) {
        proof.sawLoading = true;
      }
    };
    proof.observer = new MutationObserver(sample);
    proof.observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    sample();
    win.__orbResizeProof = proof;
  });

  await page.setViewportSize({ width: 1024, height: 760 });
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __orbResizeProof?: { sawPendingInert: boolean } }
  ).__orbResizeProof?.sawPendingInert ?? false)).toBe(true);
  await expect(orbPage).toHaveAttribute("data-orb-visual-status", "ready", {
    timeout: 30_000,
  });
  const resizeProof = await page.evaluate(() => {
    const proof = (
      window as typeof window & {
        __orbResizeProof?: {
          observer: MutationObserver;
          sawLoading: boolean;
          sawPendingInert: boolean;
          statuses: string[];
        };
      }
    ).__orbResizeProof;
    proof?.observer.disconnect();
    return proof
      ? {
          sawLoading: proof.sawLoading,
          sawPendingInert: proof.sawPendingInert,
          statuses: proof.statuses,
        }
      : null;
  });
  expect(resizeProof).toMatchObject({
    sawLoading: true,
    sawPendingInert: true,
    statuses: ["ready", "pending", "ready"],
  });
  const replacementCanvas = hero.locator("canvas[data-orb-visual-ready='true']").first();
  await expect(replacementCanvas).toBeVisible();
  const replacementCanvasHandle = await replacementCanvas.elementHandle();
  expect(await replacementCanvasHandle!.evaluate((node, previous) => node !== previous, initialCanvasHandle))
    .toBe(true);
  expect(await initialCanvasHandle!.evaluate((node) => node.isConnected)).toBe(false);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
