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
  hyperfocusToneLabel: "Tone",
  hyperfocusToneHelp: "High-frequency cutoff; pitch and speed stay unchanged.",
  hyperfocusToneSofter: "Softer",
  hyperfocusToneFullSpectrum: "Full spectrum",
  hyperfocusToneUnavailable: "Tone control is unavailable on this device.",
  muteSound: "Mute sound",
  unmuteSound: "Unmute sound",
};

function renderSelector(props: Partial<React.ComponentProps<typeof HyperfocusSoundSelector>> = {}) {
  const onSoundSelect = vi.fn();
  const onToggleSound = vi.fn();
  const onPlaySound = vi.fn();
  const onToneCutoffChange = vi.fn(() => true);

  render(
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

  return { onSoundSelect, onToggleSound, onPlaySound, onToneCutoffChange };
}

describe("HyperfocusSoundSelector three-level audio", () => {
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

    const softButton = screen.getByRole("button", { name: "Soft" });
    expect(softButton.className).toContain("min-h-[44px]");
    expect(screen.getByRole("button", { name: "Deep" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intense" })).toBeInTheDocument();

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
        hyperfocusSoundLevelSoft: "Suave",
        hyperfocusSoundLevelDeep: "Profundo",
        hyperfocusSoundLevelIntense: "Intenso",
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
