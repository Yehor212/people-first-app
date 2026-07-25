import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/features/journal/JournalHubShell.tsx", "utf8");

describe("JournalHubShell text reflow contract", () => {
  it("uses the scalable typography system and keeps meaningful hub copy available", () => {
    for (const fixedSize of ["text-[9px]", "text-[10px]", "text-[11px]"]) {
      expect(source).not.toContain(fixedSize);
    }

    expect(source).not.toContain("truncate");
    expect(source).not.toContain("line-clamp");
  });

  it("gives headings, metrics, cards, and practices a one-column narrow-width reflow", () => {
    expect(source).toContain("flex flex-col items-stretch gap-3 min-[420px]:flex-row");
    expect(source).toContain("grid-cols-1 gap-2 min-[420px]:grid-cols-3");
    expect(source).toContain("grid-cols-1 gap-2 min-[420px]:grid-cols-2");
    expect(source).toContain("whitespace-normal break-words");
  });

  it("keeps the practice-scene heading readable beside fixed-size controls", () => {
    expect(source).toContain("grid-cols-[44px_minmax(0,1fr)_44px]");
    expect(source).toContain("col-span-3 row-start-2");
    expect(source).toContain("min-[420px]:col-span-1");
  });

  it("keeps all mobile navigation labels visible and reachable at narrow widths", () => {
    const dock = /function HubDock[\s\S]*?function CustomizationSheet/.exec(source)?.[0] ?? "";

    expect(dock).toContain("grid-cols-2");
    expect(dock).toContain("min-[420px]:grid-cols-5");
    expect(dock).toContain("max-h-[42dvh]");
    expect(dock).toContain("overflow-y-auto overscroll-contain");
    expect(dock).toContain("whitespace-normal break-words text-center");
    expect(dock).not.toContain("truncate");
  });

  it("bounds the capture actions and settings controls without hiding translated labels", () => {
    const capture = /function CaptureFan[\s\S]*?function HubDock/.exec(source)?.[0] ?? "";
    const customization = /function CustomizationSheet[\s\S]*$/.exec(source)?.[0] ?? "";

    expect(source).toContain("dockCollapsed={dockCollapsed}");
    expect(capture).toContain("top-[max(0.75rem,var(--safe-top))]");
    expect(capture).toContain("max-h-full");
    expect(capture).toContain("overflow-y-auto overscroll-contain");
    expect(capture).toContain("whitespace-normal break-words");
    expect(capture).toContain("dockCollapsed");
    expect(customization).toContain("grid-cols-1 gap-2 min-[420px]:grid-cols-2");
    expect(customization).toContain("grid-cols-1 gap-2 min-[420px]:grid-cols-3");
  });

  it("uses shared logical safe-area tokens for LTR and RTL instead of raw environment insets", () => {
    for (const token of [
      "var(--safe-inline-start)",
      "var(--safe-inline-end)",
      "var(--safe-top)",
      "var(--safe-bottom)",
      "var(--app-viewport-height)",
    ]) {
      expect(source).toContain(token);
    }
    expect(source).not.toContain("env(safe-area-inset");
  });
});
