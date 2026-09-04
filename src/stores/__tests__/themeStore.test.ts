import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_CUSTOMIZATION } from "../themeCustomization";

const STORAGE_KEY = "zenflow:theme-v0c";
const statusBarMock = vi.hoisted(() => ({
  setStyle: vi.fn(() => Promise.resolve()),
}));
const platformMock = vi.hoisted(() => ({
  isNative: true,
  isAndroid: true,
}));

function fireOpacityTransitionEnd(target: HTMLElement): void {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: "opacity" });
  target.dispatchEvent(event);
}

vi.mock("@/lib/platform", () => platformMock);
vi.mock("@/lib/statusBarStyle", () => ({
  StatusBarStyle: statusBarMock,
  Style: { Dark: "DARK", Light: "LIGHT", Default: "DEFAULT" },
}));

async function loadStore(prefersDark = false) {
  vi.resetModules();
  const mql = {
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn(() => mql),
    configurable: true,
    writable: true,
  });
  const mod = await import("../themeStore");
  return { mod, mql };
}

describe("themeStore Variant A", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themeAccent;
    delete document.documentElement.dataset.themeContrast;
    document.documentElement.classList.remove("dark", "oled");
    document.documentElement.style.setProperty("--background", "165 22% 96%");
    document.querySelectorAll("[data-theme-transition-veil]").forEach((node) => node.remove());
    statusBarMock.setStyle.mockClear();
    platformMock.isNative = true;
    platformMock.isAndroid = true;
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove("dark", "oled");
    document.documentElement.style.removeProperty("--background");
    document.querySelectorAll("[data-theme-transition-veil]").forEach((node) => node.remove());
    localStorage.clear();
  });

  it("defaults to System with Paper resolved on a light OS", async () => {
    const { mod } = await loadStore(false);
    expect(mod.useThemeStore.getState()).toMatchObject({
      theme: "auto",
      appliedTheme: "paper",
      themeCustomization: DEFAULT_THEME_CUSTOMIZATION,
    });
    expect(document.documentElement.dataset.theme).toBe("paper");
  });

  it.each([
    ["light", "false", "paper"],
    ["dark", "false", "ink"],
    ["system", "false", "auto"],
    ["dark", "true", "oled"],
  ] as const)(
    "migrates a legacy-only %s preference with OLED=%s before first paint",
    async (legacyTheme, legacyOled, expectedTheme) => {
      localStorage.setItem("zenflow-theme", legacyTheme);
      localStorage.setItem("zenflow_oled_mode", legacyOled);

      const { mod } = await loadStore(false);

      expect(mod.useThemeStore.getState().theme).toBe(expectedTheme);
      expect(document.documentElement.dataset.theme).toBe(
        expectedTheme === "auto" ? "paper" : expectedTheme,
      );
    },
  );

  it.each([
    ["light", false, "paper", "paper"],
    ["system", false, "auto", "paper"],
    ["system", true, "oled", "oled"],
    ["not-a-theme", false, "auto", "paper"],
  ] as const)(
    "preserves the effective legacy appearance for %s + OLED on a %s OS",
    async (legacyTheme, prefersDark, expectedTheme, expectedAppliedTheme) => {
      localStorage.setItem("zenflow-theme", legacyTheme);
      localStorage.setItem("zenflow_oled_mode", "true");

      const { mod } = await loadStore(prefersDark);

      expect(mod.useThemeStore.getState()).toMatchObject({
        theme: expectedTheme,
        appliedTheme: expectedAppliedTheme,
      });
      expect(document.documentElement.dataset.theme).toBe(expectedAppliedTheme);
    },
  );

  it("keeps a valid canonical preference ahead of conflicting legacy keys", async () => {
    localStorage.setItem("zenflow-theme", "dark");
    localStorage.setItem("zenflow_oled_mode", "true");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { theme: "paper" }, version: 1 }),
    );

    const { mod } = await loadStore(true);

    expect(mod.useThemeStore.getState().theme).toBe("paper");
    expect(document.documentElement.dataset.theme).toBe("paper");
    expect(document.documentElement).not.toHaveClass("dark", "oled");
  });

  it("resolves System to Ink on a dark-preferring OS", async () => {
    const { mod } = await loadStore(true);
    expect(mod.useThemeStore.getState().appliedTheme).toBe("ink");
    expect(document.documentElement.dataset.theme).toBe("ink");
  });

  it("migrates the persisted v0 customization before first paint", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          theme: "ink",
          themeCustomization: {
            paletteId: "velvetLibrary",
            accentFamily: "plum",
            contrastMode: "high",
            reduceTransparency: false,
          },
        },
        version: 0,
      }),
    );

    const { mod } = await loadStore(false);
    expect(mod.useThemeStore.getState()).toMatchObject({
      theme: "ink",
      appliedTheme: "ink",
      themeCustomization: {
        schemaVersion: 1,
        accentFamily: "violet",
        highContrast: true,
      },
    });
    expect(document.documentElement.dataset.themeAccent).toBe("violet");
    expect(document.documentElement.dataset.themeContrast).toBe("high");
  });

  it("persists the request immediately and commits the applied palette only at fade-through midpoint", async () => {
    const { mod } = await loadStore(false);
    const result = mod.useThemeStore.getState().setTheme("oled");

    expect(result).toEqual({ ok: true, changed: true });
    expect(mod.useThemeStore.getState()).toMatchObject({ theme: "oled", appliedTheme: "paper" });
    expect(document.documentElement.dataset.theme).toBe("paper");
    expect(localStorage.getItem("zenflow-theme")).toBe("dark");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").state.theme).toBe("oled");

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const veil = document.querySelector<HTMLElement>("[data-theme-transition-veil]");
    expect(veil).toHaveAttribute("data-theme-transition-phase", "enter");
    fireOpacityTransitionEnd(veil!);

    expect(mod.useThemeStore.getState()).toMatchObject({ theme: "oled", appliedTheme: "oled" });
    expect(document.documentElement.dataset.theme).toBe("oled");
    expect(document.documentElement).toHaveClass("dark", "oled");
  });

  it("publishes fixed-contrast native status-bar style after the updated interface crosses two frames", async () => {
    const queuedFrames: Array<{ id: number; callback: FrameRequestCallback }> = [];
    const cancelledFrames = new Set<number>();
    let nextFrameId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = ++nextFrameId;
      queuedFrames.push({ id, callback });
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      cancelledFrames.add(id);
    });
    const flushFrame = () => {
      const frame = queuedFrames.shift();
      if (!frame || cancelledFrames.delete(frame.id)) return;
      frame.callback(performance.now());
    };

    const { mod } = await loadStore(false);
    flushFrame();
    flushFrame();
    await Promise.resolve();
    statusBarMock.setStyle.mockClear();

    mod.useThemeStore.getState().setTheme("ink");

    expect(document.documentElement.dataset.theme).toBe("paper");
    expect(statusBarMock.setStyle).not.toHaveBeenCalled();
    flushFrame();
    const firstVeil = document.querySelector<HTMLElement>("[data-theme-transition-veil]");
    fireOpacityTransitionEnd(firstVeil!);
    expect(document.documentElement.dataset.theme).toBe("ink");
    expect(statusBarMock.setStyle).not.toHaveBeenCalled();
    flushFrame();
    expect(statusBarMock.setStyle).not.toHaveBeenCalled();
    flushFrame();
    expect(statusBarMock.setStyle).not.toHaveBeenCalled();
    flushFrame();
    expect(statusBarMock.setStyle).toHaveBeenLastCalledWith({ style: "LIGHT" });
    fireOpacityTransitionEnd(firstVeil!);

    statusBarMock.setStyle.mockClear();
    mod.useThemeStore.getState().setTheme("paper");
    mod.useThemeStore.getState().setTheme("oled");
    flushFrame();
    flushFrame();
    const latestVeil = document.querySelector<HTMLElement>("[data-theme-transition-veil]");
    fireOpacityTransitionEnd(latestVeil!);
    flushFrame();
    flushFrame();
    flushFrame();
    flushFrame();
    expect(statusBarMock.setStyle).toHaveBeenCalledTimes(1);
    expect(statusBarMock.setStyle).toHaveBeenLastCalledWith({ style: "LIGHT" });
  });

  it("preserves theme-relative status-bar contrast on non-Android native shells", async () => {
    platformMock.isAndroid = false;

    const { mod } = await loadStore(true);
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });

    expect(mod.useThemeStore.getState().appliedTheme).toBe("ink");
    expect(statusBarMock.setStyle).toHaveBeenLastCalledWith({ style: "DARK" });
  });

  it("keeps the previous mode and DOM when persistence is unavailable", async () => {
    const { mod } = await loadStore(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });

    const result = mod.useThemeStore.getState().setTheme("ink");

    expect(result).toEqual({ ok: false, reason: "storage-unavailable" });
    expect(mod.useThemeStore.getState()).toMatchObject({ theme: "auto", appliedTheme: "paper" });
    expect(document.documentElement.dataset.theme).toBe("paper");
  });

  it("applies and persists an accent immediately with one-step undo", async () => {
    const { mod } = await loadStore(false);
    const blue = { schemaVersion: 1 as const, accentFamily: "blue" as const, highContrast: false };

    expect(mod.useThemeStore.getState().setThemeCustomization(blue)).toEqual({
      ok: true,
      changed: true,
    });
    expect(mod.useThemeStore.getState().themeCustomization).toEqual(blue);
    expect(mod.useThemeStore.getState().previousThemeCustomization).toEqual(
      DEFAULT_THEME_CUSTOMIZATION,
    );
    expect(document.documentElement.dataset.themeAccent).toBe("blue");

    expect(mod.useThemeStore.getState().undoThemeCustomization()).toEqual({
      ok: true,
      changed: true,
    });
    expect(mod.useThemeStore.getState().themeCustomization).toEqual(DEFAULT_THEME_CUSTOMIZATION);
    expect(document.documentElement.dataset.themeAccent).toBe("green");
  });

  it("keeps the committed accent when the next customization write fails", async () => {
    const { mod } = await loadStore(false);
    const blue = { schemaVersion: 1 as const, accentFamily: "blue" as const, highContrast: false };
    expect(mod.useThemeStore.getState().setThemeCustomization(blue)).toEqual({
      ok: true,
      changed: true,
    });

    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });
    const result = mod.useThemeStore.getState().setThemeCustomization({
      schemaVersion: 1,
      accentFamily: "amber",
      highContrast: true,
    });

    expect(result).toEqual({ ok: false, reason: "storage-unavailable" });
    expect(mod.useThemeStore.getState().themeCustomization).toEqual(blue);
    expect(document.documentElement.dataset.themeAccent).toBe("blue");
    expect(document.documentElement.dataset.themeContrast).toBe("standard");
  });

  it("resets customization through the same reversible committed path", async () => {
    const { mod } = await loadStore(false);
    const violet = {
      schemaVersion: 1 as const,
      accentFamily: "violet" as const,
      highContrast: true,
    };
    mod.useThemeStore.getState().setThemeCustomization(violet);

    expect(mod.useThemeStore.getState().resetThemeCustomization()).toEqual({
      ok: true,
      changed: true,
    });
    expect(mod.useThemeStore.getState().themeCustomization).toEqual(DEFAULT_THEME_CUSTOMIZATION);
    expect(mod.useThemeStore.getState().previousThemeCustomization).toEqual(violet);
  });

  it("adopts a valid newer tab value without writing it back", async () => {
    const { mod } = await loadStore(false);
    const off = mod.bindThemeRuntimeListeners();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const payload = JSON.stringify({
      state: {
        theme: "oled",
        themeCustomization: {
          schemaVersion: 1,
          accentFamily: "amber",
          highContrast: true,
        },
      },
      version: 0,
    });

    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: payload }));

    expect(mod.useThemeStore.getState()).toMatchObject({
      theme: "oled",
      appliedTheme: "paper",
      themeCustomization: {
        schemaVersion: 1,
        accentFamily: "amber",
        highContrast: true,
      },
    });
    expect(document.documentElement.dataset.theme).toBe("paper");
    expect(setItemSpy).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const veil = document.querySelector<HTMLElement>("[data-theme-transition-veil]");
    fireOpacityTransitionEnd(veil!);
    expect(mod.useThemeStore.getState().appliedTheme).toBe("oled");
    expect(document.documentElement.dataset.theme).toBe("oled");
    off();
  });

  it("reports same-value writes as no-ops without inventing an undo predecessor", async () => {
    const { mod } = await loadStore(false);
    const current = mod.useThemeStore.getState().themeCustomization;

    expect(mod.useThemeStore.getState().setTheme("auto")).toEqual({
      ok: true,
      changed: false,
    });
    expect(mod.useThemeStore.getState().setThemeCustomization(current)).toEqual({
      ok: true,
      changed: false,
    });
    expect(mod.useThemeStore.getState().resetThemeCustomization()).toEqual({
      ok: true,
      changed: false,
    });
    expect(mod.useThemeStore.getState().previousThemeCustomization).toBeNull();
    expect(mod.useThemeStore.getState().undoThemeCustomization()).toEqual({
      ok: true,
      changed: false,
    });
  });

  it("reports a stale undo as a no-op after a newer tab replaces the appearance", async () => {
    const { mod } = await loadStore(false);
    const off = mod.bindThemeRuntimeListeners();
    mod.useThemeStore.getState().setThemeCustomization({
      schemaVersion: 1,
      accentFamily: "blue",
      highContrast: false,
    });

    const external = {
      schemaVersion: 1 as const,
      accentFamily: "amber" as const,
      highContrast: true,
    };
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify({
          state: { theme: "paper", themeCustomization: external },
          version: 1,
        }),
      }),
    );

    expect(mod.useThemeStore.getState().previousThemeCustomization).toBeNull();
    expect(mod.useThemeStore.getState().undoThemeCustomization()).toEqual({
      ok: true,
      changed: false,
    });
    expect(mod.useThemeStore.getState().themeCustomization).toEqual(external);
    off();
  });

  it("ignores malformed newer-tab payloads", async () => {
    const { mod } = await loadStore(false);
    const off = mod.bindThemeRuntimeListeners();

    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: "{not-valid-json" }),
    );

    expect(mod.useThemeStore.getState()).toMatchObject({
      theme: "auto",
      appliedTheme: "paper",
      themeCustomization: DEFAULT_THEME_CUSTOMIZATION,
    });
    off();
  });

  it("binds and cleans up the OS and storage listeners", async () => {
    const { mod, mql } = await loadStore(false);
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const off = mod.bindThemeRuntimeListeners();

    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    off();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith("storage", expect.any(Function));
  });

  it("keeps legacy classes and fixed native chrome contrast when System follows an OS change", async () => {
    const { mod, mql } = await loadStore(false);
    const off = mod.bindThemeRuntimeListeners();
    const handleColorScheme = mql.addEventListener.mock.calls.find(
      ([eventName]) => eventName === "change",
    )?.[1] as (() => void) | undefined;

    mql.matches = true;
    handleColorScheme?.();

    expect(mod.useThemeStore.getState()).toMatchObject({ theme: "auto", appliedTheme: "ink" });
    expect(document.documentElement.dataset.theme).toBe("ink");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("oled");
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
    expect(statusBarMock.setStyle).toHaveBeenLastCalledWith({ style: "LIGHT" });
    off();
  });
});
