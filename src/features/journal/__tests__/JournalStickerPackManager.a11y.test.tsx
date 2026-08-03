import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STICKER_PACK_PREFS } from "../stickerUtils";
import { JournalStickerPackManager } from "../JournalStickerPackManager";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      close: "Close",
      journalStickerPacks: "Sticker packs",
      journalStickerEmotions: "Emotions",
      journalStickerNature: "Nature",
      journalStickerActivities: "Activities",
      journalStickerFood: "Food",
      journalStickerSymbols: "Symbols",
      journalStickerWeather: "Weather",
      journalStickerPeople: "People",
      journalStickerHealth: "Health",
      journalStickerPlaces: "Places",
      journalStickerCelebrations: "Celebrations",
      journalStickerPackEnableLabel: "Enable {pack}",
      journalStickerPackDisableLabel: "Disable {pack}",
      stickerCountOne: "{count} sticker",
      stickerCountOther: "{count} stickers",
    },
  }),
}));

vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));
vi.mock("../StickerRenderer", () => ({
  StickerRenderer: ({ emoji }: { emoji: string }) => <span aria-hidden="true">{emoji}</span>,
}));
vi.mock("framer-motion", () => {
  const passthrough = (Tag: keyof JSX.IntrinsicElements) =>
    ({ children, layout, whileTap, transition, animate, initial, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => {
      void layout;
      void whileTap;
      void transition;
      void animate;
      void initial;
      return <Tag {...rest}>{children}</Tag>;
    };
  return {
    motion: { button: passthrough("button"), div: passthrough("div") },
    useReducedMotion: () => true,
  };
});

describe("JournalStickerPackManager accessibility", () => {
  it("names each action with its pack and exposes the pressed state", () => {
    const onToggle = vi.fn();
    render(
      <JournalStickerPackManager
        prefs={DEFAULT_STICKER_PACK_PREFS}
        onToggle={onToggle}
        isNew={() => false}
        enabledCount={5}
        onClose={vi.fn()}
      />,
    );

    const disableEmotions = screen.getByRole("button", { name: "Disable Emotions" });
    const enableWeather = screen.getByRole("button", { name: "Enable Weather" });
    expect(disableEmotions).toHaveAttribute("aria-pressed", "true");
    expect(enableWeather).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(enableWeather);
    expect(onToggle).toHaveBeenCalledWith("weather");
  });

  it("disables the only remaining enabled pack", () => {
    const prefs = {
      ...DEFAULT_STICKER_PACK_PREFS,
      enabled: Object.fromEntries(
        Object.keys(DEFAULT_STICKER_PACK_PREFS.enabled).map((key) => [key, key === "emotions"]),
      ),
    };

    render(
      <JournalStickerPackManager
        prefs={prefs}
        onToggle={vi.fn()}
        isNew={() => false}
        enabledCount={1}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Disable Emotions" })).toBeDisabled();
  });
});
