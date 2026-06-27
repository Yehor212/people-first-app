import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HabitStickerModel } from "../HabitStickerModel";

describe("HabitStickerModel", () => {
  it("keeps the Walk Distance sticker model review-blocked on the reduced still", () => {
    render(<HabitStickerModel pictogramId="walk-distance" state="idle" />);

    const model = screen.getByTestId("habit-sticker-model");
    expect(model).toHaveAttribute("data-habit-sticker", "walk-distance");
    expect(model).toHaveAttribute("data-shape-contract", "concrete-sneaker-pair-not-blob");
    expect(model).toHaveAttribute(
      "data-production-core",
      "blocked-walk-distance-awaiting-tgs-lottie-rig"
    );

    expect(screen.getByTestId("habit-sticker-stage")).toHaveAttribute(
      "data-depth-model",
      "layered-sneakers-laces-soles-toe-heel-shadow"
    );
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-animated-raster")).not.toBeInTheDocument();
    expect(screen.getByTestId("habit-motion-player")).not.toHaveAttribute("data-lottie-asset");
    expect(screen.getByTestId("habit-motion-player")).not.toHaveAttribute(
      "data-animated-raster-asset"
    );
    expect(document.querySelector('[data-habit-motion-still="walk-distance"]')).toBeInTheDocument();
    expect(model.textContent ?? "").not.toMatch(/blob|orb|liquid|splash|cloud|book/i);
  });

  it("keeps Walk Distance streak reactions around the still until the TGS/Lottie rig exists", () => {
    render(<HabitStickerModel pictogramId="walk-distance" state="streak" />);

    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-motion-state", "streak");
    expect(screen.getByTestId("habit-motion-player")).not.toHaveAttribute(
      "data-animated-raster-asset"
    );
    expect(screen.getByTestId("habit-sticker-streak-aura")).toBeInTheDocument();
  });

  it("renders the Read habit as a concrete Telegram-style animated sticker model", () => {
    render(<HabitStickerModel state="idle" />);

    const model = screen.getByTestId("habit-sticker-model");
    expect(model).toHaveAttribute("data-habit-sticker", "read");
    expect(model).toHaveAttribute("data-sticker-state", "idle");
    expect(model).toHaveAttribute("data-shape-contract", "concrete-open-book-not-blob");
    expect(model).toHaveAttribute("data-art-direction", "telegram-style-3d-sticker");
    expect(model.textContent ?? "").not.toMatch(/blob|orb|liquid|splash|cloud/i);

    expect(screen.getByTestId("habit-sticker-stage")).toHaveAttribute(
      "data-depth-model",
      "layered-book-pages-cover-bookmark-shadow"
    );
    expect(screen.getByTestId("habit-lottie-player")).toHaveAttribute(
      "data-habit-lottie-player",
      "read"
    );
    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-renderer", "lottie");
    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute(
      "data-lottie-asset",
      "read/idle.lottie.json"
    );
  });

  it("adds complete-state reaction layers without replacing the book model", () => {
    render(<HabitStickerModel state="complete" />);

    expect(screen.getByTestId("habit-sticker-model")).toHaveAttribute(
      "data-sticker-state",
      "complete"
    );
    expect(screen.getByTestId("habit-sticker-complete-burst")).toBeInTheDocument();
    expect(screen.getByTestId("habit-sticker-check")).toBeInTheDocument();
    expect(screen.getByTestId("habit-lottie-player")).toHaveAttribute(
      "data-habit-lottie-player",
      "read"
    );
  });

  it("adds streak-state aura while preserving reduced-motion fallback", () => {
    const { rerender } = render(<HabitStickerModel state="streak" />);

    expect(screen.getByTestId("habit-sticker-model")).toHaveAttribute(
      "data-sticker-state",
      "streak"
    );
    expect(screen.getByTestId("habit-sticker-streak-aura")).toBeInTheDocument();
    expect(screen.getByTestId("habit-lottie-player")).toHaveAttribute(
      "data-habit-lottie-player",
      "read"
    );

    rerender(<HabitStickerModel state="streak" motionAllowed={false} />);
    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-renderer", "still");
    const still = document.querySelector('[data-habit-motion-still="read"]');
    expect(still).toHaveAttribute("data-habit-motion-still", "read");
  });
});
