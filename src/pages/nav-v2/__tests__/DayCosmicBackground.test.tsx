import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DayCosmicBackground } from "../DayCosmicBackground";

const dayCosmicCss = readFileSync(
  resolve(process.cwd(), "src/pages/nav-v2/DayCosmicBackground.css"),
  "utf8"
);

describe("DayCosmicBackground", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.daymode;
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.daymode;
    vi.useRealTimers();
  });

  it("renders all 7 layers", () => {
    render(<DayCosmicBackground motionEnabled />);
    expect(screen.getByTestId("day-cosmic-background")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-base")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-bokeh")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-atmosphere")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-horizon-glow")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-light-curtain")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-sun-threads")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-god-rays")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-glass-depth")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-motes")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-paper-grain")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-vignette")).toBeInTheDocument();
  });

  it("renders exactly 35 dust motes", () => {
    const { container } = render(<DayCosmicBackground motionEnabled />);
    const motes = container.querySelectorAll(".day-cosmic__mote");
    expect(motes.length).toBe(35);
  });

  it("renders exactly 18 sun threads for the daylight stage", () => {
    const { container } = render(<DayCosmicBackground motionEnabled />);
    const threads = container.querySelectorAll(".day-cosmic__sun-thread");
    expect(threads.length).toBe(18);
  });

  it("sets local data-daymode based on current hour without mutating <html>", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T14:30:00")); // afternoon (14h)
    render(<DayCosmicBackground motionEnabled />);
    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-daymode",
      "afternoon"
    );
    expect(document.documentElement.dataset.daymode).toBeUndefined();
  });

  it.each([
    ["2026-06-15T00:00:00", "dawn"],
    ["2026-06-15T08:59:59", "dawn"],
    ["2026-06-15T09:00:00", "morning"],
    ["2026-06-15T11:59:59", "morning"],
    ["2026-06-15T12:00:00", "afternoon"],
    ["2026-06-15T16:59:59", "afternoon"],
    ["2026-06-15T17:00:00", "golden"],
    ["2026-06-15T18:59:59", "golden"],
    ["2026-06-15T19:00:00", "dusk"],
    ["2026-06-15T23:59:59", "dusk"],
  ])("maps the boundary time %s to daymode %s", (iso, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    render(<DayCosmicBackground motionEnabled />);
    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute("data-daymode", expected);
  });

  it("keeps the entry palette stable until the backdrop remounts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T08:59:59"));
    const { rerender } = render(
      <DayCosmicBackground presentation="settings" motionEnabled={false} />
    );

    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute("data-daymode", "dawn");

    vi.setSystemTime(new Date("2026-06-15T09:00:00"));
    rerender(<DayCosmicBackground presentation="settings" motionEnabled={false} />);

    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute("data-daymode", "dawn");
  });

  it("uses the explicit parent motion gate when enabled", () => {
    render(<DayCosmicBackground motionEnabled />);
    const motes = screen.getByTestId("day-cosmic-motes");
    const threads = screen.getByTestId("day-cosmic-sun-threads");
    expect(motes.getAttribute("data-animated")).toBe("true");
    expect(threads.getAttribute("data-animated")).toBe("true");
  });

  it("uses the explicit parent motion gate when disabled", () => {
    render(<DayCosmicBackground motionEnabled={false} />);
    const motes = screen.getByTestId("day-cosmic-motes");
    const threads = screen.getByTestId("day-cosmic-sun-threads");
    expect(motes.getAttribute("data-animated")).toBe("false");
    expect(threads.getAttribute("data-animated")).toBe("false");
  });

  it("animates only the approved quiet Settings subset while preserving density", () => {
    const { container } = render(<DayCosmicBackground presentation="settings" motionEnabled />);

    const root = screen.getByTestId("day-cosmic-background");
    expect(root).toHaveAttribute("data-presentation", "settings");
    expect(root).toHaveAttribute("data-animated", "true");
    expect(screen.getByTestId("day-cosmic-photon-field")).toHaveAttribute("data-animated", "true");
    expect(screen.getByTestId("day-cosmic-motes")).toHaveAttribute("data-animated", "true");
    expect(screen.getByTestId("day-cosmic-sun-threads")).toHaveAttribute("data-animated", "true");
    expect(screen.getByTestId("day-cosmic-light-curtain")).toHaveAttribute(
      "data-motion-emphasis",
      "primary"
    );
    expect(screen.getByTestId("day-cosmic-light-curtain")).toHaveAttribute(
      "data-motion-active",
      "true"
    );
    expect(screen.getByTestId("day-cosmic-light-curtain")).toHaveAttribute(
      "data-motion-id",
      "ambient-curtain"
    );
    expect(container.querySelectorAll(".day-cosmic__photon")).toHaveLength(26);
    expect(container.querySelectorAll(".day-cosmic__mote")).toHaveLength(12);
    expect(container.querySelectorAll(".day-cosmic__sun-thread")).toHaveLength(6);

    const activeIds = (selector: string) =>
      Array.from(container.querySelectorAll<HTMLElement>(selector))
        .filter((element) => element.dataset.motionActive === "true")
        .map((element) => element.dataset.motionId);

    expect(activeIds(".day-cosmic__photon")).toEqual([
      "0",
      "9",
      "12",
      "21",
      "33",
      "36",
      "45",
      "48",
      "57",
    ]);
    expect(activeIds(".day-cosmic__mote")).toEqual(["3", "12", "21", "27"]);
    expect(activeIds(".day-cosmic__sun-thread")).toEqual(["0", "3"]);

    const timings = (selector: string) =>
      Object.fromEntries(
        Array.from(container.querySelectorAll<HTMLElement>(selector))
          .filter((element) => element.dataset.motionActive === "true")
          .map((element) => [
            element.dataset.motionId,
            {
              delay: element.style.getPropertyValue("--settings-motion-delay"),
              duration: element.style.getPropertyValue("--settings-motion-duration"),
            },
          ])
      );

    expect(timings(".day-cosmic__photon")).toEqual({
      "0": { delay: "-14s", duration: "18s" },
      "9": { delay: "-16s", duration: "18s" },
      "12": { delay: "-4s", duration: "18s" },
      "21": { delay: "-10s", duration: "18s" },
      "33": { delay: "-2s", duration: "18s" },
      "36": { delay: "-8s", duration: "18s" },
      "45": { delay: "0s", duration: "18s" },
      "48": { delay: "-12s", duration: "18s" },
      "57": { delay: "-6s", duration: "18s" },
    });
    expect(timings(".day-cosmic__mote")).toEqual({
      "3": { delay: "-12s", duration: "24s" },
      "12": { delay: "0s", duration: "24s" },
      "21": { delay: "-6s", duration: "24s" },
      "27": { delay: "-18s", duration: "24s" },
    });
    expect(timings(".day-cosmic__sun-thread")).toEqual({
      "0": { delay: "-15s", duration: "30s" },
      "3": { delay: "0s", duration: "30s" },
    });
  });

  it("keeps every Settings decoration static when its effective motion gate is off", () => {
    const { container } = render(
      <DayCosmicBackground presentation="settings" motionEnabled={false} />
    );

    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute("data-animated", "false");
    expect(screen.getByTestId("day-cosmic-light-curtain")).not.toHaveAttribute(
      "data-motion-active"
    );
    expect(container.querySelectorAll('[data-motion-active="true"]')).toHaveLength(0);
  });

  it("root container is aria-hidden and pointer-events-none", () => {
    render(<DayCosmicBackground motionEnabled />);
    const root = screen.getByTestId("day-cosmic-background");
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root).toHaveAttribute("data-presentation", "orb");
    expect(root).toHaveAttribute("data-animated", "true");
    expect(root.className).toMatch(/pointer-events-none/);
    expect(root.className).toMatch(/day-cosmic/);
  });

  it("keeps expensive daylight layers paint-isolated for phone Chrome", () => {
    expect(dayCosmicCss).toContain(".day-cosmic {");
    expect(dayCosmicCss).toContain("contain: layout paint style");
    expect(dayCosmicCss).toContain(".day-cosmic__bokeh");
    expect(dayCosmicCss).toContain("contain: paint");
    expect(dayCosmicCss).toContain("will-change: transform, opacity");
    expect(dayCosmicCss).toContain("@media (max-width: 767px)");
    expect(dayCosmicCss).toContain(".orb-day-scope .orb-page-rim-glow > button");
    expect(dayCosmicCss).toContain("box-shadow: none");
  });

  it("retires every dynamic Android ambience layer only after the full-DPR renderer is ready", () => {
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="pending"] > .day-cosmic__light-curtain'
    );
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="pending"] > .day-cosmic__photon-field'
    );
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="ready"] > .day-cosmic__light-curtain'
    );
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="ready"] > .day-cosmic__sun-shower'
    );
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="ready"] > .day-cosmic__prism-ribbon'
    );
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="ready"] > .day-cosmic__caustics'
    );
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="ready"] > .day-cosmic__sun-threads'
    );
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="ready"] > .day-cosmic__photon-field'
    );
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-android-day-ambience="ready"] > .day-cosmic__motes'
    );
    expect(dayCosmicCss).not.toContain("day-cosmic__android-animated-surface");
    expect(dayCosmicCss).not.toContain("data-android-day-flourish-surface");
  });

  it("releases static full-screen promotion hints only after the Android renderer is ready", () => {
    expect(dayCosmicCss).toMatch(
      /\.day-cosmic\[data-android-day-ambience="ready"\] > \.day-cosmic__bokeh,\s*\.day-cosmic\[data-android-day-ambience="ready"\] > \.day-cosmic__horizon-glow\s*\{\s*will-change: auto;/
    );
    expect(dayCosmicCss).toMatch(
      /\.day-cosmic__bokeh,[\s\S]*?\.day-cosmic__horizon-glow,[\s\S]*?will-change: transform, opacity;/
    );
  });

  it("drops only the redundant Android caustic promotion hint", () => {
    expect(dayCosmicCss).toMatch(
      /:root\[data-platform="android"\] \.orb-day-flourish__caustic\s*\{\s*will-change:\s*auto\s*!important;\s*\}/
    );
    expect(dayCosmicCss).not.toMatch(
      /:root\[data-platform="android"\] \.orb-day-flourish__(?:prism|veil|glint|spark)\s*\{\s*will-change:\s*auto/
    );
    expect(dayCosmicCss).toContain("@keyframes orb-day-caustic-drift");
    expect(dayCosmicCss).toContain("filter: blur(0.45rem)");
    expect(dayCosmicCss).toContain("mix-blend-mode: multiply");
  });

  it("scopes the occluded global paper-grain release to the Android day Orb surface", () => {
    expect(dayCosmicCss).toContain(
      ':root[data-theme="paper"] body.android-day-orb-opaque-surface::before'
    );
    expect(dayCosmicCss).toMatch(
      /body\.android-day-orb-opaque-surface::before\s*\{\s*display: none;/
    );
    expect(dayCosmicCss).not.toContain(
      ':root[data-theme="paper"] body.android-day-orb-opaque-surface::after'
    );
  });

  it("limits Settings motion CSS to transform and opacity allowlists with stop fallbacks", () => {
    expect(dayCosmicCss).toContain(
      '.day-cosmic[data-presentation="settings"][data-animated="true"]'
    );
    expect(dayCosmicCss).toContain('[data-motion-active="true"]');
    expect(dayCosmicCss).toContain("@keyframes settings-day-photon-breathe");
    expect(dayCosmicCss).toContain("@keyframes settings-day-mote-drift");
    expect(dayCosmicCss).toContain("@keyframes settings-day-thread-breathe");
    expect(dayCosmicCss).toContain("@keyframes settings-day-ambient-drift");
    expect(dayCosmicCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(dayCosmicCss).toContain(":root[data-runtime-perf]");

    for (const name of [
      "settings-day-photon-breathe",
      "settings-day-mote-drift",
      "settings-day-thread-breathe",
      "settings-day-ambient-drift",
    ]) {
      const start = dayCosmicCss.indexOf(`@keyframes ${name}`);
      const end = dayCosmicCss.indexOf("\n}\n\n", start);
      const body = dayCosmicCss.slice(start, end === -1 ? undefined : end + 3);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      expect(body).toContain("transform:");
      expect(body).toContain("opacity:");
      expect(body).not.toContain("filter:");
      expect(body).not.toContain("background:");
      expect(body).not.toContain("box-shadow:");
    }

    const photonFrames = dayCosmicCss.slice(
      dayCosmicCss.indexOf("@keyframes settings-day-photon-breathe"),
      dayCosmicCss.indexOf("@keyframes settings-day-mote-drift")
    );
    expect(photonFrames).toContain("scale(0.96)");
    expect(photonFrames).toContain("scale(1.04)");
    expect(photonFrames).not.toMatch(/\n\s*50%\s*\{/);
    expect(photonFrames).not.toMatch(/0%,\s*100%/);
    expect(photonFrames).not.toMatch(/(?:[45]px|scale\((?:0\.8|1\.0[5-9]|1\.[1-9]))/);

    const moteFrames = dayCosmicCss.slice(
      dayCosmicCss.indexOf("@keyframes settings-day-mote-drift"),
      dayCosmicCss.indexOf("@keyframes settings-day-thread-breathe")
    );
    expect(moteFrames).toContain("var(--mote-opacity)");
    expect(moteFrames).toContain("scale(0.98)");
    expect(moteFrames).toContain("scale(1.03)");
    expect(moteFrames).not.toMatch(/\n\s*50%\s*\{/);
    expect(moteFrames).not.toMatch(/0%,\s*100%/);

    const threadFrames = dayCosmicCss.slice(
      dayCosmicCss.indexOf("@keyframes settings-day-thread-breathe"),
      dayCosmicCss.indexOf("@keyframes day-cosmic-curtain-breathe")
    );
    expect(threadFrames).toContain("scaleY(0.98)");
    expect(threadFrames).toContain("scaleY(1.02)");
    expect(threadFrames).not.toMatch(/\n\s*50%\s*\{/);
    expect(threadFrames).not.toMatch(/0%,\s*100%/);
    expect(dayCosmicCss).toMatch(
      /settings-day-photon-breathe[\s\S]*?cubic-bezier\(0\.4, 0, 0\.2, 1\)[\s\S]*?infinite alternate/
    );
  });

  it("keeps the reduced-motion CSS stop at least as specific as every Settings allowlist", () => {
    const reducedMotionBlock = dayCosmicCss.slice(
      dayCosmicCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
      dayCosmicCss.indexOf(
        "/* ==================== Layer 6",
        dayCosmicCss.lastIndexOf("@media (prefers-reduced-motion: reduce)")
      )
    );

    for (const className of ["day-cosmic__photon", "day-cosmic__mote", "day-cosmic__sun-thread"]) {
      expect(reducedMotionBlock).toContain(
        `.day-cosmic[data-presentation="settings"][data-animated="true"]\n    .${className}[data-motion-active="true"]`
      );
    }
    expect(reducedMotionBlock).toContain(
      '.day-cosmic__light-curtain[data-motion-emphasis="primary"][data-motion-active="true"]'
    );
  });

  it("paper grain is a static SVG with feTurbulence filter", () => {
    render(<DayCosmicBackground motionEnabled />);
    const grain = screen.getByTestId("day-cosmic-paper-grain");
    expect(grain.tagName.toLowerCase()).toBe("svg");
    // Static means no animation applied — filter exists, no <animate>
    expect(grain.querySelector("feTurbulence")).toBeTruthy();
    expect(grain.querySelector("animate")).toBeNull();
  });
});
