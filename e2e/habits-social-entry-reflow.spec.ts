import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  primeZenflowV2,
  v2RoutePath,
  type ZenflowV2Language,
} from "./helpers/zenflowV2State";

const LOCALES: ZenflowV2Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const RTL_LOCALES = new Set<ZenflowV2Language>(["ar", "he"]);
const TEXT_SCALES = process.env.ZENFLOW_SOCIAL_TEXT_SCALE === "100"
  ? ([1] as const)
  : ([1, 2] as const);
const OUTPUT_DIR = path.resolve("output/android21/t154-social-entry-reflow");

async function captureEvidence(
  page: Page,
  options: NonNullable<Parameters<Page["screenshot"]>[0]>,
): Promise<void> {
  try {
    await page.screenshot(options);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Page.captureScreenshot") || !message.includes("Unable to capture")) {
      throw error;
    }
    console.warn(`[visual-evidence] Retrying one failed Chromium capture: ${String(options.path)}`);
  }

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await page.waitForTimeout(100);
  await page.screenshot(options);
}

test.describe("Habits social entry reflow", () => {
  test.setTimeout(300_000);

  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  for (const locale of LOCALES) {
    test(`${locale} keeps the connected entry and exit usable at 320px and 100/200% text`, async ({
      browser,
    }) => {
      const receipt: Array<Record<string, unknown>> = [];

      for (const textScale of TEXT_SCALES) {
      const direction = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
      const context = await browser.newContext({
        colorScheme: direction === "rtl" ? "dark" : "light",
        hasTouch: true,
        isMobile: true,
        reducedMotion: "reduce",
        viewport: { width: 320, height: 568 },
      });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      try {
        await primeZenflowV2(page, {
          clearStorage: true,
          language: locale,
          privacyNoTracking: true,
          theme: direction === "rtl" ? "ink" : "paper",
        });
        await page.addInitScript(() => {
          const today = new Date().toISOString().split("T")[0];
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 14);
          localStorage.setItem(
            "zenflow_onboarding_state",
            JSON.stringify({
              daysActive: 5,
              firstLoginDate: Date.now() - 5 * 24 * 60 * 60 * 1000,
              hasSeenWelcome: true,
              isNewUser: false,
              lastActiveDate: today,
              unlockedFeatures: [
                "mood",
                "habits",
                "focusTimer",
                "xp",
                "quests",
                "companion",
                "tasks",
                "challenges",
              ],
            }),
          );
          localStorage.setItem(
            "zenflow_challenges",
            JSON.stringify([
              {
                code: "ZEN-ABC123",
                creatorName: "Avery",
                duration: 14,
                endDate: endDate.toISOString().split("T")[0],
                habitIcon: "🌿",
                habitName: "Morning walk",
                id: "social-reflow-challenge",
                isCreator: true,
                myProgress: 4,
                startDate: today,
                status: "active",
              },
            ]),
          );
        });

        await page.goto(v2RoutePath("habits", { layout: "phone" }));
        const pageRoot = page.getByTestId("habits-page");
        const action = page.getByTestId("habits-friend-challenges-action");
        await expect(pageRoot).toBeVisible({ timeout: 20_000 });
        await expect(action).toBeVisible({ timeout: 20_000 });
        const baselineFontSize = await page.evaluate(() =>
          Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        );
        await page.evaluate(({ fontSize, textScale }) => {
          document.documentElement.style.setProperty(
            "font-size",
            `${fontSize * textScale}px`,
            "important",
          );
        }, { fontSize: baselineFontSize, textScale });
        await expect
          .poll(() =>
            page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
          )
          .toBe(`${baselineFontSize * textScale}px`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", direction);

        const entryFacts = await action.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const primaryLabel = element.querySelector<HTMLElement>(
            '[data-social-entry-label="primary"]',
          );
          const primaryRange = document.createRange();
          if (primaryLabel) primaryRange.selectNodeContents(primaryLabel);
          const primaryLineWidths = primaryLabel
            ? Array.from(primaryRange.getClientRects())
                .map((lineRect) => lineRect.width)
                .filter((width) => width > 0)
                .sort((left, right) => left - right)
            : [];
          const primaryFontSize = primaryLabel
            ? Number.parseFloat(getComputedStyle(primaryLabel).fontSize)
            : 0;
          const medianPrimaryLineWidth =
            primaryLineWidths[Math.floor(primaryLineWidths.length / 2)] ?? 0;
          const textOutside: string[] = [];
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node) {
            if (node.textContent?.trim()) {
              const range = document.createRange();
              range.selectNodeContents(node);
              if (
                Array.from(range.getClientRects()).some(
                  (textRect) =>
                    textRect.left < rect.left - 0.75 ||
                    textRect.right > rect.right + 0.75 ||
                    textRect.top < rect.top - 0.75 ||
                    textRect.bottom > rect.bottom + 0.75,
                )
              ) {
                textOutside.push(node.textContent.trim());
              }
            }
            node = walker.nextNode();
          }

          return {
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              document.body.scrollWidth - document.documentElement.clientWidth,
            ),
            height: rect.height,
            primaryLineMeasureEm:
              primaryFontSize > 0 ? medianPrimaryLineWidth / primaryFontSize : 0,
            rootFontSize: getComputedStyle(document.documentElement).fontSize,
            textOutside,
            width: rect.width,
            withinViewport: rect.left >= -0.75 && rect.right <= window.innerWidth + 0.75,
          };
        });

        expect(entryFacts.rootFontSize).toBe(`${baselineFontSize * textScale}px`);
        expect(entryFacts.documentOverflow).toBe(0);
        expect(entryFacts.withinViewport).toBe(true);
        expect(entryFacts.width).toBeGreaterThanOrEqual(44);
        expect(entryFacts.height).toBeGreaterThanOrEqual(44);
        expect(entryFacts.height).toBeLessThanOrEqual(320);
        expect(entryFacts.primaryLineMeasureEm).toBeGreaterThanOrEqual(2);
        expect(entryFacts.textOutside).toEqual([]);

        const habitTextFacts = await pageRoot.evaluate((root) => {
          const clippedText: Array<{ owner: string; text: string }> = [];
          const clippedMeta: Array<{ owner: string; text: string }> = [];
          const splitWords: Array<{ owner: string; text: string; word: string }> = [];
          const labels = root.querySelectorAll<HTMLElement>(
            '[data-slot="quickpick-label"], [data-testid="habits-hero-create-empty"] > span, [data-testid="hero-empty-open-library"] > span',
          );

          for (const label of labels) {
            const owner = label.closest<HTMLElement>("button");
            if (!owner || !label.textContent?.trim()) continue;
            const ownerRect = owner.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(label);
            const lineRects = Array.from(range.getClientRects());
            const outside = lineRects.some(
              (textRect) =>
                textRect.left < ownerRect.left - 0.75 ||
                textRect.right > ownerRect.right + 0.75 ||
                textRect.top < ownerRect.top - 0.75 ||
                textRect.bottom > ownerRect.bottom + 0.75,
            );
            if (outside) {
              clippedText.push({
                owner: owner.dataset.testid ?? owner.getAttribute("aria-label") ?? "button",
                text: label.textContent.trim(),
              });
            }
            for (const node of Array.from(label.childNodes)) {
              if (node.nodeType !== Node.TEXT_NODE || !node.textContent) continue;
              for (const match of node.textContent.matchAll(/[\p{Script=Latin}\p{Script=Cyrillic}’']{4,}/gu)) {
                if (match.index === undefined) continue;
                const wordRange = document.createRange();
                wordRange.setStart(node, match.index);
                wordRange.setEnd(node, match.index + match[0].length);
                if (wordRange.getClientRects().length > 1) {
                  splitWords.push({
                    owner: owner.dataset.testid ?? owner.getAttribute("aria-label") ?? "button",
                    text: label.textContent.trim(),
                    word: match[0],
                  });
                }
              }
            }
          }

          for (const meta of root.querySelectorAll<HTMLElement>('[data-slot="quickpick-meta"]')) {
            const owner = meta.closest<HTMLElement>("button");
            if (!owner) continue;
            const ownerRect = owner.getBoundingClientRect();
            const metaRect = meta.getBoundingClientRect();
            if (
              metaRect.left < ownerRect.left - 0.75 ||
              metaRect.right > ownerRect.right + 0.75 ||
              metaRect.top < ownerRect.top - 0.75 ||
              metaRect.bottom > ownerRect.bottom + 0.75
            ) {
              clippedMeta.push({
                owner: owner.dataset.testid ?? owner.getAttribute("aria-label") ?? "button",
                text: meta.textContent?.trim() ?? "",
              });
            }
          }

          return { clippedMeta, clippedText, splitWords };
        });
        expect(habitTextFacts.clippedMeta).toEqual([]);
        expect(habitTextFacts.clippedText).toEqual([]);
        expect(habitTextFacts.splitWords).toEqual([]);

        await captureEvidence(page, {
          path: path.join(OUTPUT_DIR, `${locale}-habits-entry-320x568-${textScale * 100}.png`),
          scale: "css",
        });

        await action.click();
        const dialog = page.getByTestId("challenge-modal");
        await expect(dialog).toBeVisible({ timeout: 20_000 });
        const socialTabFacts = await dialog
          .locator(
            '[data-testid="social-hub-challenges-tab"], [data-testid="social-hub-friends-tab"]',
          )
          .evaluateAll((tabs) => {
            const splitWords: Array<{ tab: string; word: string }> = [];

            for (const tab of tabs) {
              const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
              let node = walker.nextNode();
              while (node) {
                if (node.textContent) {
                  for (const match of node.textContent.matchAll(
                    /[\p{Script=Latin}\p{Script=Cyrillic}’']{4,}/gu,
                  )) {
                    if (match.index === undefined) continue;
                    const wordRange = document.createRange();
                    wordRange.setStart(node, match.index);
                    wordRange.setEnd(node, match.index + match[0].length);
                    if (wordRange.getClientRects().length > 1) {
                      splitWords.push({
                        tab:
                          (tab as HTMLElement).dataset.testid ??
                          tab.textContent?.trim() ??
                          "tab",
                        word: match[0],
                      });
                    }
                  }
                }
                node = walker.nextNode();
              }
            }

            return { splitWords };
          });
        expect(socialTabFacts.splitWords).toEqual([]);
        const dialogFacts = await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const title = element.querySelector<HTMLElement>("h2:not(.sr-only)");
          const header = title?.parentElement?.parentElement?.parentElement;
          const body = header?.nextElementSibling;
          const titleRange = document.createRange();
          if (title) titleRange.selectNodeContents(title);
          const titleRects = title ? Array.from(titleRange.getClientRects()) : [];
          const titleLineWidths = title
            ? titleRects
                .map((lineRect) => lineRect.width)
                .filter((width) => width > 0)
                .sort((left, right) => left - right)
            : [];
          const titleFontSize = title
            ? Number.parseFloat(getComputedStyle(title).fontSize)
            : 0;
          const medianTitleLineWidth =
            titleLineWidths[Math.floor(titleLineWidths.length / 2)] ?? 0;
          const minimumTitleLineWidth = titleLineWidths[0] ?? 0;
          return {
            bodyClientHeight: body instanceof HTMLElement ? body.clientHeight : null,
            bottomReachable: rect.bottom <= window.innerHeight + 0.75,
            headerContentFits:
              header instanceof HTMLElement &&
              header.scrollHeight <= header.clientHeight + 0.75,
            headerClientHeight:
              header instanceof HTMLElement ? header.clientHeight : null,
            headerScrollHeight:
              header instanceof HTMLElement ? header.scrollHeight : null,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            titleInsideDialog:
              titleRects.length > 0 &&
              titleRects.every(
                (titleRect) =>
                  titleRect.top >= rect.top - 0.75 &&
                  titleRect.bottom <= rect.bottom + 0.75 &&
                  titleRect.left >= rect.left - 0.75 &&
                  titleRect.right <= rect.right + 0.75,
              ),
            titleLineMeasureEm:
              titleFontSize > 0 ? medianTitleLineWidth / titleFontSize : 0,
            titleMinimumLineMeasureEm:
              titleFontSize > 0 ? minimumTitleLineWidth / titleFontSize : 0,
            width: rect.width,
          };
        });
        expect(dialogFacts.left).toBeGreaterThanOrEqual(-0.75);
        expect(dialogFacts.right).toBeLessThanOrEqual(320.75);
        expect(dialogFacts.top).toBeGreaterThanOrEqual(15.25);
        expect(dialogFacts.width).toBeGreaterThanOrEqual(288);
        expect(dialogFacts.bodyClientHeight).toBeGreaterThanOrEqual(176);
        expect(dialogFacts.headerContentFits, JSON.stringify(dialogFacts)).toBe(true);
        expect(dialogFacts.titleInsideDialog).toBe(true);
        expect(dialogFacts.titleLineMeasureEm).toBeGreaterThanOrEqual(2);
        expect(dialogFacts.titleMinimumLineMeasureEm).toBeGreaterThanOrEqual(1.5);
        expect(dialogFacts.bottomReachable).toBe(true);

        await captureEvidence(page, {
          path: path.join(OUTPUT_DIR, `${locale}-challenges-dialog-320x568-${textScale * 100}.png`),
          scale: "css",
        });

        await page.getByTestId("social-hub-friends-tab").click();
        await expect(dialog).toBeHidden();
        const friendsPanel = page.getByTestId("friends-panel");
        await expect(friendsPanel).toBeVisible();
        const friendsFacts = await friendsPanel.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const controls = Array.from(
            element.querySelectorAll<HTMLElement>("button, input"),
          ).map((control) => {
            const controlRect = control.getBoundingClientRect();
            return {
              height: controlRect.height,
              label:
                control.getAttribute("aria-label") ||
                control.textContent?.trim() ||
                control.getAttribute("data-testid") ||
                control.tagName,
              width: controlRect.width,
            };
          });
          const outsideText: string[] = [];
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node) {
            if (node.textContent?.trim()) {
              const range = document.createRange();
              range.selectNodeContents(node);
              if (
                Array.from(range.getClientRects()).some(
                  (textRect) =>
                    textRect.left < rect.left - 0.75 ||
                    textRect.right > rect.right + 0.75,
                )
              ) {
                outsideText.push(node.textContent.trim());
              }
            }
            node = walker.nextNode();
          }
          return {
            bottom: rect.bottom,
            controls,
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              document.body.scrollWidth - document.documentElement.clientWidth,
            ),
            left: rect.left,
            outsideText,
            right: rect.right,
            top: rect.top,
          };
        });
        expect(friendsFacts.documentOverflow).toBe(0);
        expect(friendsFacts.left).toBeGreaterThanOrEqual(-0.75);
        expect(friendsFacts.right).toBeLessThanOrEqual(320.75);
        expect(friendsFacts.top).toBeGreaterThanOrEqual(-0.75);
        expect(friendsFacts.bottom).toBeLessThanOrEqual(568.75);
        expect(friendsFacts.outsideText).toEqual([]);
        for (const control of friendsFacts.controls) {
          expect(
            control.height >= 44 || control.width >= 44,
            `${locale}/${textScale * 100}%: undersized ${control.label}`,
          ).toBe(true);
        }

        await captureEvidence(page, {
          path: path.join(OUTPUT_DIR, `${locale}-friends-panel-320x568-${textScale * 100}.png`),
          scale: "css",
        });

        const friendsScrollCapacity = await friendsPanel.evaluate((element) => ({
          clientHeight: element.clientHeight,
          maxScrollTop: element.scrollHeight - element.clientHeight,
          scrollHeight: element.scrollHeight,
        }));
        expect(friendsScrollCapacity.maxScrollTop).toBeGreaterThan(0);
        const finalFriendsAction = friendsPanel.locator("button").last();
        await finalFriendsAction.scrollIntoViewIfNeeded();
        await expect(finalFriendsAction).toBeInViewport();
        const friendsScrollFacts = await friendsPanel.evaluate((element) => ({
          clientHeight: element.clientHeight,
          maxScrollTop: element.scrollHeight - element.clientHeight,
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop,
        }));
        await captureEvidence(page, {
          path: path.join(
            OUTPUT_DIR,
            `${locale}-friends-panel-bottom-320x568-${textScale * 100}.png`,
          ),
          scale: "css",
        });

        await page.getByTestId("friends-add-by-code").click();
        const friendCodeInput = friendsPanel.locator('input[placeholder="ZF-XXXXXXXX"]');
        await expect(friendCodeInput).toBeVisible();
        await friendCodeInput.fill("ZF-ABC");
        await page.setViewportSize({ width: 320, height: 360 });
        await friendCodeInput.focus();
        await page.waitForTimeout(350);
        const friendsImeFacts = await friendCodeInput.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            active: document.activeElement === element,
            bottom: rect.bottom,
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              document.body.scrollWidth - document.documentElement.clientWidth,
            ),
            left: rect.left,
            right: rect.right,
            top: rect.top,
          };
        });
        expect(friendsImeFacts.active).toBe(true);
        expect(friendsImeFacts.documentOverflow).toBe(0);
        expect(friendsImeFacts.left).toBeGreaterThanOrEqual(-0.75);
        expect(friendsImeFacts.right).toBeLessThanOrEqual(320.75);
        expect(friendsImeFacts.top).toBeGreaterThanOrEqual(-0.75);
        expect(friendsImeFacts.bottom).toBeLessThanOrEqual(360.75);
        await captureEvidence(page, {
          path: path.join(
            OUTPUT_DIR,
            `${locale}-friends-ime-resize-320x360-${textScale * 100}.png`,
          ),
          scale: "css",
        });
        await page.setViewportSize({ width: 320, height: 568 });
        await friendCodeInput.locator("..").getByRole("button").click();
        await expect(friendCodeInput).toBeHidden();

        await page.getByTestId("social-hub-challenges-tab").click();
        await expect(friendsPanel).toBeHidden();
        await expect(dialog).toBeVisible();

        await page.getByTestId("social-hub-friends-tab").click();
        await expect(friendsPanel).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(friendsPanel).toBeHidden();

        await action.click();
        await expect(dialog).toBeVisible();
        const challengeCard = dialog.getByRole("button", {
          name: "Morning walk — active",
        });
        await expect(challengeCard).toBeVisible();
        await challengeCard.click();
        const challengeDetails = dialog.locator(".space-y-6.pb-8");
        const reducedMotionEntryFacts = await challengeDetails.evaluate((element) => ({
          childOpacities: Array.from(element.children).map(
            (child) => getComputedStyle(child).opacity,
          ),
        }));
        expect(
          reducedMotionEntryFacts.childOpacities.every(
            (opacity) => Number.parseFloat(opacity) === 1,
          ),
          JSON.stringify(reducedMotionEntryFacts),
        ).toBe(true);
        await expect(dialog.getByText("Morning walk", { exact: true })).toBeVisible();
        await captureEvidence(page, {
          path: path.join(
            OUTPUT_DIR,
            `${locale}-challenge-details-320x568-${textScale * 100}.png`,
          ),
          scale: "css",
        });

        const personalProgress = dialog.getByTestId("challenge-personal-progress");
        const participants = dialog.getByTestId("challenge-participants");
        const invitationControls = dialog.getByTestId("challenge-invitation-controls");
        await expect(personalProgress).toBeAttached();
        await expect(participants).toBeAttached();
        await expect(invitationControls).toBeAttached();
        const challengeSectionOrder = await dialog.evaluate((element) => {
          const progress = element.querySelector('[data-testid="challenge-personal-progress"]');
          const participantTable = element.querySelector('[data-testid="challenge-participants"]');
          const invitation = element.querySelector('[data-testid="challenge-invitation-controls"]');
          if (!progress || !participantTable || !invitation) return null;
          return {
            participantsAfterProgress: Boolean(
              progress.compareDocumentPosition(participantTable) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
            invitationAfterParticipants: Boolean(
              participantTable.compareDocumentPosition(invitation) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          };
        });
        expect(challengeSectionOrder).toEqual({
          invitationAfterParticipants: true,
          participantsAfterProgress: true,
        });
        await participants.scrollIntoViewIfNeeded();
        await expect(participants).toBeInViewport();
        await captureEvidence(page, {
          path: path.join(
            OUTPUT_DIR,
            `${locale}-challenge-participants-320x568-${textScale * 100}.png`,
          ),
          scale: "css",
        });
        await invitationControls.scrollIntoViewIfNeeded();
        await expect(invitationControls).toBeInViewport();
        const challengeCode = invitationControls.getByText("ZEN-ABC123", { exact: true });
        const challengeCodeFacts = await challengeCode.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return {
            direction: getComputedStyle(element).direction,
            lineCount: Array.from(range.getClientRects()).filter(
              (rect) => rect.width > 0 && rect.height > 0,
            ).length,
          };
        });
        expect(challengeCodeFacts.direction).toBe("ltr");
        expect(challengeCodeFacts.lineCount).toBe(1);
        await captureEvidence(page, {
          path: path.join(
            OUTPUT_DIR,
            `${locale}-challenge-invitation-controls-320x568-${textScale * 100}.png`,
          ),
          scale: "css",
        });

        const visibleDetailsBack = dialog.getByTestId("challenge-modal-back");
        await expect(visibleDetailsBack).toBeVisible();
        await visibleDetailsBack.click();
        await expect(challengeCard).toBeVisible();

        await challengeCard.click();
        await page.keyboard.press("Escape");
        await expect(challengeCard).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();

        receipt.push({
          direction,
          dialogFacts,
          entryFacts,
          friendsFacts,
          friendsImeFacts,
          friendsScrollFacts,
          habitTextFacts,
          locale,
          pageErrors,
          challengeSectionOrder,
          challengeCodeFacts,
          reducedMotionEntryFacts,
          textScalePercent: textScale * 100,
        });
        expect(pageErrors).toEqual([]);
      } finally {
        await context.close();
      }
      }

      writeFileSync(
        path.join(OUTPUT_DIR, `browser-matrix-${locale}.json`),
        `${JSON.stringify({ capturedAt: new Date().toISOString(), receipt }, null, 2)}\n`,
        "utf8",
      );
      expect(receipt).toHaveLength(TEXT_SCALES.length);
    });
  }
});
