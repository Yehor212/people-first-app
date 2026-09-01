import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { HyperfocusSoundSelector } from "../HyperfocusSoundSelector";

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => true,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const createMotionComponent = (tag: "button" | "div") =>
    ReactModule.forwardRef<HTMLElement, Record<string, unknown> & { children?: React.ReactNode }>(
      ({ children, whileHover: _whileHover, whileTap: _whileTap, initial: _initial, animate: _animate, exit: _exit, ...props }, ref) =>
        ReactModule.createElement(tag, { ...props, ref }, children as React.ReactNode),
    );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      button: createMotionComponent("button"),
      div: createMotionComponent("div"),
    },
  };
});

const t = {
  hyperfocusAmbientSound: "Ambient sound",
  hyperfocusSoundNone: "None",
  hyperfocusSoundRain: "Rain",
  hyperfocusSoundWind: "Wind",
  hyperfocusSoundOcean: "Ocean",
  hyperfocusSoundRiver: "River",
  hyperfocusSoundForest: "Forest",
  hyperfocusSoundFireplace: "Fireplace",
  hyperfocusSoundIntensity: "Sound intensity",
  hyperfocusSoundLevelSoft: "Soft",
  hyperfocusSoundLevelDeep: "Deep",
  hyperfocusSoundLevelIntense: "Intense",
  hyperfocusSoundFireplaceSoft: "Embers",
  hyperfocusSoundFireplaceDeep: "Hearth",
  hyperfocusSoundFireplaceIntense: "Full Hearth",
  hyperfocusToneLabel: "Tone",
  hyperfocusToneHelp: "High-frequency cutoff; pitch and speed stay unchanged.",
  hyperfocusToneSofter: "Softer",
  hyperfocusToneFullSpectrum: "Full spectrum",
  hyperfocusToneUnavailable: "Tone control is unavailable on this device.",
  muteSound: "Mute sound",
  unmuteSound: "Unmute sound",
  audioLoading: "Loading ambient sound...",
  audioTapToEnable: "Tap to enable",
  audioRetry: "Retry",
};

function renderSelector(props: Partial<React.ComponentProps<typeof HyperfocusSoundSelector>> = {}) {
  const onSoundSelect = vi.fn();
  const onToggleSound = vi.fn();
  const onPlaySound = vi.fn();
  const onToneCutoffChange = vi.fn(() => true);

  const view = render(
    <HyperfocusSoundSelector
      selectedSoundId={null}
      isSoundPlaying={false}
      audioStatus={{ state: "idle", soundId: null, isUnlocked: false }}
      onSoundSelect={onSoundSelect}
      onToggleSound={onToggleSound}
      onPlaySound={onPlaySound}
      toneCutoffKhz={16}
      toneFilterStatus={{ state: "pending", cutoffKhz: 16 }}
      onToneCutoffChange={onToneCutoffChange}
      t={t}
      {...props}
    />,
  );

  return { ...view, onSoundSelect, onToggleSound, onPlaySound, onToneCutoffChange };
}

