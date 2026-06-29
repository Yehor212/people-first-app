import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { HyperfocusSoundSelector } from "../HyperfocusSoundSelector";

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
  hyperfocusSoundUnderwater: "Underwater",
  hyperfocusSoundThunderstorm: "Thunderstorm",
  hyperfocusSoundOcean: "Ocean",
  hyperfocusSoundRiver: "River",
  hyperfocusSoundForest: "Forest",
  hyperfocusSoundFireplace: "Fireplace",
  hyperfocusSoundIntensity: "Sound intensity",
  hyperfocusSoundFireplaceSoft: "Embers",
  hyperfocusSoundFireplaceDeep: "Hearth",
  hyperfocusSoundFireplaceIntense: "Bonfire",
  muteSound: "Mute sound",
  unmuteSound: "Unmute sound",
};

function renderSelector(props: Partial<React.ComponentProps<typeof HyperfocusSoundSelector>> = {}) {
  const onSoundSelect = vi.fn();
  const onToggleSound = vi.fn();
  const onPlaySound = vi.fn();

  render(
    <HyperfocusSoundSelector
      selectedSoundId={null}
      isSoundPlaying={false}
      audioStatus={{ state: "idle", soundId: null, isUnlocked: false }}
      onSoundSelect={onSoundSelect}
      onToggleSound={onToggleSound}
      onPlaySound={onPlaySound}
      t={t}
      {...props}
    />,
  );

  return { onSoundSelect, onToggleSound, onPlaySound };
}

describe("HyperfocusSoundSelector three-level audio", () => {
  it("renders a clear nature-first set of unique sound families", () => {
    renderSelector();

    expect(screen.getByRole("button", { name: /underwater/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /thunderstorm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ocean/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /river/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fireplace/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /coffee|cafe/i })).toBeNull();
  });

  it("shows three intensity levels for the selected sound family", () => {
    const { onSoundSelect } = renderSelector({ selectedSoundId: "fireplace:deep" });

    const embersButton = screen.getByRole("button", { name: "Embers" });
    expect(embersButton.className).toContain("min-h-[44px]");
    expect(screen.getByRole("button", { name: "Hearth" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bonfire" })).toBeInTheDocument();

    fireEvent.click(embersButton);

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
        hyperfocusSoundFireplaceSoft: "Brasas",
        hyperfocusSoundFireplaceDeep: "Hogar",
        hyperfocusSoundFireplaceIntense: "Fogata",
      },
    });

    expect(screen.getByRole("group", { name: "Intensidad del sonido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brasas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hogar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fogata" })).toBeInTheDocument();
  });
});
