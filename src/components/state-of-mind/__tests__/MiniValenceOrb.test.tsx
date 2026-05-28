import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { MiniValenceOrb } from "../MiniValenceOrb";

vi.mock("../orbRenderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../orbRenderer")>();
  return {
    ...actual,
    drawOrbScene: vi.fn(),
  };
});

describe("MiniValenceOrb", () => {
  let allow2dContext = false;

  beforeEach(() => {
    allow2dContext = false;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
      if (allow2dContext && contextId === "2d") {
        return {} as CanvasRenderingContext2D;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the legacy bare md preset as the default compact orb", () => {
    const { container } = render(<MiniValenceOrb valence={0.2} hasEntry />);
    expect(container.firstChild).toHaveClass("h-12", "w-12");
    const canonicalOrb = container.querySelector("[data-orb-transition-profile]");
    expect(canonicalOrb).toHaveAttribute(
      "data-orb-transition-profile",
      "v1-soft",
    );
    expect(canonicalOrb).toHaveAttribute("data-orb-animation-speed", "0.72");
    expect(canonicalOrb).toHaveAttribute("data-orb-renderer-policy", "webgl");
  });

  it("renders the canonical badge chrome for Diary-style mini-orbs", () => {
    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="md" chrome="badge" />,
    );

    expect(container.firstChild).toHaveClass("h-16", "w-16", "rounded-full");
    expect(container.firstChild).toHaveClass("bg-card/80");
  });

  it("uses the canonical ambient valence without reintroducing local timers", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="sm" chrome="badge" />,
    );

    expect(container.querySelector("[data-orb-renderer-policy]")).toHaveAttribute(
      "data-orb-renderer-policy",
      "webgl",
    );
    expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 320);
  });

  it("keeps mini chrome hidden when no canonical first-paint frame is available", () => {
    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="sm" chrome="badge" />,
    );

    expect(container.firstChild).toHaveClass("opacity-0");
  });

  it("reveals mini chrome as soon as the canonical first-paint frame is ready", () => {
    allow2dContext = true;

    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="sm" chrome="badge" />,
    );

    expect(container.firstChild).toHaveClass("opacity-100");
    expect(container.querySelector("[data-orb-first-paint-ready='true']")).not.toBeNull();
    expect(container.querySelector("canvas[data-orb-first-paint-canvas='true']")).not.toBeNull();
  });

  it("renders the refine chrome with its larger lg preset", () => {
    const { container } = render(
      <MiniValenceOrb valence={0.5} hasEntry size="lg" chrome="refine" />,
    );

    expect(container.firstChild).toHaveClass("h-20", "w-20", "rounded-full");
    expect(container.firstChild).toHaveClass("bg-background/45");
  });
});
