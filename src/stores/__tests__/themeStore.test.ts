import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_CUSTOMIZATION } from "../themeCustomization";

const STORAGE_KEY = "zenflow:theme-v0c";
const statusBarMock = vi.hoisted(() => ({
  setStyle: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/platform", () => ({ isNative: true }));
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
    statusBarMock.setStyle.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove("dark", "oled");
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

  it("persists a mode before committing its DOM and store state", async () => {
    const { mod } = await loadStore(false);
    const result = mod.useThemeStore.getState().setTheme("oled");

    expect(result).toEqual({ ok: true });
    expect(mod.useThemeStore.getState()).toMatchObject({ theme: "oled", appliedTheme: "oled" });
    expect(document.documentElement.dataset.theme).toBe("oled");
    expect(document.documentElement).toHaveClass("dark", "oled");
    expect(localStorage.getItem("zenflow-theme")).toBe("dark");
    expect(statusBarMock.setStyle).toHaveBeenLastCalledWith({ style: "DARK" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").state.theme).toBe("oled");
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

    expect(mod.useThemeStore.getState().setThemeCustomization(blue)).toEqual({ ok: true });
    expect(mod.useThemeStore.getState().themeCustomization).toEqual(blue);
    expect(mod.useThemeStore.getState().previousThemeCustomization).toEqual(
      DEFAULT_THEME_CUSTOMIZATION,
    );
    expect(document.documentElement.dataset.themeAccent).toBe("blue");

    expect(mod.useThemeStore.getState().undoThemeCustomization()).toEqual({ ok: true });
    expect(mod.useThemeStore.getState().themeCustomization).toEqual(DEFAULT_THEME_CUSTOMIZATION);
    expect(document.documentElement.dataset.themeAccent).toBe("green");
  });

  it("keeps the committed accent when the next customization write fails", async () => {
    const { mod } = await loadStore(false);
    const blue = { schemaVersion: 1 as const, accentFamily: "blue" as const, highContrast: false };
    expect(mod.useThemeStore.getState().setThemeCustomization(blue)).toEqual({ ok: true });

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

    expect(mod.useThemeStore.getState().resetThemeCustomization()).toEqual({ ok: true });
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
      appliedTheme: "oled",
      themeCustomization: {
        schemaVersion: 1,
        accentFamily: "amber",
        highContrast: true,
      },
    });
    expect(document.documentElement.dataset.theme).toBe("oled");
    expect(setItemSpy).not.toHaveBeenCalled();
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

  it("keeps legacy classes and native chrome aligned when System follows an OS change", async () => {
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
    expect(statusBarMock.setStyle).toHaveBeenLastCalledWith({ style: "DARK" });
    off();
  });
});