describe("HyperfocusSoundSelector three-level audio", () => {
  it("announces the localized loading state as one polite status", () => {
    renderSelector({
      selectedSoundId: "rain:deep",
      audioStatus: { state: "loading", soundId: "rain:deep", isUnlocked: true },
      t: {
        ...t,
        audioLoading: "Cargando sonido ambiental...",
      },
    });

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("Cargando sonido ambiental...");
  });

  it("keeps blocked and error recovery actions wired to the selected sound", () => {
    const blocked = renderSelector({
      selectedSoundId: "rain:deep",
      audioStatus: { state: "blocked", soundId: "rain:deep", isUnlocked: false },
    });

    fireEvent.click(screen.getByRole("button", { name: "Tap to enable" }));
    expect(blocked.onPlaySound).toHaveBeenCalledWith("rain:deep");
    blocked.unmount();

    const failed = renderSelector({
      selectedSoundId: "rain:deep",
      audioStatus: { state: "error", soundId: "rain:deep", isUnlocked: true },
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(failed.onPlaySound).toHaveBeenCalledWith("rain:deep");
  });

  it("uses one semantic selection layer without gradient, glow, or nested tile borders", () => {
    const { container } = renderSelector({ selectedSoundId: "fireplace:deep" });
    const classTokens = Array.from(container.querySelectorAll<HTMLElement>("[class]")).flatMap(
      (element) => (element.getAttribute("class") ?? "").split(/\s+/),
    );
    const forbiddenTokens = classTokens.filter(
      (token) =>
        token.startsWith("bg-gradient-") ||
        token.startsWith("from-") ||
        token.startsWith("to-") ||
        token.startsWith("backdrop-blur") ||
        token.startsWith("shadow-") ||
        /^(?:bg|text|border)-(?:violet|purple|blue|amber|red|slate|white)-/.test(token),
    );

    expect(forbiddenTokens).toEqual([]);
    expect(screen.getByText("Ambient sound").parentElement?.parentElement).not.toHaveClass(
      "border",
      "bg-secondary",
      "rounded-2xl",
    );
    expect(screen.getByRole("button", { name: /fireplace/i })).toHaveClass(
      "border-primary",
      "bg-primary/10",
      "text-foreground",
    );

    const intensity = screen.getByRole("group", { name: "Sound intensity" });
    expect(intensity).toHaveClass("rounded-xl", "bg-muted", "p-1");
    for (const level of ["Embers", "Hearth", "Full Hearth"]) {
      expect(screen.getByRole("button", { name: level })).not.toHaveClass("border");
    }
  });

  it("renders a clear nature-first set of unique sound families", () => {
    renderSelector();

    expect(screen.getByRole("button", { name: /forest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rain/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ocean/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fireplace/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /river/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /wind/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /coffee|cafe/i })).toBeNull();
    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows three intensity levels for the selected sound family", () => {
    const { onSoundSelect } = renderSelector({ selectedSoundId: "fireplace:deep" });

    const softButton = screen.getByRole("button", { name: "Embers" });
    expect(softButton.className).toContain("min-h-[44px]");
    expect(screen.getByRole("button", { name: "Hearth" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full Hearth" })).toBeInTheDocument();

    fireEvent.click(softButton);

    expect(onSoundSelect).toHaveBeenCalledWith("fireplace:soft");
  });

  it("selects the deep level when choosing a sound family", () => {
    const { onSoundSelect } = renderSelector();

    fireEvent.click(screen.getByRole("button", { name: /fireplace/i }));

    expect(onSoundSelect).toHaveBeenCalledWith("fireplace:deep");
  });

  it("uses localized intensity labels from translations", () => {
    renderSelector({
      selectedSoundId: "fireplace:deep",
      t: {
        ...t,
        hyperfocusSoundIntensity: "Intensidad del sonido",
        hyperfocusSoundFireplaceSoft: "Suave",
        hyperfocusSoundFireplaceDeep: "Profundo",
        hyperfocusSoundFireplaceIntense: "Intenso",
      },
    });

    expect(screen.getByRole("group", { name: "Intensidad del sonido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suave" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profundo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intenso" })).toBeInTheDocument();
  });

  it("places the selected tone slider immediately after the intensity group", () => {
    renderSelector({ selectedSoundId: "fireplace:deep", toneCutoffKhz: 8.5 });

    const intensity = screen.getByRole("group", { name: "Sound intensity" });
    const slider = screen.getByRole("slider", { name: "Tone" });

    expect(intensity.nextElementSibling).toContainElement(slider);
    expect(slider).toHaveAttribute("min", "3");
    expect(slider).toHaveAttribute("max", "16");
    expect(slider).toHaveAttribute("step", "0.5");
    expect(slider).toHaveValue("8.5");
    expect(slider).toHaveAttribute("aria-valuetext", "8.5 kHz");
  });

  it("keeps tone hidden until a sound family is selected", () => {
    renderSelector();

    expect(screen.queryByRole("slider", { name: "Tone" })).toBeNull();
  });

  it("applies live slider changes and exposes a degraded filter state", () => {
    const { onToneCutoffChange } = renderSelector({
      selectedSoundId: "fireplace:deep",
      toneFilterStatus: {
        state: "degraded",
        cutoffKhz: 16,
        reason: "web-audio-routing-unavailable",
      },
    });

    fireEvent.change(screen.getByRole("slider", { name: "Tone" }), {
      target: { value: "5.5" },
    });

    expect(onToneCutoffChange).toHaveBeenCalledWith(5.5);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tone control is unavailable on this device.",
    );
  });
});
